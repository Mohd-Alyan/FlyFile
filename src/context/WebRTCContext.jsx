import React, { createContext, useContext, useState, useRef, useCallback } from 'react'
import io from 'socket.io-client'

const WebRTCContext = createContext()

export const useWebRTC = () => {
  const context = useContext(WebRTCContext)
  if (!context) {
    throw new Error('useWebRTC must be used within a WebRTCProvider')
  }
  return context
}

export const WebRTCProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const socketRef = useRef(null)
  const [peerConnection, setPeerConnection] = useState(null) // simple-peer instance
  const peerRef = useRef(null)
  const [connectionState, setConnectionState] = useState('disconnected')
  const [transferProgress, setTransferProgress] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  
  const fileBuffer = useRef([])
  const receivedSize = useRef(0)
  const fileSize = useRef(0)
  const fileName = useRef('')

  // Handle incoming data
  const handleIncomingData = useCallback((data) => {
    console.log('Handling incoming data:', typeof data, data)
    
    try {
      if (typeof data === 'string') {
        const message = JSON.parse(data)
        console.log('Received message:', message)
        
        if (message.type === 'file-info') {
          console.log('File info received:', message.name, message.size)
          fileName.current = message.name
          fileSize.current = message.size
          receivedSize.current = 0
          fileBuffer.current = []
        } else if (message.type === 'file-end') {
          console.log('File transfer completed, downloading...')
          const blob = new Blob(fileBuffer.current)
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = fileName.current
          a.click()
          URL.revokeObjectURL(url)
          setTransferProgress(100)
        }
        return
      }
    } catch (error) {
      console.error('Error parsing message:', error)
    }

    // Binary chunk (ArrayBuffer/Uint8Array)
    console.log('Received binary chunk:', data.byteLength || data.length)
    const chunk = data instanceof ArrayBuffer ? data : data.buffer
    fileBuffer.current.push(chunk)
    receivedSize.current += (chunk.byteLength || data.length || 0)
    const progress = (receivedSize.current / (fileSize.current || 1)) * 100
    setTransferProgress(Math.min(100, Math.round(progress)))
    console.log('Transfer progress:', progress + '%')
  }, [])

  // STUN/TURN configuration
  const rtcConfig = {
    iceServers: [
      { urls: import.meta.env.VITE_STUN_SERVER_1 },
      { urls: import.meta.env.VITE_STUN_SERVER_2 },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "3847967e4150fef3e4dd82ef",
        credential: "dbU3LKfYG1piYJV7"
      }
    ]
  }

  // Initialize socket connection
  const initializeSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current

    const newSocket = io('https://flyfile-production.up.railway.app', {
      transports: ['websocket']
    })

    newSocket.on('connect', () => {
      console.log('Connected to signaling server')
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from signaling server')
      setIsConnected(false)
    })

    setSocket(newSocket)
    socketRef.current = newSocket
    return newSocket
  }, [])

  // Setup native WebRTC peer connection
  const setupPeer = useCallback(async (initiator, sessionId, role) => {
    if (!socketRef.current) throw new Error('Socket not connected')

    // Close previous peer if any
    if (peerRef.current) {
      try { 
        peerRef.current.close() 
        peerRef.current = null
      } catch {}
    }

    let peer
    try {
      // Create native WebRTC peer connection
      peer = new RTCPeerConnection(rtcConfig)
      
      // Create data channel for file transfer (sender only)
      if (initiator) {
        const dataChannel = peer.createDataChannel('fileTransfer', {
          ordered: true
        })
        
        // Store data channel reference
        peer.dataChannel = dataChannel
        
        // Handle data channel events
        dataChannel.onopen = () => {
          console.log('Data channel opened (sender)')
          setConnectionState('connected')
        }
        
        dataChannel.onclose = () => {
          console.log('Data channel closed (sender)')
          setConnectionState('disconnected')
        }
        
        dataChannel.onerror = (error) => {
          console.error('Data channel error (sender):', error)
          setConnectionState('failed')
        }
      }
      
      // Handle incoming data channel (for receiver)
      peer.ondatachannel = (event) => {
        const channel = event.channel
        peer.dataChannel = channel
        
        console.log('Data channel received (receiver)')
        
        channel.onopen = () => {
          console.log('Data channel opened (receiver)')
          setConnectionState('connected')
        }
        
        channel.onclose = () => {
          console.log('Data channel closed (receiver)')
          setConnectionState('disconnected')
        }
        
        channel.onerror = (error) => {
          console.error('Data channel error (receiver):', error)
          setConnectionState('failed')
        }
        
        channel.onmessage = (event) => {
          console.log('Received data on channel:', event.data)
          handleIncomingData(event.data)
        }
      }
      
      // Handle ICE candidates
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate:', event.candidate)
          socketRef.current.emit('ice-candidate', {
            sessionId,
            candidate: event.candidate
          })
        } else {
          console.log('ICE gathering completed (null candidate)')
        }
      }
      
      // Handle connection state changes
      peer.onconnectionstatechange = () => {
        console.log('Connection state:', peer.connectionState)
        setConnectionState(peer.connectionState)
      }
      
    } catch (error) {
      console.error('Failed to create WebRTC peer:', error)
      throw new Error('Failed to create peer connection: ' + error.message)
    }

    // Handle ICE candidates from server
    const onIceCandidate = (data) => {
      if (peer && data && data.candidate) {
        const candidate = data.candidate
        console.log('Adding ICE candidate:', candidate)
        
        // Validate ICE candidate has required properties
        if (candidate && (candidate.sdpMid !== null || candidate.sdpMLineIndex !== null)) {
          peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(error => {
            console.error('Error adding ICE candidate:', error)
          })
        } else {
          console.warn('Invalid ICE candidate received - missing sdpMid and sdpMLineIndex:', candidate)
        }
      }
    }
    
    // Handle offer/answer from server
    const onOffer = async ({ offer }) => {
      if (peer && role === 'receiver') {
        try {
          console.log('Received offer, setting remote description')
          await peer.setRemoteDescription(offer)
          console.log('Creating answer')
          const answer = await peer.createAnswer()
          await peer.setLocalDescription(answer)
          console.log('Sending answer to server')
          
          socketRef.current.emit('answer', {
            sessionId,
            answer: answer
          })
        } catch (error) {
          console.error('Error handling offer:', error)
        }
      }
    }
    
    const onAnswer = async ({ answer }) => {
      if (peer && role === 'sender') {
        try {
          console.log('Received answer, setting remote description')
          await peer.setRemoteDescription(answer)
        } catch (error) {
          console.error('Error handling answer:', error)
        }
      }
    }
    
    // Create offer if initiator (sender)
    if (initiator) {
      try {
        console.log('Creating offer as sender')
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        console.log('Sending offer to server')
        
        socketRef.current.emit('offer', {
          sessionId,
          offer: offer
        })
      } catch (error) {
        console.error('Error creating offer:', error)
      }
    } else {
      // Receiver: request offer if not already available
      console.log('Receiver requesting offer from sender')
      socketRef.current.emit('request-offer', { sessionId })
    }
    
    // Handle request-offer from server
    const onRequestOffer = async () => {
      if (peer && initiator) {
        try {
          console.log('Received request-offer, creating offer')
          const offer = await peer.createOffer()
          await peer.setLocalDescription(offer)
          console.log('Sending offer to server')
          
          socketRef.current.emit('offer', {
            sessionId,
            offer: offer
          })
        } catch (error) {
          console.error('Error creating offer on request:', error)
        }
      }
    }
    
    // Listen for server events
    socketRef.current.on('ice-candidate', onIceCandidate)
    socketRef.current.on('offer', onOffer)
    socketRef.current.on('answer', onAnswer)
    socketRef.current.on('request-offer', onRequestOffer)

    peerRef.current = peer
    setPeerConnection(peer)

    // Return a cleanup to remove socket listeners
    return () => {
      socketRef.current?.off('ice-candidate', onIceCandidate)
      socketRef.current?.off('offer', onOffer)
      socketRef.current?.off('answer', onAnswer)
      socketRef.current?.off('request-offer', onRequestOffer)
    }
  }, [])

  // Create sender peer
  const createSenderPeer = useCallback(async (sessionId) => {
    return await setupPeer(true, sessionId, 'sender')
  }, [setupPeer])

  // Create receiver peer
  const createReceiverPeer = useCallback(async (sessionId) => {
    return await setupPeer(false, sessionId, 'receiver')
  }, [setupPeer])

  // Send file
  const sendFile = useCallback(async (file, onProgress) => {
    const peer = peerRef.current
    if (!peer || !peer.dataChannel || peer.dataChannel.readyState !== 'open') {
      console.error('Data channel not ready:', peer?.dataChannel?.readyState)
      throw new Error('Data channel not ready')
    }

    console.log('Starting file transfer:', file.name, file.size)
    
    const chunkSize = 64 * 1024 // 64KB chunks for better throughput
    let offset = 0

    // Send file info header
    const fileInfo = JSON.stringify({ type: 'file-info', name: file.name, size: file.size })
    console.log('Sending file info:', fileInfo)
    peer.dataChannel.send(fileInfo)

    const readSlice = () => {
      const slice = file.slice(offset, offset + chunkSize)
      const reader = new FileReader()
      reader.onload = (e) => {
        const buf = e.target.result
        console.log('Sending chunk:', offset, 'to', offset + buf.byteLength)
        peer.dataChannel.send(buf)
        offset += buf.byteLength
        const progress = Math.round((offset / file.size) * 100)
        setTransferProgress(progress)
        onProgress?.(progress)
        if (offset < file.size) {
          // Flow control: wait for bufferedAmount to drain
          if (peer.dataChannel.bufferedAmount > 4 * 1024 * 1024) {
            setTimeout(readSlice, 50)
          } else {
            readSlice()
          }
        } else {
          console.log('File transfer completed, sending end signal')
          peer.dataChannel.send(JSON.stringify({ type: 'file-end' }))
          setTransferProgress(100)
        }
      }
      reader.readAsArrayBuffer(slice)
    }

    readSlice()
  }, [])

  // Legacy no-ops to keep compatibility with existing component calls
  const createOffer = useCallback(async () => {}, [])
  const createAnswer = useCallback(async () => {}, [])
  const handleIceCandidate = useCallback(async () => {}, [])

  // Cleanup
  const cleanup = useCallback(() => {
    if (peerRef.current) {
      try { 
        peerRef.current.close() 
        peerRef.current = null
      } catch {}
    }
    setPeerConnection(null)
    
    if (socketRef.current) {
      try { socketRef.current.disconnect() } catch {}
      socketRef.current = null
      setSocket(null)
    }
    
    setConnectionState('disconnected')
    setTransferProgress(0)
    setIsConnected(false)
  }, [])

  const value = {
    socket,
    peerConnection,
    transferProgress,
    connectionState,
    isConnected,
    fileName: fileName.current,
    fileSize: fileSize.current,
    initializeSocket,
    createSenderPeer,
    createReceiverPeer,
    sendFile,
    createOffer,
    createAnswer,
    handleIceCandidate,
    cleanup,
    setTransferProgress,
    getPeerConnection: () => peerRef.current
  }

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  )
}
