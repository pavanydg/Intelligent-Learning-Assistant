import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Target, Brain, Clock, Award, BarChart3, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { api, handleApiError } from '../services/api'

interface Assessment {
  id: string
  course: {
    title: string
    thumbnail: string
  }
  videoId: string
  videoTitle: string
  testName: string
  testScore: number
  cli: number
  cliClassification: string
  confidence: number
  timeSpent: number
  createdAt: string
}

interface QuestionDetail {
  questionId: string
  question: string
  options: string[]
  correctAnswer: string
  yourAnswer: string
  isCorrect: boolean
}

interface TestDetailsModalSingleProps {
  test: Assessment
  onClose: () => void
}

const TestDetailsModalSingle: React.FC<TestDetailsModalSingleProps> = ({ test, onClose }) => {
  const [questions, setQuestions] = useState<QuestionDetail[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)

  useEffect(() => {
    fetchAssessmentDetails()
  }, [test.id])

  const fetchAssessmentDetails = async () => {
    setIsLoadingQuestions(true)
    try {
      // Fetch assessment results which includes answers
      const resultsResponse = await api.get(`/assessments/${test.id}/results`)
      const answers = resultsResponse.data.data.assessment?.answers || []
      
      console.log('📊 Assessment answers:', answers)
      console.log('📊 Number of answers:', answers.length)

      // Fetch assessment data to get questions with options
      const assessmentResponse = await api.get(`/assessments/${test.id}`)
      const assessmentQuestions = assessmentResponse.data.data.questions || []
      
      console.log('❓ Assessment questions:', assessmentQuestions)
      console.log('❓ Number of questions:', assessmentQuestions.length)

      // Create a map of answers by questionId for quick lookup
      const answersMap = new Map<string, any>()
      answers.forEach((answer: any) => {
        const qId = (answer.questionId || answer._id || '').toString()
        answersMap.set(qId, answer)
      })

      // Map ALL questions from assessment, not just answers
      // This ensures we show all questions even if some weren't answered
      const questionsWithDetails: QuestionDetail[] = assessmentQuestions.map((question: any, index: number) => {
        const qId = (question.id || question._id || '').toString()
        const answer = answersMap.get(qId)
        
        console.log(`🔍 Processing question ${index + 1} (ID: ${qId}):`, {
          hasAnswer: !!answer,
          hasOptions: !!(question?.options && question.options.length > 0),
          correctAnswer: question.correctAnswer
        })
        
        // Normalize options - handle both string arrays and object arrays
        let normalizedOptions: string[] = []
        if (question.options && question.options.length > 0) {
          normalizedOptions = question.options.map((opt: any) => {
            if (typeof opt === 'string') {
              return opt
            } else if (opt && typeof opt === 'object') {
              return opt.text || opt.option || String(opt)
            }
            return String(opt)
          })
        }
        
        // Get correct answer - could be in question.correctAnswer or need to find from options
        let correctAnswer = question.correctAnswer || ''
        
        // If no direct correctAnswer, try to find it from options
        if (!correctAnswer && question.options && question.options.length > 0) {
          // Check if options have isCorrect flag (for object format)
          const correctOption = question.options.find((opt: any) => {
            if (typeof opt === 'object' && opt !== null) {
              return opt.isCorrect === true || opt.isCorrect === 'true'
            }
            return false
          })
          if (correctOption) {
            correctAnswer = correctOption.text || correctOption.option || String(correctOption)
          }
        }
        
        return {
          questionId: qId,
          question: question.question || '',
          options: normalizedOptions,
          correctAnswer: correctAnswer,
          yourAnswer: answer ? (answer.selectedAnswer || answer.answer || '') : '',
          isCorrect: answer ? (answer.isCorrect || false) : false
        }
      })

      // If no questions from assessment endpoint, fallback to answers
      if (questionsWithDetails.length === 0 && answers.length > 0) {
        console.log('⚠️ No questions from assessment endpoint, using answers as fallback')
        const fallbackQuestions: QuestionDetail[] = answers.map((answer: any) => ({
          questionId: (answer.questionId || answer._id || '').toString(),
          question: 'Question not available',
          options: [],
          correctAnswer: '',
          yourAnswer: answer.selectedAnswer || answer.answer || '',
          isCorrect: answer.isCorrect || false
        }))
        setQuestions(fallbackQuestions)
        return
      }

      console.log('✅ Final questions with details:', questionsWithDetails)
      console.log('✅ Number of questions to display:', questionsWithDetails.length)

      setQuestions(questionsWithDetails)
    } catch (error) {
      console.error('Error fetching assessment details:', error)
      handleApiError(error)
    } finally {
      setIsLoadingQuestions(false)
    }
  }
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getCLIColor = (cli: number) => {
    if (cli <= 35) return 'text-green-600 bg-green-50'
    if (cli <= 70) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getCLIClassificationColor = (classification: string) => {
    switch (classification) {
      case 'Low Load':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Moderate Load':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'High Load':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 4) return 'text-green-600'
    if (confidence >= 3) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{test.videoTitle || test.testName}</h2>
                  <div className="flex items-center gap-4 text-sm text-primary-100">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(test.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Main Score Display */}
                <div className="text-center py-6">
                  <div className={`inline-block px-8 py-4 rounded-2xl border-4 ${getScoreColor(test.testScore || 0)}`}>
                    <p className="text-sm font-medium mb-1">Test Score</p>
                    <p className="text-5xl font-bold">
                      {test.testScore !== undefined && !isNaN(test.testScore) ? test.testScore : 0}%
                    </p>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Test Score */}
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-600">Score</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-900">
                      {test.testScore !== undefined && !isNaN(test.testScore) ? test.testScore : 0}%
                    </p>
                  </div>

                  {/* CLI */}
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-600">CLI</span>
                    </div>
                    <p className={`text-3xl font-bold ${getCLIColor(test.cli || 0).split(' ')[0]}`}>
                      {test.cli !== undefined && !isNaN(test.cli) ? Math.round(test.cli) : 0}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full mt-2 inline-block ${getCLIClassificationColor(test.cliClassification || '')}`}>
                      {test.cliClassification || 'N/A'}
                    </span>
                  </div>

                  {/* Confidence */}
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-600">Confidence</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className={`text-3xl font-bold ${getConfidenceColor(test.confidence || 0)}`}>
                        {test.confidence || 0}
                      </p>
                      <span className="text-sm text-gray-500">/5</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`w-3 h-3 rounded-full ${
                            level <= (test.confidence || 0)
                              ? 'bg-green-600'
                              : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Time Spent */}
                  <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      <span className="text-sm font-medium text-orange-600">Time</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-900">
                      {formatTime(test.timeSpent || 0)}
                    </p>
                  </div>
                </div>

                {/* Performance Indicator */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-gray-400" />
                    <div>
                      <span className="text-sm text-gray-600">Performance: </span>
                      <span className={`text-lg font-semibold ${
                        (test.testScore || 0) >= 80 ? 'text-green-600' :
                        (test.testScore || 0) >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {(test.testScore || 0) >= 80 ? 'Excellent' :
                         (test.testScore || 0) >= 60 ? 'Good' :
                         'Needs Improvement'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Questions Review */}
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Questions Review</h3>
                  
                  {isLoadingQuestions ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                    </div>
                  ) : questions.length > 0 ? (
                    <div className="space-y-4">
                      {questions.map((q, index) => (
                        <div
                          key={q.questionId}
                          className={`border-2 rounded-lg p-4 ${
                            q.isCorrect
                              ? 'border-green-200 bg-green-50'
                              : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-semibold text-gray-900">
                              Question {index + 1}: {q.question}
                            </h4>
                            {q.isCorrect ? (
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            )}
                          </div>

                          {/* Options */}
                          {q.options && q.options.length > 0 ? (
                            <div className="space-y-2 mb-3">
                              {q.options.map((option, optIndex) => {
                                // Normalize strings for comparison - remove prefixes like "A) ", "B) " etc.
                                const normalizeText = (text: string) => {
                                  if (!text) return ''
                                  // Remove common prefixes like "A) ", "B) ", "A. ", "B. ", "Option A", etc.
                                  return text
                                    .replace(/^[A-Z]\)\s*/i, '')
                                    .replace(/^[A-Z]\.\s*/i, '')
                                    .replace(/^option\s+[A-Z]\s*/i, '')
                                    .trim()
                                    .toLowerCase()
                                }
                                
                                const normalizedOption = normalizeText(option)
                                const normalizedCorrect = normalizeText(q.correctAnswer)
                                const normalizedSelected = normalizeText(q.yourAnswer)
                                
                                const isCorrectOption = normalizedOption === normalizedCorrect
                                const isSelectedOption = normalizedOption === normalizedSelected
                                
                                // Determine styling
                                // Priority: 
                                // 1. If selected and correct -> green highlight
                                // 2. If selected and incorrect -> red highlight  
                                // 3. If correct but not selected -> green border/background (lighter)
                                // 4. Otherwise -> default
                                let borderColor = 'border-gray-200'
                                let bgColor = 'bg-white'
                                let textColor = 'text-gray-700'
                                let icon = null
                                
                                if (isSelectedOption && isCorrectOption) {
                                  // User selected the correct answer - highlight in blue with green accent
                                  borderColor = 'border-blue-500'
                                  bgColor = 'bg-blue-50'
                                  textColor = 'text-blue-900'
                                  icon = <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                } else if (isSelectedOption && !isCorrectOption) {
                                  // User selected an incorrect answer - highlight in blue (no red X)
                                  borderColor = 'border-blue-500'
                                  bgColor = 'bg-blue-50'
                                  textColor = 'text-blue-900'
                                  icon = <div className="w-5 h-5 flex-shrink-0" />
                                } else if (isCorrectOption && !isSelectedOption) {
                                  // This is the correct answer but user didn't select it - show in green (lighter)
                                  borderColor = 'border-green-400'
                                  bgColor = 'bg-green-50'
                                  textColor = 'text-green-700'
                                  icon = <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                } else {
                                  // Default option - not selected, not correct
                                  borderColor = 'border-gray-200'
                                  bgColor = 'bg-white'
                                  textColor = 'text-gray-600'
                                  icon = <div className="w-5 h-5 flex-shrink-0" />
                                }
                                
                                return (
                                  <div
                                    key={optIndex}
                                    className={`p-3 rounded-lg border-2 ${borderColor} ${bgColor} transition-colors`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {icon}
                                      <span className={`flex-1 ${textColor} ${(isCorrectOption || isSelectedOption) ? 'font-semibold' : ''}`}>
                                        {option}
                                      </span>
                                      <div className="flex gap-2 flex-shrink-0">
                                        {isCorrectOption && (
                                          <span className="text-xs font-medium text-green-700 bg-green-200 px-2 py-1 rounded">
                                            Correct Answer
                                          </span>
                                        )}
                                        {isSelectedOption && (
                                          <span className="text-xs font-medium px-2 py-1 rounded text-blue-700 bg-blue-200">
                                            Your Answer
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="space-y-2 mb-3">
                              <div className="p-3 rounded-lg border-2 border-gray-200 bg-white">
                                <span className="text-gray-700">
                                  <strong>Your Answer:</strong> {q.yourAnswer || 'No answer provided'}
                                </span>
                              </div>
                              {!q.isCorrect && (
                                <div className="p-3 rounded-lg border-2 border-green-500 bg-green-100">
                                  <span className="text-green-800 font-semibold">
                                    <strong>Correct Answer:</strong> {q.correctAnswer}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Answer Summary */}
                          <div className="text-sm mt-3 pt-3 border-t border-gray-300 space-y-2">
                            <div className="flex items-center gap-4">
                              <span className={q.isCorrect ? 'text-green-700' : 'text-red-700'}>
                                <strong>Status:</strong> {q.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                              </span>
                            </div>
                            {(() => {
                              // Helper function to normalize text for comparison (same as used in options rendering)
                              const normalizeText = (text: string) => {
                                if (!text) return ''
                                return String(text)
                                  .replace(/^[A-Z]\)\s*/i, '')
                                  .replace(/^[A-Z]\.\s*/i, '')
                                  .replace(/^option\s+[A-Z]\s*/i, '')
                                  .trim()
                                  .toLowerCase()
                              }
                              
                              // If we have options, find the correct one
                              if (q.options && q.options.length > 0 && q.correctAnswer) {
                                const normalizedCorrect = normalizeText(q.correctAnswer)
                                
                                // Find the option that matches the correct answer
                                const correctIndex = q.options.findIndex(opt => {
                                  const normalizedOpt = normalizeText(opt)
                                  return normalizedOpt === normalizedCorrect
                                })
                                
                                // If found, display it
                                if (correctIndex !== -1) {
                                  const optionLetter = String.fromCharCode(65 + correctIndex) // 65 is 'A' in ASCII
                                  const correctOption = q.options[correctIndex]
                                  // Remove any existing letter prefix to avoid duplication
                                  const cleanText = correctOption.replace(/^[A-Z]\)\s*/i, '').replace(/^[A-Z]\.\s*/i, '')
                                  
                                  return (
                                    <div className="mt-2">
                                      <span className="text-gray-700 font-medium">
                                        <strong>Correct Answer:</strong> {optionLetter}) {cleanText}
                                      </span>
                                    </div>
                                  )
                                }
                                
                                // Try alternative methods if direct match failed
                                const correctAnswerStr = String(q.correctAnswer).trim()
                                
                                // Method 1: Check if correctAnswer is just a letter (A, B, C, D)
                                const letterMatch = correctAnswerStr.match(/^([A-D])$/i)
                                if (letterMatch) {
                                  const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65
                                  if (idx >= 0 && idx < q.options.length) {
                                    const correctOption = q.options[idx]
                                    const cleanText = correctOption.replace(/^[A-Z]\)\s*/i, '').replace(/^[A-Z]\.\s*/i, '')
                                    return (
                                      <div className="mt-2">
                                        <span className="text-gray-700 font-medium">
                                          <strong>Correct Answer:</strong> {letterMatch[1].toUpperCase()}) {cleanText}
                                        </span>
                                      </div>
                                    )
                                  }
                                }
                                
                                // Method 2: Check if correctAnswer is an index number
                                const indexMatch = correctAnswerStr.match(/^(\d+)$/)
                                if (indexMatch) {
                                  const idx = parseInt(indexMatch[1])
                                  if (idx >= 0 && idx < q.options.length) {
                                    const optionLetter = String.fromCharCode(65 + idx)
                                    const correctOption = q.options[idx]
                                    const cleanText = correctOption.replace(/^[A-Z]\)\s*/i, '').replace(/^[A-Z]\.\s*/i, '')
                                    return (
                                      <div className="mt-2">
                                        <span className="text-gray-700 font-medium">
                                          <strong>Correct Answer:</strong> {optionLetter}) {cleanText}
                                        </span>
                                      </div>
                                    )
                                  }
                                }
                              }
                              
                              // Fallback: Show the correctAnswer as-is if we couldn't match it to an option
                              if (q.correctAnswer) {
                                return (
                                  <div className="mt-2">
                                    <span className="text-gray-700 font-medium">
                                      <strong>Correct Answer:</strong> {q.correctAnswer}
                                    </span>
                                  </div>
                                )
                              }
                              
                              return null
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No questions available for this assessment.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-end">
              <button
                onClick={onClose}
                className="btn btn-primary btn-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  )
}

export default TestDetailsModalSingle

