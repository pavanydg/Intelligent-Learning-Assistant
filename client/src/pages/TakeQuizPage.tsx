import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'
import SecureExamWrapper, { SecureExamWrapperRef } from '../components/SecureExamWrapper'

interface Question {
  _id: string
  question: string
  type: 'multiple-choice' | 'true-false' | 'short-answer'
  options: Array<{ text: string }>
  points: number
}

interface Quiz {
  _id: string
  title: string
  description: string
  questions: Question[]
  totalPoints: number
  timeLimit: number
  passingScore: number
  scheduledStartTime?: string
  scheduledEndTime?: string
}

const TakeQuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token } = useAuthStore()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [startTime] = useState(Date.now())
  const [quizKey, setQuizKey] = useState<any>(null)
  const [secureModeEnabled, setSecureModeEnabled] = useState(true)
  const secureExamWrapperRef = useRef<SecureExamWrapperRef>(null)

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    // Get quiz from location state or fetch it
    if (location.state?.quiz) {
      setQuiz(location.state.quiz)
      setQuizKey(location.state.quizKey)
      if (location.state.quiz.timeLimit > 0) {
        setTimeRemaining(location.state.quiz.timeLimit * 60) // Convert to seconds
      }
    } else if (quizId) {
      fetchQuiz()
    }
  }, [quizId, location.state, token])

  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0 && quiz && quizKey) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            // Auto-submit when time runs out
            handleSubmit(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, quiz, quizKey])

  const fetchQuiz = async () => {
    try {
      const response = await api.get(`/quiz/${quizId}`)
      setQuiz(response.data.data.quiz)
      if (response.data.data.quiz.timeLimit > 0) {
        setTimeRemaining(response.data.data.quiz.timeLimit * 60)
      }
    } catch (error) {
      console.error('Error fetching quiz:', error)
      handleApiError(error)
      navigate('/quiz')
    }
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer })
  }

  const handleSubmit = async (autoSubmit = false) => {
    if (!quiz || !quizKey) return

    // Check if all questions are answered
    const unanswered = quiz.questions.filter(q => !answers[q._id])
    if (unanswered.length > 0 && !autoSubmit) {
      if (!confirm(`You have ${unanswered.length} unanswered question(s). Are you sure you want to submit?`)) {
        return
      }
    }

    // Exit secure mode before submitting
    if (secureExamWrapperRef.current) {
      secureExamWrapperRef.current.exitSecureMode()
      setSecureModeEnabled(false)
    }

    setIsSubmitting(true)
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000)
      const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer
      }))

      const response = await api.post('/quiz/submit', {
        quizId: quiz._id,
        quizKeyId: quizKey.id || quizKey._id,
        answers: answerArray,
        timeSpent
      })

      setResults(response.data.data)
      toast.success('Quiz submitted successfully!')
    } catch (error) {
      console.error('Error submitting quiz:', error)
      handleApiError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle secure mode termination
  const handleSecureModeTerminate = () => {
    setSecureModeEnabled(false)
    // Exit secure mode
    if (secureExamWrapperRef.current) {
      secureExamWrapperRef.current.exitSecureMode()
    }
    // Navigate to termination page
    navigate('/quiz/terminated', { replace: true })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (results) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className={`inline-block p-6 rounded-full mb-4 ${
              results.attempt.passed ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {results.attempt.passed ? (
                <CheckCircle className="w-16 h-16 text-green-600" />
              ) : (
                <XCircle className="w-16 h-16 text-red-600" />
              )}
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {results.attempt.passed ? 'Quiz Passed!' : 'Quiz Completed'}
            </h2>
            <div className="text-5xl font-bold text-primary-600 mb-2">
              {results.attempt.percentage}%
            </div>
            <p className="text-gray-600 mb-6">
              Score: {results.attempt.score} / {results.attempt.totalPoints} points
            </p>

            {results.answers && (
              <div className="mt-8 text-left space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">Question Review</h3>
                {results.answers.map((result: any, index: number) => (
                  <div
                    key={index}
                    className={`border-2 rounded-lg p-4 ${
                      result.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-gray-900">{result.question}</p>
                      {result.isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Your answer:</span>{' '}
                        <span className={result.isCorrect ? 'text-green-700' : 'text-red-700'}>
                          {result.yourAnswer}
                        </span>
                      </p>
                      {!result.isCorrect && (
                        <p>
                          <span className="font-medium">Correct answer:</span>{' '}
                          <span className="text-green-700">{result.correctAnswer}</span>
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Points:</span> {result.pointsEarned} / {result.pointsPossible}
                      </p>
                      {result.explanation && (
                        <p className="text-gray-600 mt-2 italic">{result.explanation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8">
              <button
                onClick={() => navigate('/quiz')}
                className="btn btn-primary"
              >
                Back to Quiz Center
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <SecureExamWrapper
      ref={secureExamWrapperRef}
      enabled={secureModeEnabled}
      onTerminate={handleSecureModeTerminate}
    >
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
                {quiz.description && (
                  <p className="text-gray-600 mt-1">{quiz.description}</p>
                )}
              </div>
              {timeRemaining !== null && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  timeRemaining < 60 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  <Clock className="w-5 h-5" />
                  <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
            className="space-y-6"
          >
            {quiz.questions.map((question, index) => (
              <div key={question._id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Question {index + 1} ({question.points} point{question.points !== 1 ? 's' : ''})
                  </h3>
                  {answers[question._id] && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      Answered
                    </span>
                  )}
                </div>
                <p className="text-gray-700 mb-4">{question.question}</p>

                {question.type === 'multiple-choice' && (
                  <div className="space-y-2">
                    {question.options.map((option, oIndex) => (
                      <label
                        key={oIndex}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          answers[question._id] === option.text
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={question._id}
                          value={option.text}
                          checked={answers[question._id] === option.text}
                          onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="flex-1">{option.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.type === 'true-false' && (
                  <div className="space-y-2">
                    {['True', 'False'].map((option) => (
                      <label
                        key={option}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          answers[question._id] === option
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={question._id}
                          value={option}
                          checked={answers[question._id] === option}
                          onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="flex-1">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.type === 'short-answer' && (
                  <input
                    type="text"
                    value={answers[question._id] || ''}
                    onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                    className="input w-full"
                    placeholder="Enter your answer"
                  />
                )}
              </div>
            ))}

            <div className="bg-white rounded-lg shadow-md p-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {Object.keys(answers).length} of {quiz.questions.length} questions answered
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    // Exit secure mode before navigating away
                    if (secureExamWrapperRef.current) {
                      secureExamWrapperRef.current.exitSecureMode()
                      setSecureModeEnabled(false)
                    }
                    navigate('/quiz')
                  }}
                  className="btn btn-outline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    'Submit Quiz'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </SecureExamWrapper>
  )
}

export default TakeQuizPage

