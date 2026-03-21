import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Award, Clock, Calendar, User, FileText } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'

interface AnswerDetail {
  questionId: string
  question: string
  questionType: string
  yourAnswer: string
  correctAnswer: string
  isCorrect: boolean
  pointsEarned: number
  pointsPossible: number
  explanation: string
}

interface Attempt {
  id: string
  quizId: string
  quizTitle: string
  quizDescription: string
  teacherName: string
  teacherEmail: string
  quizKey: string
  score: number
  totalPoints: number
  percentage: number
  passed: boolean
  timeSpent: number
  submittedAt: string
  passingScore: number
}

const QuizAttemptDetailsPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading: authLoading, token } = useAuthStore()
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [answers, setAnswers] = useState<AnswerDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (location.pathname !== `/quiz/attempt/${attemptId}`) {
      setIsLoading(false)
      return
    }

    if (authLoading) {
      return
    }

    if (!user) {
      navigate('/login', { replace: true })
      setIsLoading(false)
      return
    }

    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    if (attemptId) {
      fetchAttemptDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, user, location.pathname, authLoading, token])

  const fetchAttemptDetails = async () => {
    if (!attemptId) return

    setIsLoading(true)
    try {
      const response = await api.get(`/quiz/student/attempt/${attemptId}`)
      setAttempt(response.data.data.attempt)
      setAnswers(response.data.data.answers || [])
    } catch (error) {
      console.error('Error fetching quiz attempt details:', error)
      handleApiError(error)
      navigate('/quiz/history')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}m ${secs}s`
    }
    return `${secs}s`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Quiz Attempt Not Found</h2>
          <button onClick={() => navigate('/quiz/history')} className="btn btn-primary">
            Back to Quiz History
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/quiz/history')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Quiz History
          </button>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{attempt.quizTitle}</h1>
                {attempt.quizDescription && (
                  <p className="text-gray-600">{attempt.quizDescription}</p>
                )}
              </div>
              <div className={`inline-block p-3 rounded-full ${
                attempt.passed ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {attempt.passed ? (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <span>
                  <span className="font-medium">Teacher:</span> {attempt.teacherName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Award className="w-4 h-4 text-gray-400" />
                <span>
                  <span className="font-medium">Score:</span>{' '}
                  <span className={`font-bold ${
                    attempt.passed ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {attempt.percentage}%
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>
                  <span className="font-medium">Time:</span> {formatTime(attempt.timeSpent)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>
                  <span className="font-medium">Date:</span> {formatDate(attempt.submittedAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 pt-4 border-t border-gray-200">
              <span>
                <span className="font-medium">Points:</span> {attempt.score} / {attempt.totalPoints}
              </span>
              <span>
                <span className="font-medium">Passing Score:</span> {attempt.passingScore}%
              </span>
              {attempt.quizKey && (
                <span>
                  <span className="font-medium">Quiz Key:</span>{' '}
                  <span className="font-mono">{attempt.quizKey}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Questions and Answers */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Question Review</h2>
          {answers.map((answer, index) => (
            <div
              key={answer.questionId}
              className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
                answer.isCorrect ? 'border-green-500' : 'border-red-500'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-gray-900">
                    Question {index + 1}
                  </span>
                  {answer.isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {answer.pointsEarned} / {answer.pointsPossible} points
                </span>
              </div>

              <p className="text-gray-900 mb-4 font-medium">{answer.question}</p>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Your Answer:</p>
                  <div className={`p-3 rounded-lg ${
                    answer.isCorrect
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <p className={`font-medium ${
                      answer.isCorrect ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {answer.yourAnswer}
                    </p>
                  </div>
                </div>

                {!answer.isCorrect && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Correct Answer:</p>
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                      <p className="font-medium text-green-900">{answer.correctAnswer}</p>
                    </div>
                  </div>
                )}

                {answer.explanation && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Explanation:</p>
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-sm text-gray-700 italic">{answer.explanation}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Questions</p>
              <p className="text-2xl font-bold text-gray-900">{answers.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Correct</p>
              <p className="text-2xl font-bold text-green-600">
                {answers.filter(a => a.isCorrect).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Incorrect</p>
              <p className="text-2xl font-bold text-red-600">
                {answers.filter(a => !a.isCorrect).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Accuracy</p>
              <p className="text-2xl font-bold text-primary-600">
                {answers.length > 0
                  ? Math.round((answers.filter(a => a.isCorrect).length / answers.length) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuizAttemptDetailsPage

