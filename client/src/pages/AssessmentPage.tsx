import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { api, assessmentApi, handleApiError } from '../services/api'
import { 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  Brain,
  Eye,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { FaceMesh } from '@mediapipe/face_mesh'
import { Camera } from '@mediapipe/camera_utils'

interface Question {
  id: string
  question: string
  options: string[]
  difficulty: string
  topic: string
  timeStamp: number
}

interface AssessmentData {
  assessmentId: string
  questions: Question[]
  totalQuestions: number
  timeLimit: number
  videoId?: string
}

interface Metrics {
  timestamp: number
  avgOnScreen: number
  blinkRatePerMin: number
  headMovement: number
  eyeGazeStability: number
}

// Face Mesh Landmark Indices
const LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
const RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
const LEFT_EYE_TOP = 159
const LEFT_EYE_BOTTOM = 145
const LEFT_EYE_LEFT = 33
const LEFT_EYE_RIGHT = 133
const RIGHT_EYE_TOP = 386
const RIGHT_EYE_BOTTOM = 374
const RIGHT_EYE_LEFT = 362
const RIGHT_EYE_RIGHT = 263
const NOSE_TIP = 1
const FOREHEAD_CENTER = 10

const AssessmentPage: React.FC = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const location = useLocation()
  const [assessment, setAssessment] = useState<AssessmentData | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isWebcamActive, setIsWebcamActive] = useState(false)
  const [metrics, setMetrics] = useState<Metrics[]>([])
  const [confidence, setConfidence] = useState(3)
  const [returnPath, setReturnPath] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const metricsIntervalRef = useRef<number | null>(null)
  const faceMeshRef = useRef<FaceMesh | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const navigate = useNavigate()
  
  // Tracking data for metrics calculation
  const trackingDataRef = useRef<{
    faceDetected: boolean
    blinkCount: number
    lastBlinkTime: number
    headPositions: Array<{ x: number; y: number; z: number }>
    eyePositions: Array<{ left: { x: number; y: number }; right: { x: number; y: number } }>
    detectionCount: number
    totalFrames: number
    startTime: number
  }>({
    faceDetected: false,
    blinkCount: 0,
    lastBlinkTime: 0,
    headPositions: [],
    eyePositions: [],
    detectionCount: 0,
    totalFrames: 0,
    startTime: Date.now()
  })

  // Get return path from location state
  useEffect(() => {
    const state = location.state as { videoId?: string; returnPath?: string } | null
    if (state?.returnPath) {
      setReturnPath(state.returnPath)
    } else if (state?.videoId) {
      setReturnPath(`/video/${state.videoId}`)
    }
  }, [location.state])

  useEffect(() => {
    if (assessmentId) {
      fetchAssessment()
    }
  }, [assessmentId])

  useEffect(() => {
    if (assessment && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (assessment && timeLeft === 0) {
      handleSubmitAssessment()
    }
  }, [timeLeft, assessment])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop metrics collection
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current)
      }
      
      // Stop camera and clean up MediaPipe resources
      if (cameraRef.current) {
        cameraRef.current.stop()
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close()
      }
      
      // Stop video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const fetchAssessment = async () => {
    if (!assessmentId) return

    setIsLoading(true)
    try {
      console.log('🔍 Fetching assessment:', assessmentId)
      
      // Get the assessment data (questions and basic info)
      const response = await api.get(`/assessments/${assessmentId}`)
      console.log('📊 Assessment response:', response.data)
      
      const { questions, totalQuestions, timeLimit } = response.data.data
      
      console.log('❓ Questions received:', questions?.length || 0)
      console.log('📝 Questions data:', questions)
      
      if (!questions || questions.length === 0) {
        console.error('❌ No questions available for assessment')
        throw new Error('No questions available for this assessment')
      }
      
      setAssessment({
        assessmentId,
        questions,
        totalQuestions,
        timeLimit
      })
      setTimeLeft(timeLimit)
      
      console.log('✅ Assessment loaded successfully')
    } catch (error) {
      console.error('❌ Error fetching assessment:', error)
      handleApiError(error)
      navigate('/search')
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate Eye Aspect Ratio (EAR) for blink detection
  const calculateEAR = (landmarks: any[], eyeIndices: number[]): number => {
    if (landmarks.length === 0) return 0
    
    // Get vertical distances
    const vertical1 = Math.abs(
      landmarks[eyeIndices[1]].y - landmarks[eyeIndices[5]].y
    )
    const vertical2 = Math.abs(
      landmarks[eyeIndices[2]].y - landmarks[eyeIndices[4]].y
    )
    
    // Get horizontal distance
    const horizontal = Math.abs(
      landmarks[eyeIndices[0]].x - landmarks[eyeIndices[3]].x
    )
    
    // EAR formula
    const ear = (vertical1 + vertical2) / (2.0 * horizontal)
    return ear
  }

  // Calculate head position from face landmarks
  const calculateHeadPosition = (landmarks: any[]): { x: number; y: number; z: number } => {
    if (landmarks.length === 0) return { x: 0, y: 0, z: 0 }
    
    const noseTip = landmarks[NOSE_TIP]
    const forehead = landmarks[FOREHEAD_CENTER]
    
    // Calculate head position relative to center (0.5, 0.5)
    const x = noseTip.x - 0.5
    const y = noseTip.y - 0.5
    const z = Math.abs(noseTip.z || 0) // Depth estimation
    
    return { x, y, z }
  }

  // Calculate eye gaze position
  const calculateEyeGaze = (landmarks: any[]): { left: { x: number; y: number }; right: { x: number; y: number } } => {
    if (landmarks.length === 0) {
      return { left: { x: 0.5, y: 0.5 }, right: { x: 0.5, y: 0.5 } }
    }
    
    const leftEyeCenter = {
      x: (landmarks[LEFT_EYE_LEFT].x + landmarks[LEFT_EYE_RIGHT].x) / 2,
      y: (landmarks[LEFT_EYE_TOP].y + landmarks[LEFT_EYE_BOTTOM].y) / 2
    }
    
    const rightEyeCenter = {
      x: (landmarks[RIGHT_EYE_LEFT].x + landmarks[RIGHT_EYE_RIGHT].x) / 2,
      y: (landmarks[RIGHT_EYE_TOP].y + landmarks[RIGHT_EYE_BOTTOM].y) / 2
    }
    
    return { left: leftEyeCenter, right: rightEyeCenter }
  }

  // Process face mesh results
  const onResults = useCallback((results: any) => {
    const tracking = trackingDataRef.current
    tracking.totalFrames++
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0]
      tracking.faceDetected = true
      tracking.detectionCount++
      
      // Calculate Eye Aspect Ratio for blink detection
      const leftEAR = calculateEAR(landmarks, LEFT_EYE_INDICES)
      const rightEAR = calculateEAR(landmarks, RIGHT_EYE_INDICES)
      const avgEAR = (leftEAR + rightEAR) / 2
      
      // Blink detection: EAR drops below threshold (typically 0.25-0.3)
      const BLINK_THRESHOLD = 0.25
      const currentTime = Date.now()
      
      if (avgEAR < BLINK_THRESHOLD) {
        // Only count as blink if enough time has passed since last blink (avoid multiple detections)
        if (currentTime - tracking.lastBlinkTime > 200) {
          tracking.blinkCount++
          tracking.lastBlinkTime = currentTime
          console.log('👁️ Blink detected! Total blinks:', tracking.blinkCount)
        }
      }
      
      // Track head position
      const headPos = calculateHeadPosition(landmarks)
      tracking.headPositions.push(headPos)
      // Keep only last 30 positions for movement calculation
      if (tracking.headPositions.length > 30) {
        tracking.headPositions.shift()
      }
      
      // Track eye gaze
      const eyeGaze = calculateEyeGaze(landmarks)
      tracking.eyePositions.push(eyeGaze)
      // Keep only last 30 positions for stability calculation
      if (tracking.eyePositions.length > 30) {
        tracking.eyePositions.shift()
      }
    } else {
      tracking.faceDetected = false
    }
  }, [])

  // Define functions in dependency order: sendMetricsToServer -> collectMetrics -> startMetricsCollection -> startWebcam
  const sendMetricsToServer = useCallback(async (metric: Metrics) => {
    if (!assessmentId) {
      console.warn('⚠️ No assessmentId, skipping metrics send')
      return
    }
    
    try {
      await assessmentApi.post(`/assessments/${assessmentId}/metrics`, {
        metrics: [metric]
      })
      console.log('✅ Metrics sent to server successfully')
    } catch (error: any) {
      console.error('❌ Error sending metrics:', error.response?.data || error.message)
    }
  }, [assessmentId])

  const collectMetrics = useCallback(() => {
    const tracking = trackingDataRef.current
    
    // Calculate on-screen percentage (face detection rate)
    const onScreenPercentage = tracking.totalFrames > 0
      ? (tracking.detectionCount / tracking.totalFrames) * 100
      : 0
    
    // Calculate blink rate per minute
    const elapsedMinutes = (Date.now() - tracking.startTime) / (1000 * 60)
    const blinkRatePerMin = elapsedMinutes > 0
      ? tracking.blinkCount / elapsedMinutes
      : 0
    
    // Calculate head movement (variance in head positions)
    let headMovement = 0
    if (tracking.headPositions.length > 1) {
      const positions = tracking.headPositions
      const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
      const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length
      const avgZ = positions.reduce((sum, p) => sum + p.z, 0) / positions.length
      
      const variance = positions.reduce((sum, p) => {
        const dx = p.x - avgX
        const dy = p.y - avgY
        const dz = p.z - avgZ
        return sum + Math.sqrt(dx * dx + dy * dy + dz * dz)
      }, 0) / positions.length
      
      // Convert to percentage (0-100)
      headMovement = Math.min(variance * 1000, 100)
    }
    
    // Calculate eye gaze stability (variance in eye positions)
    let eyeGazeStability = 100
    if (tracking.eyePositions.length > 1) {
      const positions = tracking.eyePositions
      const leftEyeAvgX = positions.reduce((sum, p) => sum + p.left.x, 0) / positions.length
      const leftEyeAvgY = positions.reduce((sum, p) => sum + p.left.y, 0) / positions.length
      const rightEyeAvgX = positions.reduce((sum, p) => sum + p.right.x, 0) / positions.length
      const rightEyeAvgY = positions.reduce((sum, p) => sum + p.right.y, 0) / positions.length
      
      const variance = positions.reduce((sum, p) => {
        const leftDx = p.left.x - leftEyeAvgX
        const leftDy = p.left.y - leftEyeAvgY
        const rightDx = p.right.x - rightEyeAvgX
        const rightDy = p.right.y - rightEyeAvgY
        const leftDist = Math.sqrt(leftDx * leftDx + leftDy * leftDy)
        const rightDist = Math.sqrt(rightDx * rightDx + rightDy * rightDy)
        return sum + (leftDist + rightDist) / 2
      }, 0) / positions.length
      
      // Convert to stability percentage (higher variance = lower stability)
      eyeGazeStability = Math.max(100 - (variance * 500), 0)
    }
    
    const newMetric: Metrics = {
      timestamp: Date.now(),
      avgOnScreen: Math.max(0, Math.min(100, onScreenPercentage)),
      blinkRatePerMin: Math.max(0, blinkRatePerMin),
      headMovement: Math.max(0, Math.min(100, headMovement)),
      eyeGazeStability: Math.max(0, Math.min(100, eyeGazeStability))
    }
    
    console.log('📊 Metrics collected:', {
      frames: tracking.totalFrames,
      detections: tracking.detectionCount,
      onScreen: newMetric.avgOnScreen.toFixed(1) + '%',
      blinks: tracking.blinkCount,
      blinkRate: newMetric.blinkRatePerMin.toFixed(1) + '/min',
      headMovement: newMetric.headMovement.toFixed(1) + '%',
      eyeGazeStability: newMetric.eyeGazeStability.toFixed(1) + '%'
    })
    
    setMetrics(prev => [...prev, newMetric])
    
    // Send metrics to server
    sendMetricsToServer(newMetric)
  }, [sendMetricsToServer])

  const startMetricsCollection = useCallback(() => {
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current)
    }
    metricsIntervalRef.current = window.setInterval(() => {
      collectMetrics()
    }, 2000) // Collect metrics every 2 seconds
  }, [collectMetrics])

  const startWebcam = useCallback(async () => {
    try {
      if (!videoRef.current || !canvasRef.current) {
        console.error('❌ Video or canvas ref not available')
        return
      }
      
      console.log('🎥 Starting webcam and MediaPipe Face Mesh...')
      
      // Request webcam access first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve(undefined)
            }
          }
        })
      }
      
      // Initialize Face Mesh
      const faceMesh = new FaceMesh({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        }
      })
      
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })
      
      faceMesh.onResults(onResults)
      faceMeshRef.current = faceMesh
      
      console.log('✅ Face Mesh initialized')
      
      // Initialize Camera
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && faceMeshRef.current) {
            await faceMeshRef.current.send({ image: videoRef.current })
          }
        },
        width: 640,
        height: 480
      })
      
      cameraRef.current = camera
      await camera.start()
      
      console.log('✅ Camera started, face tracking active')
      
      setIsWebcamActive(true)
      trackingDataRef.current.startTime = Date.now()
      
      // Start metrics collection
      startMetricsCollection()
      console.log('✅ Metrics collection started')
    } catch (error) {
      console.error('❌ Error accessing webcam:', error)
      toast.error('Unable to access webcam. Assessment will continue without cognitive tracking.')
    }
  }, [onResults, startMetricsCollection])


  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleNextQuestion = () => {
    if (currentQuestion < assessment!.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmitAssessment = async () => {
    if (!assessment) return

    setIsSubmitting(true)
    
    // Show submission progress
    toast.loading('Submitting assessment...', {
      id: 'submission-progress',
      duration: 0
    })
    
    // Stop metrics collection
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current)
    }
    
    // Stop camera and clean up MediaPipe resources
    if (cameraRef.current) {
      cameraRef.current.stop()
      cameraRef.current = null
    }
    if (faceMeshRef.current) {
      faceMeshRef.current.close()
      faceMeshRef.current = null
    }
    
    // Stop video stream
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }

    try {
      const response = await assessmentApi.post(`/assessments/${assessmentId}/complete`, {
        answers: Object.entries(answers).map(([questionId, selectedAnswer]) => ({
          questionId,
          selectedAnswer,
          timeSpent: 30, // Default time per question
          confidence: confidence
        })),
        confidence: confidence,
        timeSpent: assessment!.timeLimit - timeLeft
      })

      const { assessment: _result } = response.data.data
      
      // Dismiss loading toast and show success
      toast.dismiss('submission-progress')
      toast.success('Assessment submitted successfully!', {
        duration: 3000,
        style: {
          background: '#10B981',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          padding: '16px 24px',
          borderRadius: '8px'
        }
      })
      
      // Redirect back to the video page
      if (returnPath) {
        navigate(returnPath)
      } else {
        // Fallback: try to get videoId from assessment or location state
        const state = location.state as { videoId?: string } | null
        const videoId = state?.videoId || assessment?.videoId
        if (videoId && videoId !== 'unknown') {
          navigate(`/video/${videoId}`)
        } else {
          // Last resort: go back
          navigate(-1)
        }
      }
    } catch (error: any) {
      console.error('Assessment submission error:', error)
      
      // Dismiss loading toast
      toast.dismiss('submission-progress')
      
      if (error.code === 'ECONNABORTED') {
        toast.error('Assessment submission timed out. Please try again.', {
          duration: 8000,
          style: {
            background: '#EF4444',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '16px 24px',
            borderRadius: '8px',
            maxWidth: '500px'
          }
        })
      } else {
        handleApiError(error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Assessment not found
          </h3>
          <p className="text-gray-600 mb-4">
            The requested assessment could not be found.
          </p>
          <button
            onClick={() => navigate('/search')}
            className="btn btn-primary"
          >
            Back to Search
          </button>
        </div>
      </div>
    )
  }

  // Add safety checks for questions array
  if (!assessment.questions || assessment.questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Questions Available
          </h3>
          <p className="text-gray-600 mb-4">
            This assessment doesn't have any questions yet.
          </p>
          <button
            onClick={() => navigate('/search')}
            className="btn btn-primary"
          >
            Back to Search
          </button>
        </div>
      </div>
    )
  }

  const currentQ = assessment.questions[currentQuestion]
  const progress = ((currentQuestion + 1) / assessment.totalQuestions) * 100

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/search')}
          className="flex items-center text-gray-600 hover:text-primary-600 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Search
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assessment</h1>
            <p className="text-gray-600">
              Question {currentQuestion + 1} of {assessment.totalQuestions}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-1" />
              {formatTime(timeLeft)}
            </div>
            
            {!isWebcamActive && (
              <button
                onClick={startWebcam}
                className="btn btn-outline btn-sm"
              >
                <Eye className="h-4 w-4 mr-1" />
                Enable Tracking
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div 
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Question */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-content">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-primary-600 bg-primary-100 px-2 py-1 rounded">
                    {currentQ.difficulty}
                  </span>
                  <span className="text-sm text-gray-500">
                    {currentQ.topic}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {Math.floor(currentQ.timeStamp / 60)}:{(currentQ.timeStamp % 60).toString().padStart(2, '0')}
                </div>
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                {currentQ.question}
              </h2>

              <div className="space-y-3">
                {currentQ.options.map((option, index) => (
                  <label
                    key={index}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                      answers[currentQ.id] === option
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQ.id}`}
                      value={option}
                      checked={answers[currentQ.id] === option}
                      onChange={(e) => handleAnswerSelect(currentQ.id, e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                        answers[currentQ.id] === option
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-300'
                      }`}>
                        {answers[currentQ.id] === option && (
                          <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5" />
                        )}
                      </div>
                      <span className="text-gray-900">{option}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={handlePreviousQuestion}
              disabled={currentQuestion === 0}
              className="btn btn-outline"
            >
              Previous
            </button>

            <div className="flex items-center space-x-4">
              {currentQuestion === assessment.questions.length - 1 ? (
                <button
                  onClick={handleSubmitAssessment}
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-5 w-5 mr-2" />
                  )}
                  Submit Assessment
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  className="btn btn-primary"
                >
                  Next Question
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="space-y-6">
            {/* Confidence Level */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-lg">Confidence Level</h3>
              </div>
              <div className="card-content">
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">
                    How confident are you in your answer? (1-5)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={confidence}
                    onChange={(e) => setConfidence(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Not confident</span>
                    <span>Very confident</span>
                  </div>
                  <div className="text-center">
                    <span className="text-lg font-medium text-primary-600">
                      {confidence}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Webcam Status */}
            {isWebcamActive && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title text-lg">Cognitive Tracking</h3>
                </div>
                <div className="card-content">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Focus Level:</span>
                      <span className="text-green-600 font-medium">
                        {metrics.length > 0 ? Math.round(metrics[metrics.length - 1].avgOnScreen) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Blink Rate:</span>
                      <span className="text-blue-600 font-medium">
                        {metrics.length > 0 ? Math.round(metrics[metrics.length - 1].blinkRatePerMin) : 0}/min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Data Points:</span>
                      <span className="text-gray-900 font-medium">
                        {metrics.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-lg">Instructions</h3>
              </div>
              <div className="card-content">
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    Read each question carefully
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    Select the best answer
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    Rate your confidence level
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    Stay focused on the screen
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden video element for webcam */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="hidden"
      />
      <canvas
        ref={canvasRef}
        className="hidden"
      />
    </div>
  )
}

export default AssessmentPage
