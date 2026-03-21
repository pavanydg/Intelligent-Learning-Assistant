import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, handleApiError } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { 
  BarChart3, 
  TrendingUp, 
  Brain, 
  Target, 
  Clock,
  BookOpen,
  ArrowRight,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface Assessment {
  id: string
  course?: {
    title?: string
    thumbnail?: string
  }
  videoId?: string
  videoTitle?: string
  testName?: string
  testScore: number
  cli?: number
  cliClassification?: string
  confidence: number
  createdAt: string
}

interface Insights {
  totalAssessments: number
  insights: Array<{
    type: string
    value: number
    message: string
  }>
  trends: {
    trend: string
    averageCLI: number
    improvement: number
    recommendations: string[]
  }
}

const DashboardPage: React.FC = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [totalAssessments, setTotalAssessments] = useState<number>(0)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { user, isLoading: authLoading, token } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Fetch data when component mounts or when navigating to dashboard
  useEffect(() => {
    // Only fetch if we're on the dashboard page
    if (location.pathname !== '/dashboard') {
      setIsLoading(false)
      return
    }

    // Wait for auth to finish loading
    if (authLoading) {
      return
    }

    // Redirect to login if not authenticated
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

    // Fetch dashboard data
    const fetchDashboardData = async () => {
      setIsLoading(true)
      try {
        console.log('Fetching dashboard data for user:', userId)
        // Fetch user assessments - get all assessments (limit 1000 to get all)
        const assessmentsResponse = await api.get(`/assessments/user/${userId}`, {
          params: { limit: 1000, page: 1 }
        })
        const fetchedAssessments = assessmentsResponse.data.data.assessments || []
        const totalCount = assessmentsResponse.data.data.pagination?.totalAssessments || fetchedAssessments.length
        console.log('Fetched assessments:', fetchedAssessments.length, 'Total:', totalCount)
        setAssessments(fetchedAssessments)
        setTotalAssessments(totalCount)

        // Fetch insights
        const insightsResponse = await api.get(`/assessments/analytics/${userId}`)
        console.log('Fetched insights:', insightsResponse.data.data)
        setInsights(insightsResponse.data.data || null)
      } catch (error) {
        console.error('Dashboard data fetch error:', error)
        // Set empty arrays on error
        setAssessments([])
        setInsights(null)
        handleApiError(error)
      } finally {
        setIsLoading(false)
      }
    }

    // Always fetch when user is available and auth is done
    fetchDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname, authLoading, token])

  const getScoreColor = (score: number) => {
    const safeScore = score || 0
    if (safeScore >= 80) return 'text-green-600'
    if (safeScore >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getCLIColor = (cli: number) => {
    const safeCli = cli || 0
    if (safeCli <= 35) return 'text-green-600'
    if (safeCli <= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getCLIClassificationColor = (classification: string | null | undefined) => {
    if (!classification) return 'bg-gray-100 text-gray-800'
    switch (classification) {
      case 'Low Load':
        return 'bg-green-100 text-green-800'
      case 'Moderate Load':
        return 'bg-yellow-100 text-yellow-800'
      case 'High Load':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Calculate CLI classification from CLI value if not provided
  const getCLIClassification = (cli: number | null | undefined, classification: string | null | undefined): string => {
    if (classification) return classification
    if (cli === null || cli === undefined) return 'N/A'
    if (cli <= 35) return 'Low Load'
    if (cli <= 70) return 'Moderate Load'
    return 'High Load'
  }

  // Get course thumbnail with fallback
  const getCourseThumbnail = (assessment: Assessment): string => {
    // Try course thumbnail first
    if (assessment.course?.thumbnail) {
      return assessment.course.thumbnail
    }
    // Fallback to a better placeholder image (using a data URI for a simple gradient)
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2MzY2RjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM4QjVDQ0YiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Db3Vyc2UgSW1hZ2U8L3RleHQ+PC9zdmc+'
  }

  // Get course title with fallback
  const getCourseTitle = (assessment: Assessment): string => {
    if (assessment.course?.title) {
      return assessment.course.title
    }
    if (assessment.testName) {
      return assessment.testName
    }
    if (assessment.videoTitle) {
      return assessment.videoTitle
    }
    return 'Unknown Course'
  }

  // Chart data - get recent 5 assessments (they're sorted newest first)
  const recentAssessments = assessments.slice(0, 5).reverse() // Reverse to show oldest to newest
  const scoreData = {
    labels: recentAssessments.map((_, index) => `Test ${index + 1}`),
    datasets: [
      {
        label: 'Test Score',
        data: recentAssessments.map(a => {
          const score = a.testScore
          return (score !== undefined && !isNaN(score)) ? score : 0
        }),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'CLI',
        data: recentAssessments.map(a => {
          const cli = a.cli
          return (cli !== undefined && !isNaN(cli)) ? cli : 0
        }),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  // Calculate CLI distribution - use classification if available, otherwise calculate from CLI
  const cliDistributionData = {
    labels: ['Low Load', 'Moderate Load', 'High Load'],
    datasets: [
      {
        data: [
          assessments.filter(a => {
            const classification = getCLIClassification(a.cli, a.cliClassification)
            return classification === 'Low Load'
          }).length,
          assessments.filter(a => {
            const classification = getCLIClassification(a.cli, a.cliClassification)
            return classification === 'Moderate Load'
          }).length,
          assessments.filter(a => {
            const classification = getCLIClassification(a.cli, a.cliClassification)
            return classification === 'High Load'
          }).length,
        ],
        backgroundColor: [
          'rgb(34, 197, 94)',
          'rgb(234, 179, 8)',
          'rgb(239, 68, 68)',
        ],
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
  }

  // Show loading while auth is being checked or data is being fetched
  if (authLoading || isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  // If no user after loading, don't render (redirect will happen)
  if (!user) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-lg text-gray-600">
          Track your learning progress and cognitive performance
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="card-elevated group hover:scale-[1.02] transition-transform duration-300">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Assessments</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {totalAssessments || assessments.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-elevated group hover:scale-[1.02] transition-transform duration-300">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-success-500 to-success-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 mb-1">Average Score</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {assessments.length > 0 
                      ? Math.round(assessments.reduce((sum, a) => sum + (a.testScore || 0), 0) / assessments.length) || 0
                      : 0
                    }%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-elevated group hover:scale-[1.02] transition-transform duration-300">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 mb-1">Average CLI</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {assessments.length > 0 
                      ? Math.round(assessments.reduce((sum, a) => sum + (a.cli || 0), 0) / assessments.length) || 0
                      : 0
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-elevated group hover:scale-[1.02] transition-transform duration-300">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-primary-400 to-blue-500 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 mb-1">Improvement</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {insights?.trends?.improvement !== undefined && !isNaN(insights.trends.improvement) ? 
                      `${insights.trends.improvement > 0 ? '+' : ''}${Math.round(insights.trends.improvement)}`
                      : '0'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Performance Chart */}
        <div className="card-elevated">
          <div className="card-header">
            <h3 className="card-title text-xl">Performance Trends</h3>
            <p className="card-description">
              Your test scores and cognitive load over time
            </p>
          </div>
          <div className="card-content">
            {assessments.length > 0 && recentAssessments.length > 0 ? (
              <Line data={scoreData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">No assessment data available</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CLI Distribution */}
        <div className="card-elevated">
          <div className="card-header">
            <h3 className="card-title text-xl">Cognitive Load Distribution</h3>
            <p className="card-description">
              Distribution of your cognitive load levels
            </p>
          </div>
          <div className="card-content">
            {assessments.length > 0 ? (
              (() => {
                const hasData = cliDistributionData.datasets[0].data.some(val => val > 0)
                return hasData ? (
                  <div className="flex justify-center items-center" style={{ height: '400px' }}>
                    <div style={{ width: '380px', height: '380px' }}>
                      <Doughnut 
                        data={cliDistributionData} 
                        options={{ 
                          responsive: true,
                          maintainAspectRatio: true,
                          plugins: {
                            legend: {
                              position: 'bottom' as const,
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  const label = context.label || ''
                                  const value = context.parsed || 0
                                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
                                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
                                  return `${label}: ${value} (${percentage}%)`
                                }
                              }
                            }
                          }
                        }} 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600">No CLI data available yet</p>
                      <p className="text-sm text-gray-500 mt-2">Complete assessments to see cognitive load distribution</p>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">No cognitive data available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Assessments */}
      <div className="card-elevated mb-10">
        <div className="card-header">
          <h3 className="card-title text-xl">Recent Assessments</h3>
          <p className="card-description">
            Your latest learning assessments and results
          </p>
        </div>
        <div className="card-content">
          {assessments.length > 0 ? (
            <div className="space-y-3">
              {assessments.slice(0, 5).map((assessment, index) => {
                const courseTitle = getCourseTitle(assessment)
                const courseThumbnail = getCourseThumbnail(assessment)
                const cliClassification = getCLIClassification(assessment.cli, assessment.cliClassification)
                
                return (
                  <div
                    key={assessment.id}
                    className="flex items-center p-5 border-2 border-gray-100 rounded-xl hover:border-primary-200 hover:shadow-md bg-white transition-all duration-300 group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <img
                      src={courseThumbnail}
                      alt={courseTitle}
                      className="w-20 h-14 object-cover rounded-lg mr-5 shadow-sm group-hover:shadow-md transition-shadow duration-300"
                      onError={(e) => {
                        // Fallback to a default placeholder if image fails to load
                        const target = e.target as HTMLImageElement
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2MzY2RjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM4QjVDQ0YiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Db3Vyc2UgSW1hZ2U8L3RleHQ+PC9zdmc+'
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 line-clamp-1 mb-1">
                        Assessment: {assessment.videoTitle || courseTitle}
                      </h4>
                      <p className="text-sm text-gray-600 line-clamp-1 mb-2">
                        {courseTitle}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(assessment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <p className="text-xs font-medium text-gray-600 mb-1">Score</p>
                        <p className={`text-xl font-bold ${getScoreColor(assessment.testScore || 0)}`}>
                          {assessment.testScore !== undefined && !isNaN(assessment.testScore) ? assessment.testScore : 0}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-gray-600 mb-1">CLI</p>
                        <p className={`text-xl font-bold ${getCLIColor(assessment.cli || 0)}`}>
                          {assessment.cli !== undefined && !isNaN(assessment.cli) ? Math.round(assessment.cli) : 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-gray-600 mb-1">Load</p>
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getCLIClassificationColor(cliClassification)}`}>
                          {cliClassification}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                <BookOpen className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No assessments yet
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Start your learning journey by taking an assessment
              </p>
              <button
                onClick={() => navigate('/search')}
                className="btn btn-primary btn-lg"
              >
                <BookOpen className="h-5 w-5 mr-2" />
                Find Courses
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      {insights && insights.insights && insights.insights.length > 0 ? (
        <div className="card-elevated">
          <div className="card-header">
            <h3 className="card-title text-xl">Learning Insights</h3>
            <p className="card-description">
              AI-generated insights about your learning patterns
            </p>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {insights.insights.map((insight, index) => (
                <div key={index} className="p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:border-primary-200 hover:shadow-md transition-all duration-300">
                  <p className="text-sm text-gray-700 leading-relaxed">{insight.message}</p>
                </div>
              ))}
            </div>
            
            {insights?.trends?.recommendations && insights.trends.recommendations.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-primary-600" />
                  Recommendations
                </h4>
                <ul className="space-y-3">
                  {insights.trends.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-3 p-3 bg-primary-50 rounded-lg">
                      <span className="text-primary-600 font-bold mt-0.5">•</span>
                      <span className="text-sm text-gray-700 flex-1">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card-elevated">
          <div className="card-header">
            <h3 className="card-title text-xl">Learning Insights</h3>
            <p className="card-description">
              Complete some assessments to see your learning insights
            </p>
          </div>
          <div className="card-content">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                <Brain className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-gray-700 font-medium mb-2">No insights available yet</p>
              <p className="text-sm text-gray-500">
                Take some assessments to generate personalized insights
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
