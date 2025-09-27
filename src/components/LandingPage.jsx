import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { 
  Send, 
  Shield, 
  Zap, 
  Globe, 
  Lock, 
  Smartphone,
  ArrowRight,
  FileText,
  Users,
  Clock
} from 'lucide-react'

const LandingPage = () => {
  const navigate = useNavigate()

  const features = [
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'Files never touch our servers. Direct P2P transfers keep your data private.'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'No upload/download delays. Files transfer directly between browsers.'
    },
    {
      icon: Lock,
      title: 'Secure by Default',
      description: 'WebRTC encryption ensures your files are protected in transit.'
    },
    {
      icon: Smartphone,
      title: 'Works Everywhere',
      description: 'Compatible with all modern browsers on desktop and mobile.'
    },
    {
      icon: Globe,
      title: 'No Registration',
      description: 'Start sharing immediately. No accounts, no sign-ups required.'
    },
    {
      icon: Clock,
      title: 'Temporary Links',
      description: 'Share links expire automatically for enhanced security.'
    }
  ]

  const stats = [
    { number: '0', label: 'Files Stored', sublabel: 'Complete privacy' },
    { number: '∞', label: 'File Size Limit', sublabel: 'Send anything' },
    { number: '100%', label: 'Encrypted', sublabel: 'WebRTC security' }
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8"
            >
              <div className="inline-flex items-center gap-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Send className="w-4 h-4" />
                Private File Sharing
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                Send Files
                <br />
                <span className="bg-gradient-to-r from-primary-600 to-blue-600 bg-clip-text text-transparent">
                  Privately
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                Share files directly browser-to-browser with no servers, no storage, 
                and no compromises on privacy. Just pure P2P magic.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
            >
              <button
                onClick={() => navigate('/send')}
                className="btn-primary text-lg px-8 py-4 flex items-center gap-2 group"
              >
                Send a File
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button className="btn-secondary text-lg px-8 py-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Learn More
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-1">
                    {stat.number}
                  </div>
                  <div className="text-gray-900 dark:text-white font-medium">
                    {stat.label}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {stat.sublabel}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary-200 dark:bg-primary-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-pulse-slow"></div>
          <div className="absolute top-3/4 right-1/4 w-72 h-72 bg-blue-200 dark:bg-blue-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Why Choose FlyFile?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Built with privacy, security, and simplicity in mind. 
              Experience file sharing the way it should be.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="card group hover:shadow-xl transition-all duration-300"
              >
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Simple, secure, and straightforward. Get started in seconds.
            </p>
          </motion.div>

          <div className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {[
              { step: '1', title: 'Connect to a WI-Fi', description: 'make sure both the devices are connceted to the same wifi' },
              { step: '2', title: 'Upload File', description: 'Drag & drop or select your file' },
              { step: '3', title: 'Get Link', description: 'Generate a secure sharing link' },
              { step: '4', title: 'Share', description: 'Send the link to your recipient' },
              { step: '5', title: 'Transfer', description: 'Direct P2P transfer begins' }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Share Securely?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of users who trust FlyFile for private, 
              secure file sharing. No registration required.
            </p>
            <button
              onClick={() => navigate('/send')}
              className="bg-white text-primary-600 hover:bg-gray-100 font-bold text-lg px-8 py-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 mx-auto"
            >
              <Send className="w-5 h-5" />
              Start Sharing Now
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 dark:bg-black text-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Send className="w-6 h-6 text-primary-400" />
            <span className="text-xl font-bold">FlyFile</span>
          </div>
          <p className="text-gray-400 mb-4">
            Private P2P file sharing. Built with ❤️ by Alyan for privacy.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
            <span>Privacy Policy</span>
            <span>•</span>
            <span>Terms of Service</span>
            <span>•</span>
            <span>Open Source</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
