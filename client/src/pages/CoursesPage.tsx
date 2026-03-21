import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { progressService, CourseProgress } from '../services/progressService'
import { api } from '../services/api'
import { 
  BookOpen, 
  TrendingUp, 
  Clock,
  Target,
  Loader2,
  ArrowRight,
  Award
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const CoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<CourseProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user, isLoading: authLoading, token } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  useEffect(() => {
    // Only fetch if we're on the courses page
    if (location.pathname !== '/courses') {
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

    fetchCourses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname, authLoading, token])

  const fetchCourses = async () => {
    const userId = user?.id || (user as any)?._id
    if (!userId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      console.log('Fetching courses for user:', userId)
      const progressData = await progressService.getAllProgress()
      console.log('Fetched courses:', progressData?.length || 0)
      
      // Filter out courses with 0% progress (no videos played yet)
      // Show only courses where at least one video has been played
      const filteredCourses = (progressData || []).filter(course => {
        const completedVideosCount = Array.isArray(course.completedVideos) 
          ? course.completedVideos.length 
          : course.completedVideos || 0
        const hasProgress = 
          completedVideosCount > 0 || 
          (course.completionPercentage && course.completionPercentage > 0) ||
          (course.totalWatchTime && course.totalWatchTime > 0)
        
        return hasProgress
      })
      
      console.log('Filtered courses (with progress):', filteredCourses.length)
      setCourses(filteredCourses)
    } catch (error) {
      console.error('Error fetching courses:', error)
      setCourses([])
      toast.error('Failed to load courses')
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const calculateOverallScore = (course: CourseProgress): number => {
    return course.averageTestScore || 0
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Courses</h1>
        <p className="text-gray-600">
          View all your courses and their corresponding scores
        </p>
      </div>

      {/* Courses List */}
      {courses.length > 0 ? (
        <div className="space-y-6">
          {courses.map((course) => {
            const overallScore = calculateOverallScore(course)
            const completedVideosCount = Array.isArray(course.completedVideos) 
              ? course.completedVideos.length 
              : course.completedVideos || 0
            const totalAssessments = course.testScores?.length || 0

            return (
              <div
                key={course.courseId}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/playlist/${course.courseId}`)}
              >
                <div className="card-content">
                  <div className="flex items-start gap-6">
                    {/* Course Thumbnail - Using placeholder since UserProgress doesn't have thumbnail */}
                    <div className="w-32 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex-shrink-0 flex items-center justify-center">
                      <BookOpen className="h-12 w-12 text-white" />
                    </div>

                    {/* Course Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-1 line-clamp-2">
                            {course.courseTitle}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-4 h-4" />
                              {completedVideosCount} / {course.totalVideos} videos
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="w-4 h-4" />
                              {totalAssessments} assessment{totalAssessments !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {Math.round(course.totalWatchTime / 60)} min watched
                            </span>
                          </div>
                        </div>

                        {/* Overall Score Badge */}
                        {overallScore > 0 && (
                          <div className={`px-4 py-2 rounded-lg font-bold text-lg ${getScoreColor(overallScore)}`}>
                            {overallScore}%
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${course.completionPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Completion Percentage Display */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-right ml-auto">
                          <div className="text-2xl font-bold text-primary-600">
                            {course.completionPercentage}%
                          </div>
                          <div className="text-sm text-gray-500">Complete</div>
                        </div>
                      </div>

                      {/* Last Watched Video */}
                      {course.lastWatchedVideo && (
                        <div className="mt-3 text-sm text-gray-600">
                          <span className="font-medium">Last watched:</span> {course.lastWatchedVideo.title}
                        </div>
                      )}

                      {/* View Course Button */}
                      <div className="mt-4 flex items-center text-primary-600 hover:text-primary-700 font-medium">
                        <span>View Course</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
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
              <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No courses yet
              </h3>
              <p className="text-gray-600 mb-6">
                Start learning by exploring courses and taking assessments
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
    </div>
  )
}

export default CoursesPage

