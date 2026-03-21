/**
 * ChatBot Component - Context-aware educational chatbot
 */

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, X, Loader2, Bot, User } from 'lucide-react'
import { chatService, ChatMessage } from '../services/chatService'
import toast from 'react-hot-toast'

interface ChatBotProps {
  videoId?: string
  transcript?: string
  description?: string
  topic?: string
  videoTitle?: string
}

const ChatBot: React.FC<ChatBotProps> = ({
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Add welcome message when chat opens for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        message: '',
        reply: `👋 Hi! I'm ILA's educational assistant. I can help you understand concepts from ${videoTitle || 'this video'}. Ask me anything!`,
        timestamp: new Date(),
        hasContext: !!(transcript || description || topic || videoId),
        contextType: transcript || videoId ? 'transcript' : description ? 'description' : topic ? 'topic' : 'none'
      }
      setMessages([welcomeMessage])
    }
  }, [isOpen, videoTitle, transcript, description, topic, videoId])

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
    setInputMessage('')
    setIsLoading(true)

    try {
      // Send message to chat service
      const response = await chatService.sendMessage({
        message: userMessage.message,
        transcript,
        description,
        topic,
        videoId
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
        reply: 'Sorry, I encountered an error. Please try again in a moment.',
        timestamp: new Date(),
        hasContext: false,
        contextType: 'none'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    toast.success('Chat cleared')
  }

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110 z-50"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <h3 className="font-semibold">ILA Assistant</h3>
              {transcript || description || topic || videoId ? (
                <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">Context-aware</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 1 && (
                <button
                  onClick={clearChat}
                  className="text-white hover:bg-blue-700 p-1 rounded transition-colors"
                  title="Clear chat"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-blue-700 p-1 rounded transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                {/* User Message */}
                {msg.message && (
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    </div>
                    <User className="w-5 h-5 ml-2 text-gray-400 mt-1" />
                  </div>
                )}

                {/* Bot Response */}
                {msg.reply && (
                  <div className="flex justify-start">
                    <Bot className="w-5 h-5 mr-2 text-blue-600 mt-1" />
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-[80%] shadow-sm">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                        {msg.reply}
                      </p>
                      {msg.hasContext && msg.contextType && (
                        <p className="text-xs text-gray-500 mt-2">
                          💡 Using {msg.contextType === 'transcript' ? 'video transcript' : msg.contextType === 'description' ? 'video description' : 'topic'} as context
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <Bot className="w-5 h-5 mr-2 text-blue-600 mt-1" />
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-4 bg-white rounded-b-lg">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                maxLength={2000}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send • {inputMessage.length}/2000 characters
            </p>
          </div>
        </div>
      )}
    </>
  )
}

export default ChatBot


