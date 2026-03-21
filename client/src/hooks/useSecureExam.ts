import { useEffect, useRef, useState } from 'react'

interface UseSecureExamOptions {
  onTerminate: () => void
  enabled?: boolean
}

interface UseSecureExamReturn {
  violationCount: number
  isSecureModeActive: boolean
  exitSecureMode: () => void
}

/**
 * Custom hook for secure exam mode
 * Enforces fullscreen, detects tab switches, and blocks copy/paste/shortcuts
 */
export const useSecureExam = ({
  onTerminate,
  enabled = true
}: UseSecureExamOptions): UseSecureExamReturn => {
  const [violationCount, setViolationCount] = useState(0)
  const [isSecureModeActive, setIsSecureModeActive] = useState(false)
  const violationCountRef = useRef(0)
  const isTerminatedRef = useRef(false)
  const onTerminateRef = useRef(onTerminate)
  
  // Keep onTerminate ref up to date
  useEffect(() => {
    onTerminateRef.current = onTerminate
  }, [onTerminate])

  // Request fullscreen on mount
  const requestFullscreen = async () => {
    try {
      const element = document.documentElement
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if ((element as any).webkitRequestFullscreen) {
        // Safari
        await (element as any).webkitRequestFullscreen()
      } else if ((element as any).mozRequestFullScreen) {
        // Firefox
        await (element as any).mozRequestFullScreen()
      } else if ((element as any).msRequestFullscreen) {
        // IE/Edge
        await (element as any).msRequestFullscreen()
      }
      setIsSecureModeActive(true)
    } catch (error) {
      console.error('Error requesting fullscreen:', error)
      // If fullscreen fails, still activate secure mode
      setIsSecureModeActive(true)
    }
  }

  // Check if currently in fullscreen
  const isFullscreen = (): boolean => {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    )
  }

  // Handle violation
  const handleViolation = (reason: string) => {
    if (isTerminatedRef.current) return

    violationCountRef.current += 1
    const newCount = violationCountRef.current
    setViolationCount(newCount)

    if (newCount === 1) {
      // First violation - show warning
      alert(`⚠️ Warning: ${reason}\n\nThis is your first violation. One more violation will terminate the test.`)
    } else if (newCount >= 2) {
      // Second violation - terminate
      isTerminatedRef.current = true
      setIsSecureModeActive(false)
      onTerminateRef.current()
    }
  }

  // Exit secure mode cleanly
  const exitSecureMode = () => {
    isTerminatedRef.current = true
    setIsSecureModeActive(false)

    // Exit fullscreen if active
    if (isFullscreen()) {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen()
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen()
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen()
      }
    }
  }

  useEffect(() => {
    if (!enabled) return

    // Request fullscreen on mount
    requestFullscreen()

    // Fullscreen change handler
    const handleFullscreenChange = () => {
      if (!isTerminatedRef.current && !isFullscreen()) {
        handleViolation('You exited fullscreen mode')
      }
    }

    // Tab/window blur handler
    const handleBlur = () => {
      if (!isTerminatedRef.current) {
        handleViolation('You switched tabs or windows')
      }
    }

    // Visibility change handler (more reliable for tab switching)
    const handleVisibilityChange = () => {
      if (!isTerminatedRef.current && document.hidden) {
        handleViolation('You switched tabs or windows')
      }
    }

    // Prevent copy
    const handleCopy = (e: ClipboardEvent) => {
      if (!isTerminatedRef.current) {
        e.preventDefault()
        handleViolation('Copy action is not allowed')
      }
    }

    // Prevent paste
    const handlePaste = (e: ClipboardEvent) => {
      if (!isTerminatedRef.current) {
        e.preventDefault()
        handleViolation('Paste action is not allowed')
      }
    }

    // Prevent cut
    const handleCut = (e: ClipboardEvent) => {
      if (!isTerminatedRef.current) {
        e.preventDefault()
        handleViolation('Cut action is not allowed')
      }
    }

    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      if (!isTerminatedRef.current) {
        e.preventDefault()
        handleViolation('Right-click is not allowed')
      }
    }

    // Prevent keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTerminatedRef.current) return

      // Block Ctrl/Cmd + C (Copy)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        handleViolation('Copy shortcut (Ctrl+C) is not allowed')
        return
      }

      // Block Ctrl/Cmd + V (Paste)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        handleViolation('Paste shortcut (Ctrl+V) is not allowed')
        return
      }

      // Block Ctrl/Cmd + X (Cut)
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault()
        handleViolation('Cut shortcut (Ctrl+X) is not allowed')
        return
      }

      // Block Ctrl/Cmd + A (Select All)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        handleViolation('Select All shortcut (Ctrl+A) is not allowed')
        return
      }

      // Block Ctrl/Cmd + S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleViolation('Save shortcut (Ctrl+S) is not allowed')
        return
      }

      // Block Ctrl/Cmd + P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        handleViolation('Print shortcut (Ctrl+P) is not allowed')
        return
      }

      // Block F12 (Developer Tools)
      if (e.key === 'F12') {
        e.preventDefault()
        handleViolation('Developer Tools (F12) is not allowed')
        return
      }

      // Block Ctrl/Cmd + Shift + I (Developer Tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        handleViolation('Developer Tools shortcut is not allowed')
        return
      }

      // Block Ctrl/Cmd + Shift + C (Inspect Element)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        handleViolation('Inspect Element shortcut is not allowed')
        return
      }

      // Block Ctrl/Cmd + Shift + J (Console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault()
        handleViolation('Console shortcut is not allowed')
        return
      }

      // Block PrintScreen (Note: This may not work in all browsers)
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault()
        handleViolation('PrintScreen is not allowed')
        return
      }
    }

    // Prevent text selection (optional - can be too restrictive)
    const handleSelectStart = (e: Event) => {
      // Allow selection for input fields and textareas
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }
      // For other elements, we'll allow selection but block copy
    }

    // Add event listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('cut', handleCut)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('selectstart', handleSelectStart)

    // Cleanup function
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('selectstart', handleSelectStart)

      // Exit fullscreen on unmount if still active
      if (isFullscreen() && !isTerminatedRef.current) {
        exitSecureMode()
      }
    }
  }, [enabled])

  return {
    violationCount,
    isSecureModeActive,
    exitSecureMode
  }
}

