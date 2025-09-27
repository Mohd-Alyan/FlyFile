import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { 
  Users, 
  Wifi, 
  Download, 
  Upload, 
  Check, 
  X,
  AlertTriangle,
  RefreshCw,
  File
} from 'lucide-react'
import { useWebRTC } from '../context/WebRTCContext'

const TransferPage = () => {
  const { sessionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const role = searchParams.get('role') // 'sender' or 'receiver'
  
  const {
    initializeSocket,
    createReceiverPeer,
    createSenderPeer,
    sendFile,
    connectionState,
    transferProgress,
    cleanup
  } = useWebRTC()

  const [status, setStatus] = useState('connecting') // connecting, connected, transferring, completed, error
  const [error, setError] = useState('')
  const [peerConnected, setPeerConnected] = useState(false)
  const [transferStarted, setTransferStarted] = useState(false)
  const [eta, setEta] = useState('')
  const [transferSpeed, setTransferSpeed] = useState('')
  
  const fileRef = useRef(location.state?.file)
  const fileInfoRef = useRef(location.state?.fileInfo)
  const startTimeRef = useRef(null)
  const lastProgressRef = useRef(0)
  const lastTimeRef = useRef(null)

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Calculate transfer speed and ETA
  const calculateStats = (progress) => {
    const now = Date.now()
    
    if (!lastTimeRef.current) {
      lastTimeRef.current = now
      lastProgressRef.current = progress
      return
    }

    const timeDiff = (now - lastTimeRef.current) / 1000 // seconds
    const progressDiff = progress - lastProgressRef.current
    
    if (timeDiff > 1 && progressDiff > 0) { // Update every second
      const file = fileRef.current || fileInfoRef.current
      if (file) {
        const totalBytes = file.size
        const bytesTransferred = (progress / 100) * totalBytes
        const bytesPerSecond = (progressDiff / 100) * totalBytes / timeDiff
        
        // Format speed
        setTransferSpeed(formatFileSize(bytesPerSecond) + '/s')
        
        // Calculate ETA
        const remainingBytes = totalBytes - bytesTransferred
        const remainingSeconds = remainingBytes / bytesPerSecond
        
        if (remainingSeconds < 60) {
          setEta(`${Math.round(remainingSeconds)}s remaining`)
        } else if (remainingSeconds < 3600) {
          setEta(`${Math.round(remainingSeconds / 60)}m remaining`)
        } else {
          setEta(`${Math.round(remainingSeconds / 3600)}h remaining`)
        }
      }
      
      lastTimeRef.current = now
      lastProgressRef.current = progress
    }
  }

  useEffect(() => {
    if (transferProgress > 0 && transferProgress < 100) {
      calculateStats(transferProgress)
    }
  }, [transferProgress])

  useEffect(() => {
    const setupConnection = async () => {
      try {
        const socketInstance = initializeSocket()
        
        if (!socketInstance) {
          setError('Failed to connect to signaling server')
          setStatus('error')
          return
        }

        // Join session
        socketInstance.emit('join-session', { sessionId, role })

        // Receiver: create peer connection and wait for sender
        if (role === 'receiver') {
          try {
            console.log('Creating receiver peer connection')
            await createReceiverPeer(sessionId)
            setStatus('connecting')
          } catch (err) {
            console.error('Error creating receiver peer:', err)
            setError('Failed to establish connection')
            setStatus('error')
          }
        } else if (role === 'sender') {
          // Sender: create peer connection
          try {
            console.log('Creating sender peer connection')
            await createSenderPeer(sessionId)
            setStatus('connecting')
          } catch (err) {
            console.error('Error creating sender peer:', err)
            setError('Failed to establish connection')
            setStatus('error')
          }
        }

        socketInstance.on('transfer-declined', () => {
          setError('Transfer was declined by the receiver')
          setStatus('error')
        })

        socketInstance.on('peer-disconnected', () => {
          setError('The other peer has disconnected')
          setStatus('error')
        })

        // Sender logic happens on SendPage now; nothing to do here for sender

      } catch (err) {
        console.error('Setup error:', err)
        setError('Failed to setup connection')
        setStatus('error')
      }
    }

    setupConnection()

    return () => {
      // Cleanup
      cleanup()
    }
  }, [sessionId, role, initializeSocket, createReceiverPeer, cleanup])

  // Start file transfer when connected
  useEffect(() => {
    if (peerConnected && role === 'sender' && fileRef.current && !transferStarted) {
      setTransferStarted(true)
      setStatus('transferring')
      startTimeRef.current = Date.now()
      
      sendFile(fileRef.current, (progress) => {
        if (progress === 100) {
          setStatus('completed')
        }
      }).catch((err) => {
        console.error('Transfer error:', err)
        setError('File transfer failed')
        setStatus('error')
      })
    }
  }, [peerConnected, role, sendFile, transferStarted])

  // Handle transfer completion for receiver
  useEffect(() => {
    if (transferProgress === 100 && role === 'receiver') {
      setStatus('completed')
    }
  }, [transferProgress, role])

  const handleRetry = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    navigate('/')
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'connecting':
        return <Wifi className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      case 'connected':
        return <Users className="w-8 h-8 text-green-600 dark:text-green-400" />
      case 'transferring':
        return role === 'sender' 
          ? <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          : <Download className="w-8 h-8 text-primary-600 dark:text-primary-400" />
      case 'completed':
        return <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
      case 'error':
        return <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
      default:
        return <Wifi className="w-8 h-8 text-gray-400" />
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'connecting':
        return role === 'sender' 
          ? 'Waiting for receiver to connect...'
          : 'Connecting to sender...'
      case 'connected':
        return 'Connection established!'
      case 'transferring':
        return role === 'sender' ? 'Sending file...' : 'Receiving file...'
      case 'completed':
        return 'Transfer completed successfully!'
      case 'error':
        return error || 'An error occurred'
      default:
        return 'Initializing...'
    }
  }

  const file = fileRef.current || fileInfoRef.current

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Status Card */}
          <div className="card text-center">
            <motion.div
              key={status}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              {status === 'connecting' ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  {getStatusIcon()}
                </motion.div>
              ) : (
                getStatusIcon()
              )}
            </motion.div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {getStatusMessage()}
            </h1>

            {status === 'connecting' && (
              <p className="text-gray-600 dark:text-gray-300">
                {role === 'sender' 
                  ? 'Share the link with your recipient and wait for them to accept'
                  : 'Establishing secure P2P connection'
                }
              </p>
            )}

            {connectionState && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Connection: {connectionState}
              </div>
            )}
          </div>

          {/* File Info */}
          {file && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                File Information
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                  <File className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {file.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          {(status === 'transferring' || transferProgress > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  Transfer Progress
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {transferProgress}%
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
                <motion.div
                  className="bg-primary-600 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${transferProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {transferSpeed && (
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>{transferSpeed}</span>
                  <span>{eta}</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Success Actions */}
          {status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card text-center"
            >
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {role === 'sender' ? 'File Sent Successfully!' : 'File Received Successfully!'}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {role === 'sender' 
                  ? 'Your file has been transferred securely to the recipient.'
                  : 'The file has been downloaded to your device.'
                }
              </p>
              <button
                onClick={handleGoHome}
                className="btn-primary"
              >
                Send Another File
              </button>
            </motion.div>
          )}

          {/* Error Actions */}
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card text-center"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Transfer Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {error}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRetry}
                  className="btn-secondary flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={handleGoHome}
                  className="btn-primary"
                >
                  Go Home
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default TransferPage
