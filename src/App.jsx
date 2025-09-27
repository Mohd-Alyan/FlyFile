import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'

// Components
import LandingPage from './components/LandingPage'
import SendPage from './components/SendPage'
import ReceivePage from './components/ReceivePage'
import TransferPage from './components/TransferPage'

// Context
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { WebRTCProvider } from './context/WebRTCContext'

function AppContent() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Theme Toggle Button */}
      <motion.button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Toggle theme"
      >
        <AnimatePresence mode="wait">
          {theme === 'dark' ? (
            <motion.div
              key="sun"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Sun className="w-5 h-5 text-yellow-500" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Moon className="w-5 h-5 text-gray-700" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Main Content */}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/send" element={<SendPage />} />
        <Route path="/receive/:sessionId" element={<ReceivePage />} />
        <Route path="/transfer/:sessionId" element={<TransferPage />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <WebRTCProvider>
        <Router>
          <AppContent />
        </Router>
      </WebRTCProvider>
    </ThemeProvider>
  )
}

export default App
