import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Plus, X, Save, Trash2, Upload, FileText, Loader2, Sparkles, Check, XCircle, Calendar, Clock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'

interface Question {
  question: string
  type: 'multiple-choice' | 'true-false' | 'short-answer'
  options: Array<{ text: string; isCorrect: boolean }>
  correctAnswer?: string
  points: number
  explanation: string
}

const CreateQuizPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token } = useAuthStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [timeLimit, setTimeLimit] = useState(0)
  const [passingScore, setPassingScore] = useState(60)
  const [allowMultipleAttempts, setAllowMultipleAttempts] = useState(false)
  const [showResults, setShowResults] = useState(true)
  const [enableScheduling, setEnableScheduling] = useState(false)
  const [scheduledStartTime, setScheduledStartTime] = useState('')
  const [scheduledEndTime, setScheduledEndTime] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingPDF, setIsUploadingPDF] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedPDFs, setUploadedPDFs] = useState<Array<{ name: string; size: number }>>([])
  const [showGenerateQuestionsModal, setShowGenerateQuestionsModal] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    description: '',
    numQuestions: 5,
    difficulty: 'intermediate',
    notesFile: null as File | null
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([])
  const [draftQuizId, setDraftQuizId] = useState<string | null>(null)

  // Load generated questions from navigation state if available
  useEffect(() => {
    if (location.state?.generatedQuestions) {
      const generated = location.state.generatedQuestions.map((q: any) => ({
        question: q.question,
        type: 'multiple-choice' as const,
        options: q.options || [],
        points: q.points || 1,
        explanation: q.explanation || ''
      }))
      setQuestions(generated)
      toast.success(`Loaded ${generated.length} generated questions!`)
    }
  }, [location.state])

  // Debug: Log when questions change
  useEffect(() => {
    console.log('📋 Questions state updated:', questions.length, 'questions')
    if (questions.length > 0) {
      console.log('📋 First question:', questions[0])
    }
  }, [questions])

  // Load quiz from database if quizId is in URL params or location state (for editing)
  useEffect(() => {
    const loadQuiz = async () => {
      // Check if we're editing (quizId in URL path or search params)
      const pathQuizId = location.pathname.split('/quiz/edit/')[1]?.split('/')[0]
      const quizId = pathQuizId || new URLSearchParams(location.search).get('quizId') || location.state?.quizId
      
      if (quizId && token) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          const response = await api.get(`/quiz/${quizId}`)
          const quiz = response.data.data.quiz
          
          if (quiz) {
            setDraftQuizId(quizId)
            // Remove "Draft: " prefix if present, otherwise use title as-is
            setTitle(quiz.title.replace(/^Draft:\s*/i, ''))
            setDescription(quiz.description.replace(/^Auto-generated quiz based on:\s*/i, ''))
            setTimeLimit(quiz.timeLimit || 0)
            setPassingScore(quiz.passingScore || 60)
            setAllowMultipleAttempts(quiz.allowMultipleAttempts || false)
            setShowResults(quiz.showResults !== undefined ? quiz.showResults : true)
            const hasScheduled = !!(quiz.scheduledStartTime || quiz.scheduledEndTime)
            setEnableScheduling(hasScheduled)
            setScheduledStartTime(quiz.scheduledStartTime ? new Date(quiz.scheduledStartTime).toISOString().slice(0, 16) : '')
            setScheduledEndTime(quiz.scheduledEndTime ? new Date(quiz.scheduledEndTime).toISOString().slice(0, 16) : '')
            
            // Format questions properly
            const formattedQuestions = (quiz.questions || []).map((q: any) => ({
              question: q.question || '',
              type: (q.type || 'multiple-choice') as 'multiple-choice' | 'true-false' | 'short-answer',
              options: Array.isArray(q.options) ? q.options.map((opt: any) => ({
                text: typeof opt === 'string' ? opt : (opt.text || ''),
                isCorrect: typeof opt === 'object' ? (opt.isCorrect === true) : false
              })) : [],
              points: q.points || 1,
              explanation: q.explanation || '',
              correctAnswer: q.correctAnswer
            }))
            
            setQuestions(formattedQuestions)
            toast.success(`Loaded quiz with ${formattedQuestions.length} questions!`)
          }
        } catch (error) {
          console.error('Error loading quiz:', error)
          handleApiError(error)
          navigate('/quiz')
        }
      }
    }
    
    if (user && token) {
      loadQuiz()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, location.state, user, token])

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: '',
        type: 'multiple-choice',
        options: [
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false }
        ],
        points: 1,
        explanation: ''
      }
    ])
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const updateOption = (questionIndex: number, optionIndex: number, field: 'text' | 'isCorrect', value: any) => {
    const updated = [...questions]
    updated[questionIndex].options[optionIndex] = {
      ...updated[questionIndex].options[optionIndex],
      [field]: value
    }
    setQuestions(updated)
  }

  const addOption = (questionIndex: number) => {
    const updated = [...questions]
    updated[questionIndex].options.push({ text: '', isCorrect: false })
    setQuestions(updated)
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions]
    if (updated[questionIndex].options.length > 2) {
      updated[questionIndex].options.splice(optionIndex, 1)
      setQuestions(updated)
    }
  }

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    // Check for duplicate PDF (same name and size)
    const isDuplicate = uploadedPDFs.some(
      pdf => pdf.name === file.name && pdf.size === file.size
    )

    if (isDuplicate) {
      toast.error(`This PDF "${file.name}" has already been uploaded. Please upload a different file.`, {
        duration: 4000
      })
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setIsUploadingPDF(true)
    try {
      const formData = new FormData()
      formData.append('pdf', file)

      const response = await api.post('/quiz/parse-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      if (response.data.success) {
        const parsedQuestions = response.data.data.questions
        if (parsedQuestions.length > 0) {
          // Add parsed questions to existing questions
          setQuestions([...questions, ...parsedQuestions])
          // Track uploaded PDF
          setUploadedPDFs([...uploadedPDFs, { name: file.name, size: file.size }])
          toast.success(`Successfully parsed ${parsedQuestions.length} question(s) from PDF!`)
        } else {
          toast.error('No questions found in PDF')
        }
      } else {
        // Handle partial success (some questions parsed with errors)
        if (response.data.data?.questions && response.data.data.questions.length > 0) {
          const parsedQuestions = response.data.data.questions
          setQuestions([...questions, ...parsedQuestions])
          // Track uploaded PDF even if there were errors
          setUploadedPDFs([...uploadedPDFs, { name: file.name, size: file.size }])
          
          // Show detailed error messages
          const errors = response.data.data?.errors || []
          if (errors.length > 0) {
            const errorMessage = `Parsed ${parsedQuestions.length} question(s) with formatting errors:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more errors` : ''}`
            toast.error(errorMessage, {
              duration: 6000,
              style: {
                whiteSpace: 'pre-line',
                maxWidth: '500px'
              }
            })
          } else {
            toast(`Parsed ${parsedQuestions.length} question(s) with some errors. Please review.`, { icon: '⚠️' })
          }
        } else {
          // No questions parsed - show formatting requirements
          const errors = response.data.data?.errors || []
          let errorMessage = 'Failed to parse PDF. The PDF format is incorrect.\n\n'
          
          if (errors.length > 0) {
            errorMessage += 'Formatting errors found:\n'
            errorMessage += errors.slice(0, 10).join('\n')
            if (errors.length > 10) {
              errorMessage += `\n...and ${errors.length - 10} more errors`
            }
          } else {
            errorMessage += 'Expected PDF format:\n'
            errorMessage += 'Question 1: [Question text]\n'
            errorMessage += 'A) [Option A]\n'
            errorMessage += 'B) [Option B]\n'
            errorMessage += 'C) [Option C]\n'
            errorMessage += 'D) [Option D]\n'
            errorMessage += 'Correct Answer: A\n'
            errorMessage += 'Points: 1 (optional)\n'
            errorMessage += 'Explanation: [explanation] (optional)\n\n'
            errorMessage += 'Please ensure your PDF follows this format.'
          }
          
          toast.error(errorMessage, {
            duration: 8000,
            style: {
              whiteSpace: 'pre-line',
              maxWidth: '500px'
            }
          })
        }
      }
    } catch (error: any) {
      console.error('PDF upload error:', error)
      const errorData = error.response?.data
      let errorMessage = 'Failed to parse PDF'
      
      // Show detailed error messages from backend
      if (errorData?.data?.errors && Array.isArray(errorData.data.errors)) {
        errorMessage = 'PDF format is incorrect:\n\n'
        errorMessage += errorData.data.errors.slice(0, 10).join('\n')
        if (errorData.data.errors.length > 10) {
          errorMessage += `\n...and ${errorData.data.errors.length - 10} more errors`
        }
        errorMessage += '\n\nExpected format:\n'
        errorMessage += 'Question 1: [Question text]\n'
        errorMessage += 'A) [Option A]\n'
        errorMessage += 'B) [Option B]\n'
        errorMessage += 'C) [Option C]\n'
        errorMessage += 'D) [Option D]\n'
        errorMessage += 'Correct Answer: A'
      } else if (errorData?.message) {
        errorMessage = errorData.message
      }
      
      toast.error(errorMessage, {
        duration: 8000,
        style: {
          whiteSpace: 'pre-line',
          maxWidth: '500px'
        }
      })
    } finally {
      setIsUploadingPDF(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Quiz title is required')
      return
    }

    if (questions.length === 0) {
      toast.error('Please add at least one question')
      return
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question.trim()) {
        toast.error(`Question ${i + 1} is missing text`)
        return
      }

      if (q.type === 'multiple-choice') {
        if (q.options.length < 2) {
          toast.error(`Question ${i + 1} needs at least 2 options`)
          return
        }
        const hasCorrect = q.options.some(opt => opt.isCorrect)
        if (!hasCorrect) {
          toast.error(`Question ${i + 1} needs at least one correct answer`)
          return
        }
        if (q.options.some(opt => !opt.text.trim())) {
          toast.error(`Question ${i + 1} has empty options`)
          return
        }
      } else if (q.type === 'true-false' || q.type === 'short-answer') {
        if (!q.correctAnswer || !q.correctAnswer.trim()) {
          toast.error(`Question ${i + 1} needs a correct answer`)
          return
        }
      }
    }

    setIsSaving(true)
    try {
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      }

      // Validate scheduled times if both are provided
      if (scheduledStartTime && scheduledEndTime) {
        const startTime = new Date(scheduledStartTime)
        const endTime = new Date(scheduledEndTime)
        if (endTime <= startTime) {
          toast.error('End time must be after start time')
          return
        }
      }

      // If it's an existing quiz (draft or published), update it instead of creating new
      if (draftQuizId) {
        const response = await api.put(`/quiz/${draftQuizId}`, {
          title,
          description,
          questions,
          timeLimit,
          passingScore,
          allowMultipleAttempts,
          showResults,
          scheduledStartTime: enableScheduling ? (scheduledStartTime || null) : null,
          scheduledEndTime: enableScheduling ? (scheduledEndTime || null) : null,
          isDraft: false, // Always publish when saving
          isActive: true
        })
        toast.success('Quiz updated successfully!')
        navigate('/quiz')
      } else {
        // Create new quiz
        const response = await api.post('/quiz', {
          title,
          description,
          questions,
          timeLimit,
          passingScore,
          allowMultipleAttempts,
          showResults,
          scheduledStartTime: scheduledStartTime || null,
          scheduledEndTime: scheduledEndTime || null
        })
        toast.success('Quiz created successfully!')
        navigate('/quiz')
      }
    } catch (error) {
      console.error('Error creating quiz:', error)
      handleApiError(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/quiz')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Quizzes
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {draftQuizId ? 'Edit Quiz' : 'Create New Quiz'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quiz Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input w-full"
                  placeholder="Enter quiz title"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input w-full"
                  rows={3}
                  placeholder="Enter quiz description (optional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Limit (minutes, 0 = no limit)
                  </label>
                  <input
                    type="number"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(parseInt(e.target.value) || 0)}
                    className="input w-full"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passing Score (%)
                  </label>
                  <input
                    type="number"
                    value={passingScore}
                    onChange={(e) => setPassingScore(parseInt(e.target.value) || 60)}
                    className="input w-full"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              
              {/* Schedule Quiz Section */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Schedule Quiz (Optional)</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableScheduling}
                      onChange={(e) => {
                        setEnableScheduling(e.target.checked)
                        if (!e.target.checked) {
                          setScheduledStartTime('')
                          setScheduledEndTime('')
                        }
                      }}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Enable Scheduling</span>
                  </label>
                </div>
                {enableScheduling && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Clock className="w-4 h-4 inline mr-1" />
                          Start Time
                        </label>
                        <input
                          type="datetime-local"
                          value={scheduledStartTime}
                          onChange={(e) => setScheduledStartTime(e.target.value)}
                          className="input w-full"
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        <p className="text-xs text-gray-500 mt-1">Quiz will be available from this time</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Clock className="w-4 h-4 inline mr-1" />
                          End Time
                        </label>
                        <input
                          type="datetime-local"
                          value={scheduledEndTime}
                          onChange={(e) => setScheduledEndTime(e.target.value)}
                          className="input w-full"
                          min={scheduledStartTime || new Date().toISOString().slice(0, 16)}
                          disabled={!enableScheduling}
                        />
                        <p className="text-xs text-gray-500 mt-1">Quiz will stop being available after this time</p>
                      </div>
                    </div>
                    {(scheduledStartTime || scheduledEndTime) && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          <strong>Note:</strong> Students will only be able to access the quiz between the scheduled times (if set).
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowMultipleAttempts}
                    onChange={(e) => setAllowMultipleAttempts(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Allow Multiple Attempts</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showResults}
                    onChange={(e) => setShowResults(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Show Results After Submission</span>
                </label>
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Questions ({questions.length})</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateQuestionsModal(true)}
                  className="btn btn-sm btn-outline"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Generate Questions
                </button>
                <label className={`btn btn-sm btn-outline cursor-pointer ${isUploadingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {isUploadingPDF ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Parsing PDF...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-1" />
                      Upload PDF
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handlePDFUpload}
                    className="hidden"
                    disabled={isUploadingPDF}
                  />
                </label>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="btn btn-sm btn-primary"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Question
                </button>
              </div>
            </div>

            {/* PDF Format Info */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-2">PDF Format Guide:</p>
                  <div className="text-xs text-blue-800 bg-white p-3 rounded border border-blue-200 overflow-x-auto">
                    <p className="mb-2 font-semibold">Format your PDF questions like this:</p>
                    <pre className="whitespace-pre-wrap font-mono text-xs">{`Question 1: What is 1 + 1?
A) 1
B) 2
C) 3
D) 4
Correct Answer: B
Points: 1
Explanation: Basic addition (optional)

Question 2: What is 2 * 2?
A) 2
B) 3
C) 4
D) 5
Correct Answer: C
Points: 2`}</pre>
                    <p className="mt-2 text-xs text-blue-700">
                      <strong>Note:</strong> Each question should start with "Question X:" followed by options (A), B), C), D)), 
                      then "Correct Answer: [A/B/C/D]", optional "Points: [number]", and optional "Explanation: [text]"
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Show uploaded PDFs list */}
            {uploadedPDFs.length > 0 && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Uploaded PDFs ({uploadedPDFs.length}):
                </p>
                <ul className="space-y-1">
                  {uploadedPDFs.map((pdf, idx) => (
                    <li key={idx} className="text-sm text-blue-700 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="truncate">{pdf.name}</span>
                      <span className="text-blue-500 text-xs">
                        ({(pdf.size / 1024).toFixed(1)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">No questions yet.</p>
                <p className="text-sm">Click "Add Question" to manually add questions or "Upload PDF" to import questions from a PDF file.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((question, qIndex) => (
                  <div key={qIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-medium text-gray-900">Question {qIndex + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qIndex)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Question Text *
                        </label>
                        <textarea
                          value={question.question}
                          onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                          className="input w-full"
                          rows={2}
                          placeholder="Enter your question"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Question Type *
                          </label>
                          <select
                            value={question.type}
                            onChange={(e) => {
                              const newType = e.target.value as Question['type']
                              updateQuestion(qIndex, 'type', newType)
                              if (newType === 'true-false') {
                                updateQuestion(qIndex, 'options', [
                                  { text: 'True', isCorrect: false },
                                  { text: 'False', isCorrect: false }
                                ])
                              }
                            }}
                            className="input w-full"
                          >
                            <option value="multiple-choice">Multiple Choice</option>
                            <option value="true-false">True/False</option>
                            <option value="short-answer">Short Answer</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Points *
                          </label>
                          <input
                            type="number"
                            value={question.points}
                            onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value) || 1)}
                            className="input w-full"
                            min="1"
                            required
                          />
                        </div>
                      </div>

                      {question.type === 'multiple-choice' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Options * (check the correct answer)
                          </label>
                          <div className="space-y-2">
                            {question.options.map((option, oIndex) => (
                              <div key={oIndex} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={option.isCorrect}
                                  onChange={(e) => updateOption(qIndex, oIndex, 'isCorrect', e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <input
                                  type="text"
                                  value={option.text}
                                  onChange={(e) => updateOption(qIndex, oIndex, 'text', e.target.value)}
                                  className="input flex-1"
                                  placeholder={`Option ${oIndex + 1}`}
                                  required
                                />
                                {question.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => removeOption(qIndex, oIndex)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addOption(qIndex)}
                              className="btn btn-sm btn-outline"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add Option
                            </button>
                          </div>
                        </div>
                      )}

                      {(question.type === 'true-false' || question.type === 'short-answer') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Correct Answer *
                          </label>
                          {question.type === 'true-false' ? (
                            <select
                              value={question.correctAnswer || ''}
                              onChange={(e) => updateQuestion(qIndex, 'correctAnswer', e.target.value)}
                              className="input w-full"
                              required
                            >
                              <option value="">Select answer</option>
                              <option value="True">True</option>
                              <option value="False">False</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={question.correctAnswer || ''}
                              onChange={(e) => updateQuestion(qIndex, 'correctAnswer', e.target.value)}
                              className="input w-full"
                              placeholder="Enter correct answer"
                              required
                            />
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Explanation (shown after quiz)
                        </label>
                        <textarea
                          value={question.explanation}
                          onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                          className="input w-full"
                          rows={2}
                          placeholder="Optional explanation for the correct answer"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/quiz')}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || questions.length === 0}
              className="btn btn-primary"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {draftQuizId ? 'Update Quiz' : 'Create Quiz'}
                </>
              )}
            </button>
          </div>
        </form>

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
                        headers: { 'Content-Type': 'multipart/form-data' },
                        timeout: 60000 // 60 second timeout for AI generation
                      })
                      
                      console.log('📝 Full API response:', response.data)
                      
                      if (response.data.success) {
                        const quizData = response.data.data.quiz
                        const generated = response.data.data.questions
                        
                        console.log('📝 Quiz data received:', quizData)
                        console.log('📝 Generated questions array:', generated)
                        console.log('📝 Quiz questions from DB:', quizData?.questions)
                        console.log('📝 Generated questions length:', generated?.length)
                        console.log('📝 Quiz questions length:', quizData?.questions?.length)
                        
                        // Prioritize generated questions (they're already formatted), then quiz.questions, then empty array
                        let questionsToUse: any[] = []
                        
                        if (generated && Array.isArray(generated) && generated.length > 0) {
                          console.log('✅ Using generated questions array')
                          questionsToUse = generated
                        } else if (quizData?.questions && Array.isArray(quizData.questions) && quizData.questions.length > 0) {
                          console.log('✅ Using quiz.questions from database')
                          questionsToUse = quizData.questions
                        } else {
                          console.warn('⚠️ No questions found in response!')
                          toast.error('Questions were generated but not found in response. Please try again.')
                          return
                        }
                        
                        // Format questions for the form
                        const formattedQuestions = questionsToUse.map((q: any, index: number) => {
                          // Handle different question formats
                          const questionText = q.question || q.text || ''
                          const questionType = (q.type || 'multiple-choice') as 'multiple-choice' | 'true-false' | 'short-answer'
                          
                          // Format options
                          let formattedOptions: Array<{ text: string; isCorrect: boolean }> = []
                          if (Array.isArray(q.options) && q.options.length > 0) {
                            formattedOptions = q.options.map((opt: any) => {
                              if (typeof opt === 'string') {
                                return { text: opt, isCorrect: false }
                              } else if (typeof opt === 'object') {
                                return {
                                  text: opt.text || opt.label || '',
                                  isCorrect: opt.isCorrect === true
                                }
                              }
                              return { text: '', isCorrect: false }
                            })
                          }
                          
                          return {
                            question: questionText,
                            type: questionType,
                            options: formattedOptions,
                            points: q.points || 1,
                            explanation: q.explanation || '',
                            correctAnswer: q.correctAnswer
                          }
                        })
                        
                        console.log('📝 Formatted questions for form:', formattedQuestions)
                        console.log('📝 Formatted questions count:', formattedQuestions.length)
                        
                        if (formattedQuestions.length === 0) {
                          console.error('❌ No formatted questions!')
                          toast.error('Failed to format questions. Please try again.')
                          return
                        }
                        
                        // Load the draft quiz from database into the form
                        if (quizData?.id) {
                          setDraftQuizId(quizData.id)
                        }
                        if (quizData?.title) {
                          setTitle(quizData.title.replace('Draft: ', ''))
                        }
                        if (quizData?.description) {
                          setDescription(quizData.description.replace('Auto-generated quiz based on: ', ''))
                        }
                        if (quizData?.timeLimit !== undefined) {
                          setTimeLimit(quizData.timeLimit || 0)
                        }
                        if (quizData?.passingScore !== undefined) {
                          setPassingScore(quizData.passingScore || 60)
                        }
                        if (quizData?.allowMultipleAttempts !== undefined) {
                          setAllowMultipleAttempts(quizData.allowMultipleAttempts || false)
                        }
                        if (quizData?.showResults !== undefined) {
                          setShowResults(quizData.showResults)
                        }
                        
                        // Set questions - this should trigger re-render
                        console.log('📝 Setting questions state with', formattedQuestions.length, 'questions')
                        console.log('📝 Questions to set:', formattedQuestions)
                        setQuestions([...formattedQuestions]) // Use spread to ensure new array reference
                        
                        setGeneratedQuestions(generated || formattedQuestions)
                        setShowGenerateQuestionsModal(false)
                        setShowReviewModal(true)
                        toast.success(`Generated ${formattedQuestions.length} questions and saved to database!`)
                        
                        // Scroll to questions section after a brief delay
                        setTimeout(() => {
                          const questionsSection = document.querySelector('.bg-white.rounded-lg.shadow-md.p-6')
                          if (questionsSection) {
                            questionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }
                        }, 500)
                      } else {
                        console.error('❌ API response not successful:', response.data)
                        toast.error('Failed to generate questions. Please try again.')
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
                        // Scroll to questions section
                        document.querySelector('.bg-white.rounded-lg.shadow-md.p-6')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className="btn btn-primary"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Done - View in Form ({generatedQuestions.length} questions added)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreateQuizPage

