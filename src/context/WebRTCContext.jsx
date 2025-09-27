import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const WebRTCContext = createContext();

export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) throw new Error('useWebRTC must be used within a WebRTCProvider');
  return context;
};

export const WebRTCProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [transferProgress, setTransferProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // File transfer state
  const fileBuffer = useRef([]);
  const receivedSize = useRef(0);
  const fileSize = useRef(0);
  const fileName = useRef('');
  const currentFileReader = useRef(null);
  const transferCanceled = useRef(false);

  const handleIncomingData = useCallback((data) => {
    try {
      if (typeof data === 'string') {
        const message = JSON.parse(data);
        if (message.type === 'file-info') {
          fileName.current = message.name;
          fileSize.current = message.size;
          receivedSize.current = 0;
          fileBuffer.current = [];
          transferCanceled.current = false;
        } else if (message.type === 'file-end') {
          if (!transferCanceled.current) {
            const blob = new Blob(fileBuffer.current);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.current;
            a.click();
            URL.revokeObjectURL(url);
            setTransferProgress(100);
          }
        }
        return;
      }
    } catch (err) {
      console.error('Error parsing message:', err);
      return;
    }

    // Binary chunk
    const chunk = data instanceof ArrayBuffer ? data : data.slice(0);
    fileBuffer.current.push(chunk);
    receivedSize.current += chunk.byteLength;
    const progress = Math.round((receivedSize.current / (fileSize.current || 1)) * 100);
    setTransferProgress(Math.min(100, progress));
  }, []);

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
  };

  const initializeSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const newSocket = io('https://flyfile-production.up.railway.app', { transports: ['websocket'] });
    newSocket.on('connect', () => { setIsConnected(true); console.log('Connected to signaling server'); });
    newSocket.on('disconnect', () => { setIsConnected(false); console.log('Disconnected from signaling server'); });

    setSocket(newSocket);
    socketRef.current = newSocket;
    return newSocket;
  }, []);

  const setupPeer = useCallback(async (initiator, sessionId, role) => {
    if (!socketRef.current) throw new Error('Socket not connected');

    if (peerRef.current) {
      try { peerRef.current.close(); } catch {}
      peerRef.current = null;
    }

    const peer = new RTCPeerConnection(rtcConfig);
    peerRef.current = peer;
    setPeerConnection(peer);

    // Data channel setup
    if (initiator) {
      const dc = peer.createDataChannel('fileTransfer', { ordered: true });
      peer.dataChannel = dc;
      dc.onopen = () => setConnectionState('connected');
      dc.onclose = () => setConnectionState('disconnected');
      dc.onerror = (e) => { console.error('Data channel error:', e); setConnectionState('failed'); };
    } else {
      peer.ondatachannel = (event) => {
        const dc = event.channel;
        peer.dataChannel = dc;
        dc.onopen = () => setConnectionState('connected');
        dc.onclose = () => setConnectionState('disconnected');
        dc.onerror = (e) => { console.error('Data channel error:', e); setConnectionState('failed'); };
        dc.onmessage = (event) => handleIncomingData(event.data);
      };
    }

    // ICE candidate handling
    peer.onicecandidate = (event) => {
      if (event.candidate) socketRef.current.emit('ice-candidate', { sessionId, candidate: event.candidate });
    };

    peer.onconnectionstatechange = () => setConnectionState(peer.connectionState);

    // Socket events
    socketRef.current.on('ice-candidate', (data) => {
      if (data?.candidate) peer.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
    });

    socketRef.current.on('offer', async ({ offer }) => {
      if (peer && role === 'receiver') {
        await peer.setRemoteDescription(offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socketRef.current.emit('answer', { sessionId, answer });
      }
    });

    socketRef.current.on('answer', async ({ answer }) => {
      if (peer && role === 'sender') await peer.setRemoteDescription(answer);
    });

    socketRef.current.on('request-offer', async () => {
      if (initiator) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socketRef.current.emit('offer', { sessionId, offer });
      }
    });

    if (initiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socketRef.current.emit('offer', { sessionId, offer });
    } else {
      socketRef.current.emit('request-offer', { sessionId });
    }

    return () => {
      socketRef.current?.off('ice-candidate');
      socketRef.current?.off('offer');
      socketRef.current?.off('answer');
      socketRef.current?.off('request-offer');
    };
  }, [handleIncomingData]);

  const createSenderPeer = useCallback(async (sessionId) => setupPeer(true, sessionId, 'sender'), [setupPeer]);
  const createReceiverPeer = useCallback(async (sessionId) => setupPeer(false, sessionId, 'receiver'), [setupPeer]);

  const sendFile = useCallback(async (file, onProgress) => {
    const peer = peerRef.current;
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') throw new Error('Data channel not ready');

    const chunkSize = 64 * 1024;
    let offset = 0;
    transferCanceled.current = false;

    peer.dataChannel.bufferedAmountLowThreshold = 16 * 1024;

    const fileInfo = JSON.stringify({ type: 'file-info', name: file.name, size: file.size });
    peer.dataChannel.send(fileInfo);

    const readSlice = () => {
      if (transferCanceled.current) return;

      const slice = file.slice(offset, offset + chunkSize);
      const reader = new FileReader();
      currentFileReader.current = reader;

      reader.onload = (e) => {
        const buf = e.target.result;
        peer.dataChannel.send(buf);
        offset += buf.byteLength;
        const progress = Math.round((offset / file.size) * 100);
        setTransferProgress(progress);
        onProgress?.(progress);

        if (offset < file.size) {
          if (peer.dataChannel.bufferedAmount > 4 * 1024 * 1024) {
            peer.dataChannel.onbufferedamountlow = readSlice;
          } else readSlice();
        } else {
          peer.dataChannel.send(JSON.stringify({ type: 'file-end' }));
          setTransferProgress(100);
        }
      };

      reader.readAsArrayBuffer(slice);
    };

    readSlice();

    return () => {
      transferCanceled.current = true;
      currentFileReader.current?.abort();
    };
  }, []);

  const cleanup = useCallback(() => {
    transferCanceled.current = true;
    currentFileReader.current?.abort();

    if (peerRef.current) try { peerRef.current.close(); } catch {}
    setPeerConnection(null);

    if (socketRef.current) try { socketRef.current.disconnect(); } catch {}
    socketRef.current = null;
    setSocket(null);
    setConnectionState('disconnected');
    setTransferProgress(0);
    setIsConnected(false);
  }, []);

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
    cleanup,
    setTransferProgress,
    getPeerConnection: () => peerRef.current
  };

  return <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>;
};
