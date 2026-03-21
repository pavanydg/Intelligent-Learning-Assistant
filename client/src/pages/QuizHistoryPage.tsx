import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Award, Clock, CheckCircle, XCircle, TrendingUp, User, Calendar, FileText, Eye } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'

interface QuizHistoryItem {
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

interface QuizHistoryStats {
  totalAttempts: number
  passedCount: number
  averageScore: number
}

const QuizHistoryPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading: authLoading, token } = useAuthStore()
  const [history, setHistory] = useState<QuizHistoryItem[]>([])
  const [stats, setStats] = useState<QuizHistoryStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (location.pathname !== '/quiz/history') {
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

    fetchQuizHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname, authLoading, token])

  const fetchQuizHistory = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/quiz/student/history')
      setHistory(response.data.data.history || [])
      setStats(response.data.data)
    } catch (error) {
      console.error('Error fetching quiz history:', error)
      handleApiError(error)
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
      month: 'short',
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

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/quiz')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Quiz Center
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Quiz History</h1>
          <p className="text-lg text-gray-600">
            Track all the quizzes you've completed
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Attempts</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalAttempts}</p>
                </div>
                <FileText className="w-12 h-12 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Passed</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.passedCount}</p>
                </div>
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Average Score</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.averageScore}%</p>
                </div>
                <TrendingUp className="w-12 h-12 text-purple-500" />
              </div>
            </div>
          </div>
        )}

        {/* Quiz History List */}
        {history.length > 0 ? (
          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${
                  item.passed ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{item.quizTitle}</h3>
                      {item.passed ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          Failed
                        </span>
                      )}
                    </div>
                    
                    {item.quizDescription && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {item.quizDescription}
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>
                          <span className="font-medium">Teacher:</span> {item.teacherName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Award className="w-4 h-4 text-gray-400" />
                        <span>
                          <span className="font-medium">Score:</span>{' '}
                          <span className={`font-bold ${
                            item.passed ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {item.score} / {item.totalPoints} ({item.percentage}%)
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>
                          <span className="font-medium">Time:</span> {formatTime(item.timeSpent)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>
                          <span className="font-medium">Date:</span> {formatDate(item.submittedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>
                          Passing Score: {item.passingScore}%
                        </span>
                        {item.quizKey && (
                          <span>
                            Quiz Key: <span className="font-mono">{item.quizKey}</span>
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/quiz/attempt/${item.id}`)}
                        className="btn btn-sm btn-primary"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Quiz History Yet</h3>
            <p className="text-gray-600 mb-6">
              You haven't completed any quizzes yet. Start by accessing a quiz using a key from your teacher.
            </p>
            <button
              onClick={() => navigate('/quiz')}
              className="btn btn-primary"
            >
              Go to Quiz Center
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuizHistoryPage

