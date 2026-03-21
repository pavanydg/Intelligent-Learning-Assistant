import { useNavigate } from 'react-router-dom'
import { XCircle, AlertTriangle, Home } from 'lucide-react'

const QuizTerminatedPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {/* Error Icon */}
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6">
            <XCircle className="h-12 w-12 text-red-600" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Test Terminated
          </h1>

          {/* Warning Message */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 text-left">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 mb-2">
                  Violation Detected
                </p>
                <p className="text-sm text-yellow-700">
                  Your test has been terminated due to a violation of the exam rules. 
                  This may include:
                </p>
                <ul className="list-disc list-inside text-sm text-yellow-700 mt-2 space-y-1">
                  <li>Exiting fullscreen mode</li>
                  <li>Switching tabs or windows</li>
                  <li>Using copy/paste shortcuts</li>
                  <li>Right-clicking or using developer tools</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Information */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              If you believe this was an error, please contact your instructor or administrator.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/quiz')}
              className="flex-1 btn btn-primary"
            >
              Back to Quiz Center
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 btn btn-outline flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Go to Dashboard
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            For assistance, please contact your instructor or support team.
          </p>
        </div>
      </div>
    </div>
  )
}

export default QuizTerminatedPage

