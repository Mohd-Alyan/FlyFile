// WebRTCContext.jsx
import React, { createContext, useContext, useState, useRef, useCallback } from 'react'
import io from 'socket.io-client'

const WebRTCContext = createContext()

export const useWebRTC = () => {
  const context = useContext(WebRTCContext)
  if (!context) throw new Error('useWebRTC must be used within a WebRTCProvider')
  return context
}

export const WebRTCProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const socketRef = useRef(null)
  const [peerConnection, setPeerConnection] = useState(null)
  const peerRef = useRef(null)
  const [connectionState, setConnectionState] = useState('disconnected')
  const [transferProgress, setTransferProgress] = useState(0)
  const [isConnected, setIsConnected] = useState(false)

  const fileBuffer = useRef([])
  const receivedSize = useRef(0)
  const fileSize = useRef(0)
  const fileName = useRef('')

  const handleIncomingData = useCallback((data) => {
    try {
      if (typeof data === 'string') {
        const message = JSON.parse(data)
        if (message.type === 'file-info') {
          fileName.current = message.name
          fileSize.current = message.size
          receivedSize.current = 0
          fileBuffer.current = []
        } else if (message.type === 'file-end') {
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
    } catch (err) {
      console.error('Failed to parse message', err)
    }

    const chunk = data instanceof ArrayBuffer ? data : data.buffer
    fileBuffer.current.push(chunk)
    receivedSize.current += (chunk.byteLength || data.length || 0)
    const progress = (receivedSize.current / (fileSize.current || 1)) * 100
    setTransferProgress(Math.min(100, Math.round(progress)))
  }, [])

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Free TURN server for testing (will relay traffic if direct connection fails)
      { 
        urls: 'turn:openrelay.metered.ca:80', 
        username: 'openrelayproject', 
        credential: 'openrelayproject' 
      }
    ]
  }

  const initializeSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current
    const newSocket = io('https://flyfile-production.up.railway.app', { transports: ['websocket'] })
    newSocket.on('connect', () => setIsConnected(true))
    newSocket.on('disconnect', () => setIsConnected(false))
    setSocket(newSocket)
    socketRef.current = newSocket
    return newSocket
  }, [])

  const setupPeer = useCallback(async (initiator, sessionId, role) => {
    if (!socketRef.current) throw new Error('Socket not connected')
    if (peerRef.current) peerRef.current.close()

    const peer = new RTCPeerConnection(rtcConfig)

    // Sender data channel
    if (initiator) {
      const dataChannel = peer.createDataChannel('fileTransfer', { ordered: true })
      peer.dataChannel = dataChannel
      dataChannel.onopen = () => setConnectionState('connected')
      dataChannel.onclose = () => setConnectionState('disconnected')
      dataChannel.onerror = () => setConnectionState('failed')
    }

    // Receiver data channel
    peer.ondatachannel = (event) => {
      const channel = event.channel
      peer.dataChannel = channel
      channel.onopen = () => setConnectionState('connected')
      channel.onclose = () => setConnectionState('disconnected')
      channel.onerror = () => setConnectionState('failed')
      channel.onmessage = (event) => handleIncomingData(event.data)
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', { sessionId, candidate: event.candidate })
      }
    }

    peer.onconnectionstatechange = () => setConnectionState(peer.connectionState)

    // Server signaling
    socketRef.current.on('ice-candidate', (data) => {
      if (data?.candidate) peer.addIceCandidate(new RTCIceCandidate(data.candidate))
    })
    socketRef.current.on('offer', async ({ offer }) => {
      if (role === 'receiver') {
        await peer.setRemoteDescription(offer)
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        socketRef.current.emit('answer', { sessionId, answer })
      }
    })
    socketRef.current.on('answer', async ({ answer }) => {
      if (role === 'sender') await peer.setRemoteDescription(answer)
    })
    socketRef.current.on('request-offer', async () => {
      if (initiator) {
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        socketRef.current.emit('offer', { sessionId, offer })
      }
    })

    peerRef.current = peer
    setPeerConnection(peer)

    if (initiator) {
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      socketRef.current.emit('offer', { sessionId, offer })
    } else {
      socketRef.current.emit('request-offer', { sessionId })
    }

    return () => {
      socketRef.current?.off('ice-candidate')
      socketRef.current?.off('offer')
      socketRef.current?.off('answer')
      socketRef.current?.off('request-offer')
    }
  }, [])

  const createSenderPeer = useCallback((sessionId) => setupPeer(true, sessionId, 'sender'), [setupPeer])
  const createReceiverPeer = useCallback((sessionId) => setupPeer(false, sessionId, 'receiver'), [setupPeer])

  const sendFile = useCallback((file, onProgress) => {
    const peer = peerRef.current
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') throw new Error('Data channel not ready')

    const chunkSize = 64 * 1024
    let offset = 0
    peer.dataChannel.send(JSON.stringify({ type: 'file-info', name: file.name, size: file.size }))

    const readSlice = () => {
      const slice = file.slice(offset, offset + chunkSize)
      const reader = new FileReader()
      reader.onload = (e) => {
        peer.dataChannel.send(e.target.result)
        offset += e.target.result.byteLength
        const progress = Math.round((offset / file.size) * 100)
        setTransferProgress(progress)
        onProgress?.(progress)
        if (offset < file.size) {
          if (peer.dataChannel.bufferedAmount > 4 * 1024 * 1024) setTimeout(readSlice, 50)
          else readSlice()
        } else {
          peer.dataChannel.send(JSON.stringify({ type: 'file-end' }))
          setTransferProgress(100)
        }
      }
      reader.readAsArrayBuffer(slice)
    }
    readSlice()
  }, [])

  const cleanup = useCallback(() => {
    peerRef.current?.close()
    peerRef.current = null
    socketRef.current?.disconnect()
    socketRef.current = null
    setPeerConnection(null)
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
    cleanup
  }

  return <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>
}
