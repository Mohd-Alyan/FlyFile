import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { 
  Upload, 
  File, 
  Copy, 
  QrCode, 
  Send, 
  ArrowLeft,
  Check,
  Users,
  Clock,
  Shield
} from 'lucide-react'
import QRCode from 'qrcode'
import { useWebRTC } from '../context/WebRTCContext'

const SendPage = () => {
  const navigate = useNavigate()
  const { 
    initializeSocket,
    createSenderPeer,
    connectionState,
    sendFile,
    transferProgress
  } = useWebRTC()
  const fileInputRef = useRef(null)
  
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [shareLink, setShareLink] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [step, setStep] = useState('upload') // upload, link-generated, waiting
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [offerCreated, setOfferCreated] = useState(false)

  useEffect(() => {
    // Initialize socket connection when component mounts
    initializeSocket()
  }, [initializeSocket])

  // File size formatter
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Handle file drop
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      setSelectedFile(files[0])
    }
  }, [])

  // Handle drag events
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = e.target.files
    if (files.length > 0) {
      setSelectedFile(files[0])
    }
  }

  // Generate share link
  const generateShareLink = async () => {
    if (!selectedFile) return
    
    setIsGeneratingLink(true)
    
    try {
      // Generate unique session ID
      const newSessionId = Math.random().toString(36).substring(2, 15) + 
                          Math.random().toString(36).substring(2, 15)
      
      setSessionId(newSessionId)
      
      // Create share link
      const link = `${window.location.origin}/receive/${newSessionId}`
      setShareLink(link)
      
      // Join the signaling session as sender and share file info for preview
      const socket = initializeSocket()
      if (socket) {
        socket.emit('join-session', { sessionId: newSessionId, role: 'sender' })
        socket.emit('file-info', {
          sessionId: newSessionId,
          fileInfo: {
            name: selectedFile.name,
            size: selectedFile.size,
            type: selectedFile.type || 'application/octet-stream'
          }
        })

        // Create simple-peer sender immediately so receiver can connect anytime
        try {
          await createSenderPeer(newSessionId)
          setOfferCreated(true)
        } catch (err) {
          console.error('Failed to create sender peer:', err)
        }
      }
      
      // Generate QR code
      const qrUrl = await QRCode.toDataURL(link, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        }
      })
      setQrCodeUrl(qrUrl)
      
      // Keep user on this page with manual copy & QR (no navigation)
      setStep('link-generated')
    } catch (error) {
      console.error('Error generating link:', error)
    } finally {
      setIsGeneratingLink(false)
    }
  }

  // Copy link to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  // When connection becomes connected, start sending automatically
  useEffect(() => {
    const shouldSend = connectionState === 'connected' && selectedFile && offerCreated && !isSending
    if (shouldSend) {
      setIsSending(true)
      sendFile(selectedFile).catch((err) => {
        console.error('Send failed:', err)
        setIsSending(false)
      })
    }
  }, [connectionState, selectedFile, offerCreated, isSending, sendFile])

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Send a File
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Share files securely with direct P2P transfer
            </p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* File Upload Area */}
              <div className="card">
                <div
                  className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Drop your file here
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    or click to browse your files
                  </p>
                  <button className="btn-secondary">
                    Choose File
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Selected File Info */}
              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                      <File className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {selectedFile.name}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <button
                      onClick={generateShareLink}
                      disabled={isGeneratingLink}
                      className="btn-primary flex items-center gap-2"
                    >
                      {isGeneratingLink ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Generate Link
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-300">
                    End-to-end encrypted
                  </span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Direct P2P transfer
                  </span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                    Temporary links
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'link-generated' && (
            <motion.div
              key="link-generated"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* File Info */}
              <div className="card">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Link Generated Successfully!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Share this link with your recipient
                    </p>
                  </div>
                </div>

                {/* Share Link */}
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="input-field flex-1 bg-gray-50 dark:bg-gray-700"
                    />
                    <button
                      onClick={copyToClipboard}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                        copied 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                          : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  {/* QR Code */}
                  {qrCodeUrl && (
                    <div className="text-center">
                      <div className="inline-block p-4 bg-white rounded-lg shadow-sm">
                        <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                        Scan with mobile device
                      </p>
                    </div>
                  )}

                  {/* Sending progress (auto starts once receiver accepts) */}
                  {(isSending || transferProgress > 0) && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 dark:text-white">Transfer Progress</span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{transferProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-primary-600 h-3 rounded-full"
                          style={{ width: `${transferProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* File Details */}
              <div className="card">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  File Details
                </h4>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                    <File className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedFile?.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {formatFileSize(selectedFile?.size || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default SendPage
