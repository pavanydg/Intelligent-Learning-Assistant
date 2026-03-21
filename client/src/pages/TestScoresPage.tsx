import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, handleApiError } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { 
  BookOpen, 
  Target,
  Loader2,
  Clock
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import TestDetailsModalSingle from '../components/TestDetailsModalSingle'

interface Assessment {
  id: string
  course: {
    title: string
    thumbnail: string
  }
  courseId?: string
  courseTitle?: string
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

const TestScoresPage: React.FC = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTest, setSelectedTest] = useState<Assessment | null>(null)
  const { user, isLoading: authLoading, token } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  useEffect(() => {
    // Only fetch if we're on the test-scores page
    if (location.pathname !== '/test-scores') {
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

    // Redirect teachers to teacher dashboard
    if (user.role === 'instructor' || user.role === 'admin') {
      navigate('/teacher/dashboard', { replace: true })
      setIsLoading(false)
      return
    }

    // Get user ID - try both _id and id
    const userId = user.id || (user as any)._id
    if (!userId) {
      console.warn('User ID not available:', user)
      setIsLoading(false)
      return
    }

    // Ensure token is set in API client
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    fetchAssessments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname, authLoading, token])

  const fetchAssessments = async () => {
    const userId = user?.id || (user as any)?._id
    if (!userId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      console.log('Fetching test scores for user:', userId)
      // Fetch all assessments
      const response = await api.get(`/assessments/user/${userId}?status=completed&limit=1000`)
      const fetchedAssessments: Assessment[] = response.data.data.assessments || []

        // Sort assessments by creation date (newest first)
      const sortedAssessments = fetchedAssessments.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

      setAssessments(sortedAssessments)
    } catch (error) {
      console.error('Error fetching assessments:', error)
      setAssessments([])
      handleApiError(error)
      toast.error('Failed to load test scores')
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getCLIColor = (cli: number) => {
    if (cli <= 35) return 'text-green-600'
    if (cli <= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getCourseTitle = (assessment: Assessment): string => {
    if (assessment.courseTitle) {
      return assessment.courseTitle
    }
    if (assessment.course && typeof assessment.course === 'object') {
      return assessment.course.title || 'Unknown Course'
    }
    return 'Unknown Course'
  }

  const getCourseThumbnail = (assessment: Assessment): string => {
    if (assessment.course && typeof assessment.course === 'object') {
      return assessment.course.thumbnail || ''
    }
    return ''
  }

  if (authLoading || isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Scores</h1>
        <p className="text-gray-600">
          View all your test attempts and performance metrics
        </p>
      </div>

      {/* Test Scores List */}
      {assessments.length > 0 ? (
        <div className="space-y-4">
          {assessments.map((assessment) => {
            const courseTitle = getCourseTitle(assessment)
            const courseThumbnail = getCourseThumbnail(assessment)

            return (
            <div
                key={assessment.id}
                onClick={() => setSelectedTest(assessment)}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="card-content">
                <div className="flex items-start gap-6">
                  {/* Course Thumbnail */}
                    {courseThumbnail ? (
                    <img
                        src={courseThumbnail}
                        alt={courseTitle}
                        className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                      <div className="w-24 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex-shrink-0 flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-white" />
                    </div>
                  )}

                    {/* Test Info */}
                  <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                            {assessment.videoTitle || assessment.testName}
                        </h3>
                          <p className="text-sm text-gray-600 mb-2">
                            {courseTitle}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(assessment.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                        {/* Score Badge */}
                        <div className="flex flex-col items-end gap-2">
                          <div className={`px-4 py-2 rounded-lg font-bold text-xl ${getScoreColor(assessment.testScore || 0)}`}>
                            {assessment.testScore !== undefined && !isNaN(assessment.testScore) 
                              ? assessment.testScore 
                              : 0}%
                          </div>
                          <div className="text-xs text-gray-500">Test Score</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card">
          <div className="card-content">
            <div className="text-center py-12">
              <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No test scores yet
              </h3>
              <p className="text-gray-600 mb-6">
                Complete assessments to see your test scores here
              </p>
              <button
                onClick={() => navigate('/search')}
                className="btn btn-primary"
              >
                <BookOpen className="h-5 w-5 mr-2" />
                Browse Courses
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Test Details Modal */}
      {selectedTest && (
        <TestDetailsModalSingle
          test={selectedTest}
          onClose={() => setSelectedTest(null)}
        />
      )}
    </div>
  )
}

export default TestScoresPage

