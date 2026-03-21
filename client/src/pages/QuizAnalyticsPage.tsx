import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Users, TrendingUp, Award, BarChart3, Target, Eye, Key, Copy, Check, Download, FileSpreadsheet } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'
import { exportToExcel, exportToCSV, exportMultipleSheets, formatDateForExport } from '../utils/exportUtils'

interface Quiz {
  id: string
  title: string
  totalPoints: number
  passingScore: number
  totalQuestions: number
}

interface Statistics {
  totalAttempts: number
  uniqueStudents: number
  averageScore: number
  passRate: number
}

interface QuestionStat {
  questionId: string
  question: string
  correctCount: number
  totalAttempts: number
  accuracy: number
}

interface Student {
  userId: string
  name: string
  email: string
  college?: string
  department?: string
  attempts: Array<{
    id: string
    score: number
    percentage: number
    passed: boolean
    timeSpent: number
    submittedAt: string
  }>
  bestScore: number
  averageScore: number
  totalAttempts: number
}

interface QuizKey {
  id: string
  key: string
  description: string
  usageCount: number
  createdAt: string
}

const QuizAnalyticsPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading: authLoading, token } = useAuthStore()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [quizKeys, setQuizKeys] = useState<QuizKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedQuizKey, setSelectedQuizKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  useEffect(() => {
    if (location.pathname !== `/quiz/${quizId}/analytics`) {
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

    if (user.role !== 'instructor' && user.role !== 'admin') {
      navigate('/quiz', { replace: true })
      setIsLoading(false)
      return
    }

    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    if (quizId) {
      fetchAnalytics()
      fetchQuizKeys()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, user, location.pathname, authLoading, token])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportMenu && !(event.target as Element).closest('.export-menu-container')) {
        setShowExportMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  const fetchAnalytics = async () => {
    if (!quizId) return

    setIsLoading(true)
    try {
      const response = await api.get(`/quiz/teacher/${quizId}/analytics`)
      setQuiz(response.data.data.quiz)
      setStatistics(response.data.data.statistics)
      setQuestionStats(response.data.data.questionStats || [])
      setStudents(response.data.data.students || [])
    } catch (error) {
      console.error('Error fetching quiz analytics:', error)
      handleApiError(error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchQuizKeys = async () => {
    if (!quizId) return
    try {
      const response = await api.get('/quiz/teacher/keys')
      const keysForThisQuiz = (response.data.data.quizKeys || []).filter(
        (k: any) => k.quizId === quizId
      )
      setQuizKeys(keysForThisQuiz)
    } catch (error) {
      console.error('Error fetching quiz keys:', error)
    }
  }

  const handleGenerateKey = async () => {
    if (!quizId) return

    try {
      const response = await api.post('/quiz/teacher/generate-key', {
        quizId,
        description: ''
      })
      setSelectedQuizKey(response.data.data.key)
      toast.success('Quiz key generated successfully!')
      fetchQuizKeys()
    } catch (error) {
      console.error('Error generating quiz key:', error)
      handleApiError(error)
    }
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    toast.success('Quiz key copied to clipboard!')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleExportExcel = () => {
    if (!quiz || !statistics || students.length === 0) {
      toast.error('No data to export')
      return
    }

    try {
      // Prepare data for export
      const sheets = [
        {
          name: 'Summary',
          data: [
            { Metric: 'Quiz Title', Value: quiz.title },
            { Metric: 'Total Questions', Value: quiz.totalQuestions },
            { Metric: 'Total Points', Value: quiz.totalPoints },
            { Metric: 'Passing Score', Value: `${quiz.passingScore}%` },
            { Metric: '', Value: '' },
            { Metric: 'Total Attempts', Value: statistics.totalAttempts },
            { Metric: 'Unique Students', Value: statistics.uniqueStudents },
            { Metric: 'Average Score', Value: `${Math.round(statistics.averageScore)}%` },
            { Metric: 'Pass Rate', Value: `${Math.round(statistics.passRate)}%` }
          ]
        },
        {
          name: 'Students Summary',
          data: students.map(student => ({
            'Student Name': student.name,
            'Email': student.email,
            'College': student.college || '',
            'Department': student.department || '',
            'Total Attempts': student.totalAttempts,
            'Best Score (%)': Math.round(student.bestScore),
            'Average Score (%)': Math.round(student.averageScore),
            'Status': student.bestScore >= quiz.passingScore ? 'Passed' : 'Not Passed',
            'Passing Score Required': `${quiz.passingScore}%`
          }))
        },
        {
          name: 'Question Performance',
          data: questionStats.map((qStat, index) => ({
            'Question #': index + 1,
            'Question': qStat.question,
            'Correct Answers': qStat.correctCount,
            'Total Attempts': qStat.totalAttempts,
            'Accuracy (%)': Math.round(qStat.accuracy)
          }))
        }
      ]

      // Add detailed attempts if available
      if (students.length > 0) {
        const attemptsData: any[] = []
        students.forEach(student => {
          student.attempts.forEach(attempt => {
            attemptsData.push({
              'Student Name': student.name,
              'Email': student.email,
              'Score': attempt.score,
              'Percentage (%)': Math.round(attempt.percentage),
              'Status': attempt.passed ? 'Passed' : 'Failed',
              'Time Spent (seconds)': attempt.timeSpent,
              'Submitted At': formatDateForExport(attempt.submittedAt)
            })
          })
        })
        
        if (attemptsData.length > 0) {
          sheets.push({
            name: 'All Attempts',
            data: attemptsData
          })
        }
      }

      const filename = `Quiz_Analytics_${quiz.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}`
      exportMultipleSheets(sheets, filename)
      toast.success('Analytics exported to Excel successfully!')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export analytics')
    }
  }

  const handleExportCSV = () => {
    if (!quiz || !statistics || students.length === 0) {
      toast.error('No data to export')
      return
    }

    try {
      // Export detailed attempts as CSV
      const allAttempts: any[] = []
      students.forEach(student => {
        if (student.attempts && student.attempts.length > 0) {
          student.attempts.forEach((attempt, index) => {
            allAttempts.push({
              'Student Name': student.name,
              'Email': student.email,
              'College': student.college || '',
              'Department': student.department || '',
              'Attempt #': index + 1,
              'Score': attempt.score,
              'Percentage (%)': Math.round(attempt.percentage),
              'Status': attempt.passed ? 'Passed' : 'Failed',
              'Time Spent (seconds)': attempt.timeSpent,
              'Submitted At': formatDateForExport(attempt.submittedAt),
              'Total Attempts': student.totalAttempts,
              'Best Score (%)': Math.round(student.bestScore),
              'Average Score (%)': Math.round(student.averageScore),
              'Passing Score Required': `${quiz.passingScore}%`
            })
          })
        } else {
          // Include students with no attempts
          allAttempts.push({
            'Student Name': student.name,
            'Email': student.email,
            'College': student.college || '',
            'Department': student.department || '',
            'Attempt #': 'N/A',
            'Score': '0',
            'Percentage (%)': '0',
            'Status': 'No Attempts',
            'Time Spent (seconds)': '0',
            'Submitted At': 'N/A',
            'Total Attempts': student.totalAttempts,
            'Best Score (%)': Math.round(student.bestScore),
            'Average Score (%)': Math.round(student.averageScore),
            'Passing Score Required': `${quiz.passingScore}%`
          })
        }
      })

      const filename = `Quiz_Analytics_${quiz.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}`
      exportToCSV(allAttempts.length > 0 ? allAttempts : students.map(student => ({
        'Student Name': student.name,
        'Email': student.email,
        'College': student.college || '',
        'Department': student.department || '',
        'Total Attempts': student.totalAttempts,
        'Best Score (%)': Math.round(student.bestScore),
        'Average Score (%)': Math.round(student.averageScore),
        'Status': student.bestScore >= quiz.passingScore ? 'Passed' : 'Not Passed',
        'Passing Score Required': `${quiz.passingScore}%`
      })), filename)
      toast.success('Analytics exported to CSV successfully!')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export analytics')
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!quiz || !statistics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Quiz Not Found</h2>
          <button onClick={() => navigate('/quiz')} className="btn btn-primary">
            Back to Quizzes
          </button>
        </div>
      </div>
    )
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
            Back to Quizzes
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{quiz.totalQuestions} questions</span>
                <span>•</span>
                <span>{quiz.totalPoints} total points</span>
                <span>•</span>
                <span>Passing: {quiz.passingScore}%</span>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="relative export-menu-container">
                <button
                  className="btn btn-outline"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  title="Export Analytics"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Export
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl py-2 z-50 border border-gray-200 animate-fade-in-up">
                    <button
                      onClick={() => {
                        handleExportExcel()
                        setShowExportMenu(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-600" />
                      <span>Export to Excel</span>
                    </button>
                    <button
                      onClick={() => {
                        handleExportCSV()
                        setShowExportMenu(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                      <span>Export to CSV</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleGenerateKey}
                className="btn btn-primary"
              >
                <Key className="w-5 h-5 mr-2" />
                Generate Key
              </button>
            </div>
          </div>
          {selectedQuizKey && (
            <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-700 font-medium mb-1">Quiz Key Generated:</p>
                <p className="text-lg font-mono font-bold text-primary-900">{selectedQuizKey}</p>
              </div>
              <button
                onClick={() => handleCopyKey(selectedQuizKey)}
                className="btn btn-sm btn-outline"
              >
                {copiedKey === selectedQuizKey ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          {/* Quiz Keys List */}
          {quizKeys.length > 0 && (
            <div className="mt-4 bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Quiz Keys</h3>
              <div className="space-y-2">
                {quizKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Key className="w-4 h-4 text-gray-400" />
                      <span className="font-mono font-bold text-primary-600">{key.key}</span>
                      <span className="text-sm text-gray-500">
                        ({key.usageCount} student{key.usageCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyKey(key.key)}
                      className="btn btn-sm btn-outline"
                    >
                      {copiedKey === key.key ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Attempts</p>
                <p className="text-3xl font-bold text-gray-900">{statistics.totalAttempts}</p>
              </div>
              <Target className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Unique Students</p>
                <p className="text-3xl font-bold text-gray-900">{statistics.uniqueStudents}</p>
              </div>
              <Users className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Average Score</p>
                <p className="text-3xl font-bold text-gray-900">{Math.round(statistics.averageScore)}%</p>
              </div>
              <Award className="w-12 h-12 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pass Rate</p>
                <p className="text-3xl font-bold text-gray-900">{Math.round(statistics.passRate)}%</p>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Question Statistics */}
        {questionStats.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Question Performance</h2>
            <div className="space-y-4">
              {questionStats.map((qStat, index) => (
                <div key={qStat.questionId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-gray-900">
                      Q{index + 1}: {qStat.question}
                    </p>
                    <span className={`text-sm font-medium ${
                      qStat.accuracy >= 70 ? 'text-green-600' :
                      qStat.accuracy >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {Math.round(qStat.accuracy)}% accuracy
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {qStat.correctCount} / {qStat.totalAttempts} students answered correctly
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Students List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Student Performance ({students.length})
          </h2>
          {students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Student</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Attempts</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Best Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.userId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{student.name}</p>
                          <p className="text-sm text-gray-500">{student.email}</p>
                          {student.college && (
                            <p className="text-xs text-gray-400 mt-1">
                              {student.college}
                              {student.department && ` • ${student.department}`}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm font-medium text-gray-900">
                          {student.totalAttempts}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-sm font-medium ${
                          student.bestScore >= quiz.passingScore ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {Math.round(student.bestScore)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-sm font-medium ${
                          student.averageScore >= quiz.passingScore ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {Math.round(student.averageScore)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {student.bestScore >= quiz.passingScore ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Not Passed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-600 py-8">No students have attempted this quiz yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default QuizAnalyticsPage

