const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')

const app = express()
const server = http.createServer(app)

// Configure CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://flyfile.vercel.app', 'https://flyfile-production.up.railway.app'] 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}


app.use(cors(corsOptions))
app.use(express.json())

const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
})

// Store active sessions
const sessions = new Map()
const userSockets = new Map()

// Session cleanup interval (remove expired sessions)
setInterval(() => {
  const now = Date.now()
  for (const [sessionId, session] of sessions.entries()) {
    // Remove sessions older than 1 hour
    if (now - session.createdAt > 60 * 60 * 1000) {
      sessions.delete(sessionId)
      console.log(`Cleaned up expired session: ${sessionId}`)
    }
  }
}, 5 * 60 * 1000) // Check every 5 minutes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    connectedUsers: userSockets.size
  })
})

// Root route: simple info page
app.get('/', (req, res) => {
  res.type('text/plain').send(
    [
      'FlyFile Signaling Server',
      '',
      'This server handles signaling (Socket.IO) only. No files are stored here.',
      'Useful endpoints:',
      '- GET /health  -> basic server status',
      '- GET /api/sessions/:sessionId  -> debug a session (dev only)',
      '',
      'Frontend runs at http://localhost:5173',
    ].join('\n')
  )
})

// Get session info (for debugging)
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const session = sessions.get(sessionId)
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }
  
  res.json({
    sessionId,
    createdAt: session.createdAt,
    sender: !!session.sender,
    receiver: !!session.receiver,
    fileInfo: session.fileInfo
  })
})

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)
  
  // Store socket reference
  userSockets.set(socket.id, socket)

  // Handle joining a session
  socket.on('join-session', ({ sessionId, role }) => {
    console.log(`${socket.id} joining session ${sessionId} as ${role}`)
    
    // Get or create session
    let session = sessions.get(sessionId)
    if (!session) {
      session = {
        id: sessionId,
        createdAt: Date.now(),
        sender: null,
        receiver: null,
        fileInfo: null,
        // For simple-peer signaling fallback/buffering
        pendingSignalsForReceiver: [],
        pendingSignalsForSender: [],
        offer: undefined
      }
      sessions.set(sessionId, session)
    }

    // Join socket to session room
    socket.join(sessionId)
    socket.sessionId = sessionId
    socket.role = role

    // Store socket reference in session
    if (role === 'sender') {
      session.sender = socket.id
      
      // If receiver is already connected, trigger offer creation
      if (session.receiver) {
        console.log(`Sender joined, receiver already connected. Triggering offer creation.`)
        // The sender will create offer automatically in the client
      }
    } else if (role === 'receiver') {
      session.receiver = socket.id
      
      // Send existing file info to receiver if available
      if (session.fileInfo) {
        console.log(`Sending existing file info to receiver:`, session.fileInfo)
        socket.emit('file-info', session.fileInfo)
      }
      
      // If sender is already connected, request offer
      if (session.sender) {
        console.log(`Receiver joined, sender already connected. Requesting offer.`)
        socket.emit('request-offer', { sessionId })
      }
      
      // Flush any buffered simple-peer signals destined for receiver
      if (session.pendingSignalsForReceiver && session.pendingSignalsForReceiver.length) {
        for (const sig of session.pendingSignalsForReceiver) {
          socket.emit('signal', sig)
        }
        session.pendingSignalsForReceiver = []
      }
    }

    console.log(`Session ${sessionId} state after join:`, {
      sender: session.sender,
      receiver: session.receiver,
      hasFileInfo: !!session.fileInfo,
      fileInfo: session.fileInfo
    })
  })

  // Handle signaling (simple-peer fallback)
  socket.on('signal', ({ sessionId, from, data }) => {
    const session = sessions.get(sessionId)
    if (!session) return
    console.log(`Session ${sessionId} state:`, {
      sender: !!session.sender,
      receiver: !!session.receiver,
      hasFileInfo: !!session.fileInfo
    })
  })

  // Handle file information from sender
  socket.on('file-info', ({ sessionId, fileInfo }) => {
    console.log(`Received file info for session ${sessionId}:`, fileInfo)
    
    const session = sessions.get(sessionId)
    if (session && socket.role === 'sender') {
      session.fileInfo = fileInfo
      
      // Send file info to receiver if they're connected
      if (session.receiver) {
        const receiverSocket = userSockets.get(session.receiver)
        if (receiverSocket) {
          console.log(`Sending file info to connected receiver:`, fileInfo)
          receiverSocket.emit('file-info', fileInfo)
        }
      } else {
        console.log(`Receiver not connected yet, file info stored for later`)
      }
    } else {
      console.log(`File info rejected - session: ${!!session}, role: ${socket.role}`)
    }
  })

  // Handle WebRTC offer
  socket.on('offer', ({ sessionId, offer }) => {
    console.log(`Received offer for session ${sessionId}`)
    
    const session = sessions.get(sessionId)
    if (!session) return

    // Store offer in session in case receiver hasn't joined yet
    session.offer = offer

    if (session.receiver) {
      const receiverSocket = userSockets.get(session.receiver)
      if (receiverSocket) {
        console.log(`Forwarding offer to receiver: ${session.receiver}`)
        receiverSocket.emit('offer', { offer })
      }
    } else {
      console.log(`No receiver connected yet, offer stored for session ${sessionId}`)
    }
  })

  // Handle WebRTC answer
  socket.on('answer', ({ sessionId, answer }) => {
    console.log(`Received answer for session ${sessionId}`)
    
    const session = sessions.get(sessionId)
    if (session && session.sender) {
      const senderSocket = userSockets.get(session.sender)
      if (senderSocket) {
        console.log(`Forwarding answer to sender: ${session.sender}`)
        senderSocket.emit('answer', { answer })
      }
    }
  })

  // Receiver can request the latest offer explicitly (in case it missed it)
  socket.on('request-offer', ({ sessionId }) => {
    const session = sessions.get(sessionId)
    if (!session) {
      console.log(`Receiver requested offer for non-existent session: ${sessionId}`)
      socket.emit('session-not-found')
      return
    }
    if (session.offer) {
      socket.emit('offer', { offer: session.offer })
    } else {
      socket.emit('waiting-for-sender')
    }
  })

  // Handle receiver requesting file info (fallback)
  socket.on('request-file-info', ({ sessionId }) => {
    const session = sessions.get(sessionId)
    if (!session) {
      console.log(`Receiver requested file info for non-existent session: ${sessionId}`)
      socket.emit('session-not-found')
      return
    }
    if (session.fileInfo) {
      console.log(`Sending requested file info to receiver:`, session.fileInfo)
      socket.emit('file-info', session.fileInfo)
    } else {
      console.log(`No file info available for session: ${sessionId}`)
      socket.emit('waiting-for-sender')
    }
  })

  // Simple-peer generic signaling relay with buffering (inside connection scope)
  socket.on('signal', ({ sessionId, from, data }) => {
    const session = sessions.get(sessionId)
    if (!session) return

    if (from === 'sender') {
      if (session.receiver) {
        const receiverSocket = userSockets.get(session.receiver)
        if (receiverSocket) receiverSocket.emit('signal', { from: 'sender', data })
      } else {
        session.pendingSignalsForReceiver.push({ from: 'sender', data })
      }
    } else if (from === 'receiver') {
      if (session.sender) {
        const senderSocket = userSockets.get(session.sender)
        if (senderSocket) senderSocket.emit('signal', { from: 'receiver', data })
      } else {
        session.pendingSignalsForSender.push({ from: 'receiver', data })
      }
    }
  })

  // Handle ICE candidates
  socket.on('ice-candidate', ({ sessionId, candidate }) => {
    console.log(`Received ICE candidate for session ${sessionId} from ${socket.id}`)
    
    const session = sessions.get(sessionId)
    if (!session) return
    
    // Validate ICE candidate before forwarding
    if (!candidate || (candidate.sdpMid === null && candidate.sdpMLineIndex === null)) {
      console.warn('Invalid ICE candidate received - missing sdpMid and sdpMLineIndex:', candidate)
      return
    }
    
    // Forward ICE candidate to the other peer with proper structure
    if (socket.role === 'sender' && session.receiver) {
      const receiverSocket = userSockets.get(session.receiver)
      if (receiverSocket) {
        receiverSocket.emit('ice-candidate', { candidate })
      }
    } else if (socket.role === 'receiver' && session.sender) {
      const senderSocket = userSockets.get(session.sender)
      if (senderSocket) {
        senderSocket.emit('ice-candidate', { candidate })
      }
    }
  })

  // Handle transfer declined
  socket.on('transfer-declined', ({ sessionId }) => {
    console.log(`Transfer declined for session ${sessionId}`)
    
    const session = sessions.get(sessionId)
    if (session && session.sender) {
      const senderSocket = userSockets.get(session.sender)
      if (senderSocket) {
        senderSocket.emit('transfer-declined')
      }
    }
    
    // Clean up session
    sessions.delete(sessionId)
  })

  // Handle transfer completed
  socket.on('transfer-completed', ({ sessionId }) => {
    console.log(`Transfer completed for session ${sessionId}`)
    
    // Notify both peers
    socket.to(sessionId).emit('transfer-completed')
    
    // Clean up session after a delay
    setTimeout(() => {
      sessions.delete(sessionId)
    }, 30000) // 30 seconds delay
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
    
    // Remove from user sockets
    userSockets.delete(socket.id)
    
    // Handle session cleanup
    if (socket.sessionId) {
      const session = sessions.get(socket.sessionId)
      if (session) {
        // Notify the other peer
        socket.to(socket.sessionId).emit('peer-disconnected')
        
        // Remove user from session
        if (session.sender === socket.id) {
          session.sender = null
        }
        if (session.receiver === socket.id) {
          session.receiver = null
        }
        
        // If both users are gone, clean up session
        if (!session.sender && !session.receiver) {
          sessions.delete(socket.sessionId)
          console.log(`Cleaned up session: ${socket.sessionId}`)
        }
      }
    }
  })

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error)
  })
})

// Error handling
server.on('error', (error) => {
  console.error('Server error:', error)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason)
})

const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '0.0.0.0'

server.listen(PORT, HOST, () => {
  console.log(`🚀 FlyFile signaling server running on ${HOST}:${PORT}`)
  console.log(`📊 Health check available at http://${HOST}:${PORT}/health`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})
