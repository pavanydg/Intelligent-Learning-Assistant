import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Key, Plus, Search, BookOpen, Users, TrendingUp, Award, Eye, Clock, Copy, Check, FileText, History, Calendar, XCircle, Sparkles, Upload, Loader2, Edit2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'

interface Quiz {
  id: string
  title: string
  description: string
  totalPoints: number
  timeLimit: number
  passingScore: number
  isActive: boolean
  attemptCount: number
  keyCount: number
  createdAt: string
}

interface QuizKey {
  id: string
  key: string
  quizId: string
  quizTitle: string
  description: string
  isActive: boolean
  usageCount: number
  expiresAt: string | null
  createdAt: string
}

const QuizPage: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [quizKeys, setQuizKeys] = useState<QuizKey[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'quizzes' | 'keys'>('quizzes')
  const [studentActiveTab, setStudentActiveTab] = useState<'access' | 'history'>('access')
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [showGenerateKeyModal, setShowGenerateKeyModal] = useState(false)
  const [keyDescription, setKeyDescription] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [quizHistory, setQuizHistory] = useState<any[]>([])
  const [historyStats, setHistoryStats] = useState<any>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [showGenerateQuestionsModal, setShowGenerateQuestionsModal] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    description: '',
    numQuestions: 5,
    difficulty: 'intermediate',
    notesFile: null as File | null
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([])
  const [showReviewModal, setShowReviewModal] = useState(false)
  const { user, isLoading: authLoading, token } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const isTeacher = user?.role === 'instructor' || user?.role === 'admin'

  useEffect(() => {
    if (location.pathname !== '/quiz') {
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

    if (isTeacher) {
      fetchQuizzes()
      fetchQuizKeys()
    } else {
      fetchQuizHistory()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname, authLoading, token, isTeacher])

  const fetchQuizzes = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/quiz/teacher/quizzes')
      setQuizzes(response.data.data.quizzes || [])
    } catch (error) {
      console.error('Error fetching quizzes:', error)
      handleApiError(error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchQuizKeys = async () => {
    try {
      const response = await api.get('/quiz/teacher/keys')
      setQuizKeys(response.data.data.quizKeys || [])
    } catch (error) {
      console.error('Error fetching quiz keys:', error)
      handleApiError(error)
    }
  }

  const handleGenerateKey = async () => {
    if (!selectedQuiz) return

    try {
      const response = await api.post('/quiz/teacher/generate-key', {
        quizId: selectedQuiz.id,
        description: keyDescription
      })
      
      toast.success('Quiz key generated successfully!')
      setShowGenerateKeyModal(false)
      setSelectedQuiz(null)
      setKeyDescription('')
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

  const handleQuizClick = (quiz: Quiz) => {
    // Always navigate to analytics when clicking quiz card
    navigate(`/quiz/${quiz.id}/analytics`)
  }

  const fetchQuizHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const response = await api.get('/quiz/student/history')
      setQuizHistory(response.data.data.history || [])
      setHistoryStats(response.data.data)
    } catch (error) {
      console.error('Error fetching quiz history:', error)
      handleApiError(error)
    } finally {
      setIsLoadingHistory(false)
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Quiz Center</h1>
          <p className="text-lg text-gray-600">
            {isTeacher 
              ? 'Create quizzes, generate keys, and analyze student performance'
              : 'Access quizzes using keys provided by your teacher'}
          </p>
        </div>

        {isTeacher ? (
          <>
            {/* Tabs */}
            <div className="mb-6 flex gap-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('quizzes')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'quizzes'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BookOpen className="w-4 h-4 inline mr-2" />
                My Quizzes ({quizzes.length})
              </button>
              <button
                onClick={() => setActiveTab('keys')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'keys'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Key className="w-4 h-4 inline mr-2" />
                Quiz Keys ({quizKeys.filter(k => k.isActive).length})
              </button>
            </div>

            {activeTab === 'quizzes' ? (
              <>
                <div className="mb-6 flex justify-end gap-3">
                  <button
                    onClick={() => navigate('/quiz/create')}
                    className="btn btn-primary"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create New Quiz
                  </button>
                </div>

                {quizzes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleQuizClick(quiz)}
                      >
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {quiz.title}
                        </h3>
                        {quiz.description && (
                          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                            {quiz.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <span className="flex items-center gap-1">
                            <Award className="w-4 h-4" />
                            {quiz.totalPoints} points
                          </span>
                          {quiz.timeLimit > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {quiz.timeLimit} min
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {quiz.attemptCount} attempts
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              className="btn btn-sm btn-outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/quiz/edit/${quiz.id}`)
                              }}
                              title="Edit Quiz"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              className="btn btn-sm btn-primary"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedQuiz(quiz)
                                setShowGenerateKeyModal(true)
                              }}
                            >
                              <Key className="w-4 h-4 mr-1" />
                              Generate Key
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Quizzes Yet</h3>
                    <p className="text-gray-600 mb-6">
                      Create your first quiz to get started
                    </p>
                    <button
                      onClick={() => navigate('/quiz/create')}
                      className="btn btn-primary"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Quiz
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Quiz Keys List */}
                {quizKeys.length > 0 ? (
                  <div className="space-y-4">
                    {quizKeys.map((quizKey) => (
                      <div
                        key={quizKey.id}
                        className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {quizKey.quizTitle}
                            </h3>
                            {quizKey.description && (
                              <p className="text-sm text-gray-600 mb-3">{quizKey.description}</p>
                            )}
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-mono font-bold text-primary-600">
                                  {quizKey.key}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopyKey(quizKey.key)
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  {copiedKey === quizKey.key ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-gray-400" />
                                  )}
                                </button>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Users className="w-4 h-4" />
                                <span>{quizKey.usageCount} student{quizKey.usageCount !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="text-sm text-gray-500">
                                Created: {new Date(quizKey.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(`/quiz/${quizKey.quizId}/analytics`)}
                            className="btn btn-sm btn-primary"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Analytics
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <Key className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Quiz Keys Yet</h3>
                    <p className="text-gray-600 mb-6">
                      Create a quiz and generate a key to share with your students
                    </p>
                    <button
                      onClick={() => navigate('/quiz/create')}
                      className="btn btn-primary"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Quiz
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Generate Questions Modal */}
            {showGenerateQuestionsModal && (
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowGenerateQuestionsModal(false)}></div>
                  <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Generate Questions with AI</h3>
                        <button onClick={() => setShowGenerateQuestionsModal(false)} className="text-gray-400 hover:text-gray-500">
                          <XCircle className="w-6 h-6" />
                        </button>
                      </div>
                      <form onSubmit={async (e) => {
                        e.preventDefault()
                        if (!generateForm.description.trim()) {
                          toast.error('Please enter a description')
                          return
                        }
                        setIsGenerating(true)
                        try {
                          const formData = new FormData()
                          formData.append('description', generateForm.description)
                          formData.append('numQuestions', generateForm.numQuestions.toString())
                          formData.append('difficulty', generateForm.difficulty)
                          if (generateForm.notesFile) {
                            formData.append('notes', generateForm.notesFile)
                          }
                          const response = await api.post('/quiz/generate-questions', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          })
                          if (response.data.success) {
                            setGeneratedQuestions(response.data.data.questions)
                            setShowGenerateQuestionsModal(false)
                            setShowReviewModal(true)
                            toast.success(`Generated ${response.data.data.totalQuestions} questions!`)
                          }
                        } catch (error) {
                          handleApiError(error)
                        } finally {
                          setIsGenerating(false)
                        }
                      }}>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Topic/Description *</label>
                            <textarea
                              value={generateForm.description}
                              onChange={(e) => setGenerateForm({ ...generateForm, description: e.target.value })}
                              placeholder="e.g., Python strings, Data structures, Calculus basics..."
                              className="input w-full h-24"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Questions *</label>
                              <input
                                type="number"
                                min="1"
                                max="50"
                                value={generateForm.numQuestions}
                                onChange={(e) => setGenerateForm({ ...generateForm, numQuestions: parseInt(e.target.value) || 5 })}
                                className="input w-full"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty Level *</label>
                              <select
                                value={generateForm.difficulty}
                                onChange={(e) => setGenerateForm({ ...generateForm, difficulty: e.target.value })}
                                className="input w-full"
                                required
                              >
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Notes (Optional)</label>
                            <label className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                              {generateForm.notesFile ? (
                                <div className="text-center">
                                  <FileText className="w-8 h-8 mx-auto text-primary-600 mb-2" />
                                  <p className="text-sm text-gray-600">{generateForm.notesFile.name}</p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      setGenerateForm({ ...generateForm, notesFile: null })
                                    }}
                                    className="text-xs text-red-600 mt-1"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-600">Click to upload PDF or text file</p>
                                  <p className="text-xs text-gray-500">PDF, TXT (max 10MB)</p>
                                </div>
                              )}
                              <input
                                type="file"
                                accept=".pdf,.txt"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    if (file.size > 10 * 1024 * 1024) {
                                      toast.error('File size must be less than 10MB')
                                      return
                                    }
                                    setGenerateForm({ ...generateForm, notesFile: file })
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setShowGenerateQuestionsModal(false)}
                            className="btn btn-outline"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isGenerating}
                            className="btn btn-primary"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Generate Questions
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Review Generated Questions Modal */}
            {showReviewModal && generatedQuestions.length > 0 && (
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowReviewModal(false)}></div>
                  <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[80vh] overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Review Generated Questions ({generatedQuestions.length})</h3>
                        <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-500">
                          <XCircle className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="space-y-4 mb-6">
                        {generatedQuestions.map((q, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
                              <span className="text-xs text-gray-500">{q.points || 1} point{q.points !== 1 ? 's' : ''}</span>
                            </div>
                            <p className="text-gray-700 mb-3">{q.question}</p>
                            <div className="space-y-1 mb-3">
                              {q.options.map((opt: any, optIndex: number) => (
                                <div key={optIndex} className={`flex items-center gap-2 p-2 rounded ${opt.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                                  <span className="font-medium text-gray-600">{String.fromCharCode(65 + optIndex)}.</span>
                                  <span className={opt.isCorrect ? 'text-green-700 font-medium' : 'text-gray-700'}>{opt.text}</span>
                                  {opt.isCorrect && <Check className="w-4 h-4 text-green-600 ml-auto" />}
                                </div>
                              ))}
                            </div>
                            {q.explanation && (
                              <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-gray-700">
                                <span className="font-medium">Explanation: </span>{q.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => {
                            setShowReviewModal(false)
                            setGeneratedQuestions([])
                          }}
                          className="btn btn-outline"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            navigate('/quiz/create', {
                              state: { generatedQuestions }
                            })
                          }}
                          className="btn btn-primary"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Quiz with These Questions
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Key Modal */}
            {showGenerateKeyModal && selectedQuiz && (
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4">
                  <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowGenerateKeyModal(false)}></div>
                  <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate Quiz Key</h2>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Quiz:</p>
                      <p className="font-medium text-gray-900">{selectedQuiz.title}</p>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description (Optional)
                      </label>
                      <textarea
                        value={keyDescription}
                        onChange={(e) => setKeyDescription(e.target.value)}
                        placeholder="e.g., Midterm Exam - Spring 2024"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => {
                          setShowGenerateKeyModal(false)
                          setSelectedQuiz(null)
                          setKeyDescription('')
                        }}
                        className="btn btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleGenerateKey}
                        className="btn btn-primary"
                      >
                        <Key className="w-4 h-4 mr-2" />
                        Generate Key
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Student View - Tabs */}
            <div className="mb-6 flex gap-4 border-b border-gray-200">
              <button
                onClick={() => setStudentActiveTab('access')}
                className={`px-4 py-2 font-medium transition-colors ${
                  studentActiveTab === 'access'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Key className="w-4 h-4 inline mr-2" />
                Access Quiz
              </button>
              <button
                onClick={() => setStudentActiveTab('history')}
                className={`px-4 py-2 font-medium transition-colors ${
                  studentActiveTab === 'history'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <History className="w-4 h-4 inline mr-2" />
                My History ({quizHistory.length})
              </button>
            </div>

            {studentActiveTab === 'access' ? (
              <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl mx-auto">
              <div className="text-center mb-6">
                <Key className="w-16 h-16 text-primary-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Quiz</h2>
                <p className="text-gray-600">
                  Enter the quiz key provided by your teacher to access the quiz
                </p>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const key = formData.get('key') as string
                  if (key) {
                    try {
                      const response = await api.get(`/quiz/key/${key.toUpperCase()}`)
                      navigate(`/quiz/take/${response.data.data.quiz.id}`, {
                        state: {
                          quiz: response.data.data.quiz,
                          quizKey: response.data.data.quizKey,
                          existingAttempt: response.data.data.existingAttempt
                        }
                      })
                    } catch (error: any) {
                      const errorMessage = error.response?.data?.message || 'Invalid or expired quiz key'
                      toast.error(errorMessage)
                    }
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <input
                    type="text"
                    name="key"
                    placeholder="Enter quiz key (e.g., ABC12345)"
                    className="input w-full uppercase"
                    maxLength={8}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full">
                  <Key className="w-5 h-5 mr-2" />
                  Access Quiz
                </button>
              </form>
              </div>
            ) : (
              <>
                {/* Quiz History Tab */}
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  </div>
                ) : (
                  <>
                    {/* Stats Cards */}
                    {historyStats && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white rounded-lg shadow-md p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Total Attempts</p>
                              <p className="text-3xl font-bold text-gray-900">{historyStats.totalAttempts}</p>
                            </div>
                            <FileText className="w-12 h-12 text-blue-500" />
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Passed</p>
                              <p className="text-3xl font-bold text-gray-900">{historyStats.passedCount}</p>
                            </div>
                            <Award className="w-12 h-12 text-green-500" />
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Average Score</p>
                              <p className="text-3xl font-bold text-gray-900">{historyStats.averageScore}%</p>
                            </div>
                            <TrendingUp className="w-12 h-12 text-purple-500" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quiz History List */}
                    {quizHistory.length > 0 ? (
                      <div className="space-y-4">
                        {quizHistory.map((item) => (
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
                                      <Check className="w-3 h-3 mr-1" />
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
                                    <Users className="w-4 h-4 text-gray-400" />
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
                          onClick={() => setStudentActiveTab('access')}
                          className="btn btn-primary"
                        >
                          Access Quiz
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default QuizPage

