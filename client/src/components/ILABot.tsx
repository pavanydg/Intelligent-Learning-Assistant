/**
 * ILABot Component - Modern, smooth chatbot UI with animations
 * Features: ChatGPT-style copy button, better structured responses, resizable window
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { 
  MessageCircle, 
  Send, 
  X, 
  Bot, 
  User, 
  Sparkles,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { chatService, ChatMessage } from '../services/chatService'
import toast from 'react-hot-toast'
import CopyButton from './CopyButton'

interface ILABotProps {
  context?: string
  videoId?: string
  transcript?: string
  description?: string
  topic?: string
  videoTitle?: string
}

interface ChatWindowSize {
  width: number
  height: number
}

const ILABot: React.FC<ILABotProps> = ({
  context,
  videoId,
  transcript,
  description,
  topic,
  videoTitle
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [windowSize, setWindowSize] = useState<ChatWindowSize>({
    width: 380,
    height: window.innerHeight * 0.7
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatWindowRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Add welcome message when chat opens for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const hasContext = !!(context || transcript || description || topic || videoId)
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        message: '',
        reply: hasContext
          ? `👋 Hi! I'm ILA's educational assistant. I can help you understand concepts from ${videoTitle || 'this video'}. Ask me anything!`
          : `👋 Hi! I'm ILA's educational assistant. I'm here to help you learn. Ask me anything!`,
        timestamp: new Date(),
        hasContext,
        contextType: transcript || videoId ? 'transcript' : description ? 'description' : topic ? 'topic' : 'none'
      }
      setMessages([welcomeMessage])
    }
  }, [isOpen, videoTitle, context, transcript, description, topic, videoId])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (isMaximized) {
        setWindowSize({
          width: window.innerWidth - 48,
          height: window.innerHeight - 48
        })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMaximized])

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!chatWindowRef.current) return
    e.preventDefault()
    setIsResizing(true)
    const rect = chatWindowRef.current.getBoundingClientRect()
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeRef.current) return
    const deltaX = e.clientX - resizeRef.current.startX
    const deltaY = e.clientY - resizeRef.current.startY
    const newWidth = Math.max(320, Math.min(window.innerWidth - 48, resizeRef.current.startWidth + deltaX))
    const newHeight = Math.max(400, Math.min(window.innerHeight - 48, resizeRef.current.startHeight - deltaY))
    setWindowSize({ width: newWidth, height: newHeight })
    setIsMaximized(false)
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    resizeRef.current = null
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'nwse-resize'
      document.body.style.userSelect = 'none'
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const toggleMaximize = () => {
    if (isMaximized) {
      setWindowSize({ width: 380, height: window.innerHeight * 0.7 })
    } else {
      setWindowSize({
        width: window.innerWidth - 48,
        height: window.innerHeight - 48
      })
    }
    setIsMaximized(!isMaximized)
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      message: inputMessage.trim(),
      reply: '',
      timestamp: new Date(),
      hasContext: false,
      contextType: 'none'
    }

    // Add user message immediately
    setMessages(prev => [...prev, userMessage])
    const messageText = inputMessage.trim()
    setInputMessage('')
    setIsLoading(true)

    try {
      // Use context prop if provided, otherwise use individual props
      const contextToUse = context || transcript
      
      // Send message to chat service
      const response = await chatService.sendMessage({
        message: messageText,
        transcript: contextToUse || transcript,
        description: description,
        topic: topic,
        videoId: videoId
      })

      // Add bot response
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        message: '',
        reply: response.data.reply,
        timestamp: new Date(),
        hasContext: response.data.hasContext,
        contextType: response.data.contextType
      }

      setMessages(prev => [...prev, botMessage])
    } catch (error: any) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        message: '',
        reply: error.message || 'Sorry, I encountered an error. Please try again in a moment.',
        timestamp: new Date(),
        hasContext: false,
        contextType: 'none'
      }
      setMessages(prev => [...prev, errorMessage])
      toast.error(error.message || 'Failed to get response')
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    toast.success('Chat cleared')
  }

  // Typing indicator component
  const TypingIndicator = () => (
    <div className="flex justify-start">
      <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl px-4 py-3 shadow-sm max-w-[80%]">
        <div className="flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-indigo-600" />
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-indigo-600 rounded-full"
                animate={{
                  y: [0, -8, 0],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500 ml-2">ILA is thinking...</span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-full p-4 shadow-2xl z-50 transition-all duration-200"
            aria-label="Open chat"
          >
            <MessageCircle className="w-6 h-6" />
            <motion.div
              className="absolute inset-0 rounded-full bg-white/20"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0, 0.5]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatWindowRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200/50 overflow-hidden"
            style={{
              width: `${windowSize.width}px`,
              height: `${windowSize.height}px`,
              maxWidth: '95vw',
              maxHeight: '95vh',
              minWidth: '320px',
              minHeight: '400px'
            }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Bot className="w-5 h-5" />
                  <motion.div
                    className="absolute -top-1 -right-1"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-3 h-3 text-yellow-300" />
                  </motion.div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm">ILA Assistant</h3>
                  {(context || transcript || description || topic || videoId) && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Context-aware</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMaximize}
                  className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                  title={isMaximized ? "Restore" : "Maximize"}
                >
                  {isMaximized ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                {messages.length > 1 && (
                  <button
                    onClick={clearChat}
                    className="text-white/90 hover:text-white hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium border border-white/30 hover:border-white/50"
                    title="Clear chat"
                  >
                    Clear Chat
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                  aria-label="Close chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50/50 to-white">
              <AnimatePresence>
                {messages.map((msg, index) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="space-y-3"
                  >
                    {/* User Message */}
                    {msg.message && (
                      <div className="flex justify-end items-start gap-2">
                        <motion.div
                          initial={{ scale: 0.9 }}
                          animate={{ scale: 1 }}
                          className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl px-4 py-2.5 max-w-[85%] shadow-md"
                        >
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                        </motion.div>
                        <User className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                      </div>
                    )}

                    {/* Bot Response */}
                    {msg.reply && (
                      <div className="flex justify-start items-start gap-2">
                        <Bot className="w-5 h-5 text-indigo-600 mt-1 flex-shrink-0" />
                        <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl px-4 py-3 max-w-[85%] shadow-sm relative group">
                          {/* Copy Button - Always visible like ChatGPT */}
                          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <CopyButton text={msg.reply} size="sm" />
                          </div>
                          
                          {/* Markdown Content - Better structured */}
                          <div className="text-sm text-gray-800 prose prose-sm max-w-none">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => (
                                  <p className="mb-3 last:mb-0 leading-relaxed text-gray-800">
                                    {children}
                                  </p>
                                ),
                                h1: ({ children }) => (
                                  <h1 className="text-lg font-bold mb-3 mt-4 first:mt-0 text-gray-900 border-b border-gray-200 pb-2">
                                    {children}
                                  </h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-gray-900">
                                    {children}
                                  </h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="text-sm font-semibold mb-2 mt-3 first:mt-0 text-gray-900">
                                    {children}
                                  </h3>
                                ),
                                code: ({ children, className }) => {
                                  const isInline = !className
                                  const codeString = String(children).replace(/\n$/, '')
                                  
                                  return isInline ? (
                                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-indigo-600 border border-gray-200">
                                      {children}
                                    </code>
                                  ) : (
                                    <div className="my-3 relative group/codeblock">
                                      {/* Copy Button for Code Block */}
                                      <div className="absolute top-2 right-2 opacity-0 group-hover/codeblock:opacity-100 transition-opacity z-10">
                                        <CopyButton text={codeString} size="sm" className="bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200" />
                                      </div>
                                      <code className="block bg-gray-900 text-gray-100 p-3 pr-12 rounded-lg text-xs font-mono overflow-x-auto border border-gray-700">
                                        {children}
                                      </code>
                                    </div>
                                  )
                                },
                                ul: ({ children }) => (
                                  <ul className="list-disc list-outside mb-3 ml-4 space-y-1.5 text-gray-700">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="list-decimal list-outside mb-3 ml-4 space-y-1.5 text-gray-700">
                                    {children}
                                  </ol>
                                ),
                                li: ({ children }) => (
                                  <li className="leading-relaxed pl-1">{children}</li>
                                ),
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-indigo-500 pl-4 my-3 italic text-gray-600 bg-gray-50 py-2 rounded-r">
                                    {children}
                                  </blockquote>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-semibold text-gray-900">{children}</strong>
                                ),
                                em: ({ children }) => (
                                  <em className="italic text-gray-700">{children}</em>
                                ),
                                a: ({ href, children }) => (
                                  <a 
                                    href={href} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:text-indigo-700 underline"
                                  >
                                    {children}
                                  </a>
                                ),
                                hr: () => (
                                  <hr className="my-4 border-gray-200" />
                                ),
                                table: ({ children }) => (
                                  <div className="overflow-x-auto my-3">
                                    <table className="min-w-full border border-gray-200 rounded-lg">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                th: ({ children }) => (
                                  <th className="px-4 py-2 bg-gray-100 border-b border-gray-200 text-left font-semibold text-gray-900">
                                    {children}
                                  </th>
                                ),
                                td: ({ children }) => (
                                  <td className="px-4 py-2 border-b border-gray-200 text-gray-700">
                                    {children}
                                  </td>
                                )
                              }}
                            >
                              {msg.reply}
                            </ReactMarkdown>
                          </div>
                          
                          {msg.hasContext && msg.contextType && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <span>💡</span>
                                <span>Using {msg.contextType === 'transcript' ? 'video transcript' : msg.contextType === 'description' ? 'video description' : 'topic'} as context</span>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing Indicator */}
              {isLoading && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200/50 p-4 bg-white/80 backdrop-blur-sm flex-shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask me anything..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none max-h-32 text-sm"
                  disabled={isLoading}
                  maxLength={2000}
                  rows={1}
                  style={{
                    minHeight: '42px',
                    height: 'auto'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = `${Math.min(target.scrollHeight, 128)}px`
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-md disabled:shadow-none"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to send • <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Shift+Enter</kbd> for new line
                </p>
                <p className="text-xs text-gray-400">{inputMessage.length}/2000</p>
              </div>
              <p className="text-xs text-center text-gray-400 mt-2 pt-2 border-t border-gray-100">
                Powered by <span className="font-semibold text-indigo-600">ILA</span>
              </p>
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={handleMouseDown}
              className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize bg-transparent hover:bg-indigo-500/20 transition-colors ${
                isResizing ? 'bg-indigo-500/30' : ''
              }`}
              style={{
                clipPath: 'polygon(100% 0, 0 100%, 100% 100%)'
              }}
            >
              <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default ILABot
