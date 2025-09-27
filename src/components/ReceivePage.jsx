import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Download, 
  File, 
  Shield, 
  X, 
  Check,
  AlertTriangle,
  Clock,
  User
} from 'lucide-react'
import { useWebRTC } from '../context/WebRTCContext'

const ReceivePage = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { initializeSocket } = useWebRTC()
  
  const [fileInfo, setFileInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [waitingForSender, setWaitingForSender] = useState(false)
  const [error, setError] = useState('')
  const [decision, setDecision] = useState(null) // 'accept' or 'decline'
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const socket = initializeSocket()
    
    if (socket && sessionId) {
      // Join the session as receiver
      socket.emit('join-session', { sessionId, role: 'receiver' })
      
      // Listen for file information
      socket.on('file-info', (data) => {
        console.log('Received file info:', data)
        setFileInfo(data)
        setIsLoading(false)
      })
      
      // Listen for session not found
      socket.on('session-not-found', () => {
        console.log('Session not found')
        setError('Session not found or expired')
        setIsLoading(false)
      })
      
      // Listen for waiting for sender
      socket.on('waiting-for-sender', () => {
        console.log('Waiting for sender')
        setWaitingForSender(true)
        setIsLoading(false)
      })

      // Listen for sender disconnect
      socket.on('sender-disconnected', () => {
        setError('Sender has disconnected')
      })

      // Fallback: request file info after a short delay if not received
      const timeoutId = setTimeout(() => {
        if (isLoading && !fileInfo && !error) {
          console.log('Requesting file info as fallback')
          socket.emit('request-file-info', { sessionId })
        }
      }, 2000) // Wait 2 seconds before requesting

      return () => {
        clearTimeout(timeoutId)
        if (socket) {
          socket.off('file-info')
          socket.off('session-not-found')
          socket.off('waiting-for-sender')
          socket.off('sender-disconnected')
        }
      }
    }
  }, [sessionId, initializeSocket, isLoading, fileInfo, error])

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Handle accept transfer
  const handleAccept = () => {
    setDecision('accept')
    setIsConnecting(true)
    
    // Navigate to transfer page
    navigate(`/transfer/${sessionId}?role=receiver`, {
      state: { fileInfo, sessionId }
    })
  }

  // Handle decline transfer
  const handleDecline = () => {
    setDecision('decline')
    
    // Emit decline to sender
    const socket = initializeSocket()
    if (socket) {
      socket.emit('transfer-declined', { sessionId })
    }
    
    // Navigate back to home after a delay
    setTimeout(() => {
      navigate('/')
    }, 2000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4"
          />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Loading file information...
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Connecting to sender
          </p>
        </div>
      </div>
    )
  }

  if (waitingForSender && !fileInfo && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Waiting for sender...
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Keep this page open. You'll see the file details as soon as the sender is ready.
          </p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {error}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The file sharing session may have expired or the link is invalid.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary w-full"
          >
            Go Home
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {decision === null && (
            <motion.div
              key="decision"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Download className="w-10 h-10 text-primary-600 dark:text-primary-400" />
                </motion.div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Incoming File
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Someone wants to share a file with you
                </p>
              </div>

              {/* File Information */}
              <div className="card">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <File className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {fileInfo?.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {formatFileSize(fileInfo?.size || 0)}
                    </p>
                  </div>
                </div>

                {/* File Details */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">File Type</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {fileInfo?.type || 'Unknown'}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Size</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {formatFileSize(fileInfo?.size || 0)}
                    </div>
                  </div>
                </div>

                {/* Security Info */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div>
                      <div className="font-medium text-green-800 dark:text-green-300">
                        Secure Transfer
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-400">
                        End-to-end encrypted • Direct P2P connection
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleDecline}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </button>
                  <button
                    onClick={handleAccept}
                    disabled={isConnecting}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    {isConnecting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Accept & Download
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div className="card bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                      Before you accept
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Only accept files from people you trust. While the transfer is encrypted, 
                      always scan downloaded files for security.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {decision === 'decline' && (
            <motion.div
              key="declined"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card text-center max-w-md mx-auto"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Transfer Declined
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                You have declined the file transfer. The sender has been notified.
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Redirecting to home page...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default ReceivePage
