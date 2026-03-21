import React, { useImperativeHandle, forwardRef } from 'react'
import { Shield, AlertTriangle } from 'lucide-react'
import { useSecureExam } from '../hooks/useSecureExam'

interface SecureExamWrapperProps {
  onTerminate?: () => void
  children: React.ReactNode
  enabled?: boolean
}

export interface SecureExamWrapperRef {
  exitSecureMode: () => void
}

/**
 * Wrapper component that enables secure exam mode
 * Displays a notice and activates fullscreen + protection
 */
const SecureExamWrapper = forwardRef<SecureExamWrapperRef, SecureExamWrapperProps>(({
  onTerminate = () => {},
  children,
  enabled = true
}, ref) => {
  const { violationCount, isSecureModeActive, exitSecureMode } = useSecureExam({
    onTerminate,
    enabled
  })

  // Expose exit function via ref
  useImperativeHandle(ref, () => ({
    exitSecureMode
  }), [exitSecureMode])

  // Also expose via window for backward compatibility
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__exitSecureExamMode = exitSecureMode
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__exitSecureExamMode
      }
    }
  }, [exitSecureMode])

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <div className="secure-exam-mode">
      {/* Secure Mode Notice Banner */}
      {isSecureModeActive && (
        <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-center gap-2 ${
          violationCount >= 1 ? 'bg-yellow-500 text-yellow-900' : 'bg-blue-600 text-white'
        }`}>
          <Shield className="w-5 h-5" />
          <span className="font-semibold text-sm">
            🧠 Secure Exam Mode Active
            {violationCount >= 1 && (
              <span className="ml-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Warning: {violationCount} violation{violationCount !== 1 ? 's' : ''} detected
              </span>
            )}
          </span>
        </div>
      )}

      {/* Content with top padding to account for banner */}
      <div className={isSecureModeActive ? 'pt-10' : ''}>
        {children}
      </div>
    </div>
  )
})

SecureExamWrapper.displayName = 'SecureExamWrapper'

export default SecureExamWrapper

