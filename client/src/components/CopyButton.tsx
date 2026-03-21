/**
 * CopyButton Component - ChatGPT-style copy button
 * Always visible, smooth animations, clear feedback
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface CopyButtonProps {
  text: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const CopyButton: React.FC<CopyButtonProps> = ({ 
  text, 
  className = '',
  size = 'md'
}) => {
  const [copied, setCopied] = useState(false)

  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-9 h-9'
  }

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-4.5 h-4.5'
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard!', {
        duration: 2000,
        position: 'top-center',
        style: {
          background: '#10b981',
          color: '#fff',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px'
        }
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy', {
        duration: 2000,
        position: 'top-center'
      })
    }
  }

  return (
    <motion.button
      onClick={handleCopy}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        ${sizeClasses[size]}
        ${className || ''}
        flex items-center justify-center
        rounded-lg
        ${!className?.includes('bg-') ? 'bg-gray-100 hover:bg-gray-200' : ''}
        ${!className?.includes('text-') ? 'text-gray-600' : ''}
        ${!className?.includes('border-') ? 'border border-gray-200' : ''}
        transition-colors
        shadow-sm hover:shadow
      `}
      title={copied ? 'Copied!' : 'Copy'}
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ duration: 0.2 }}
            className={className?.includes('bg-gray-800') ? 'text-green-400' : 'text-green-600 dark:text-green-400'}
          >
            <Check className={iconSizes[size]} />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ scale: 0, rotate: 180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: -180 }}
            transition={{ duration: 0.2 }}
          >
            <Copy className={iconSizes[size]} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

export default CopyButton

