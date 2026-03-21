import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Users, TrendingUp, Award, BarChart3, Target, Brain, Clock, Eye, Filter, Search, X, FileSpreadsheet, Download } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'
import StudentProgressModal from '../components/StudentProgressModal'
import { exportToExcel, exportToCSV, exportMultipleSheets, formatDateForExport } from '../utils/exportUtils'

interface Course {
  id: string
  playlistId: string
  title: string
  description: string
  thumbnail: string
  totalVideos: number
}

interface Analytics {
  totalStudents: number
  totalAssessments: number
  averageScore: number
  averageCLI: number
  averageCompletion: number
  scoreDistribution: {
    excellent: number
    good: number
    needsImprovement: number
  }
  cliDistribution: {
    low: number
    moderate: number
    high: number
  }
}

interface VideoAnalytics {
  videoId: string
  title: string
  totalAssessments: number
  completedBy: number
  averageScore: number
  averageCLI: number
}

interface Student {
  userId: string
  name: string
  email: string
  college?: string
  department?: string
  stats: {
    totalAssessments: number
    averageScore: number
    averageCLI: number
  }
  progress: {
    totalVideos: number
    completedVideos: number
    completionPercentage: number
    averageTestScore: number
  } | null
  assessments?: Array<{
    id: string
    videoId: string
    videoTitle: string
    testScore: number
    cli: number
    cliClassification?: string
    createdAt: string
  }>
}

const CourseAnalyticsPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [videoAnalytics, setVideoAnalytics] = useState<VideoAnalytics[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [colleges, setColleges] = useState<string[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [selectedColleges, setSelectedColleges] = useState<string[]>([])
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [collegeSearch, setCollegeSearch] = useState('')
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const { user, isLoading: authLoading, token } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (authLoading) return

    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      navigate('/login', { replace: true })
      return
    }

    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    if (courseId) {
      fetchAnalytics()
      fetchCollegesAndDepartments()
      fetchStudents()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user, authLoading, token])

  useEffect(() => {
    if (courseId) {
      fetchStudents()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColleges, selectedDepartments])

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
    if (!courseId) return

    setIsLoading(true)
    try {
      const response = await api.get(`/teacher/courses/${courseId}/analytics`)
      setCourse(response.data.data.course)
      setAnalytics(response.data.data.analytics)
      setVideoAnalytics(response.data.data.videoAnalytics || [])
    } catch (error) {
      console.error('Error fetching analytics:', error)
      handleApiError(error)
      toast.error('Failed to load course analytics')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCollegesAndDepartments = async () => {
    try {
      const response = await api.get('/teacher/colleges-departments')
      setColleges(response.data.data.colleges || [])
      setDepartments(response.data.data.departments || [])
    } catch (error) {
      console.error('Error fetching colleges and departments:', error)
    }
  }

  const fetchStudents = async () => {
    if (!courseId) return

    setIsLoadingStudents(true)
    try {
      const params: any = { limit: 100 }
      if (selectedColleges.length > 0) {
        params.colleges = selectedColleges
      }
      if (selectedDepartments.length > 0) {
        params.departments = selectedDepartments
      }
      
      const response = await api.get(`/teacher/courses/${courseId}/students`, { params })
      setStudents(response.data.data.students || [])
    } catch (error) {
      console.error('Error fetching students:', error)
      handleApiError(error)
    } finally {
      setIsLoadingStudents(false)
    }
  }

  const toggleCollege = (college: string) => {
    setSelectedColleges(prev =>
      prev.includes(college)
        ? prev.filter(c => c !== college)
        : [...prev, college]
    )
  }

  const toggleDepartment = (department: string) => {
    setSelectedDepartments(prev =>
      prev.includes(department)
        ? prev.filter(d => d !== department)
        : [...prev, department]
    )
  }

  const clearFilters = () => {
    setSelectedColleges([])
    setSelectedDepartments([])
  }

  const filteredColleges = colleges.filter(c =>
    c.toLowerCase().includes(collegeSearch.toLowerCase())
  )

  const filteredDepartments = departments.filter(d =>
    d.toLowerCase().includes(departmentSearch.toLowerCase())
  )

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getCLIColor = (cli: number) => {
    if (cli <= 35) return 'text-green-600'
    if (cli <= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const handleExportExcel = () => {
    if (!course || !analytics || students.length === 0) {
      toast.error('No data to export')
      return
    }

    try {
      const sheets: Array<{ name: string; data: any[] }> = [
        {
          name: 'Summary',
          data: [
            { Metric: 'Course Title', Value: course.title },
            { Metric: 'Total Videos', Value: course.totalVideos },
            { Metric: '', Value: '' },
            { Metric: 'Total Students', Value: analytics.totalStudents },
            { Metric: 'Total Assessments', Value: analytics.totalAssessments },
            { Metric: 'Average Score', Value: `${analytics.averageScore.toFixed(1)}%` },
            { Metric: 'Average CLI', Value: analytics.averageCLI.toFixed(1) },
            { Metric: 'Average Completion', Value: `${analytics.averageCompletion.toFixed(1)}%` },
            { Metric: '', Value: '' },
            { Metric: 'Score Distribution', Value: '' },
            { Metric: '  Excellent (≥80%)', Value: analytics.scoreDistribution.excellent },
            { Metric: '  Good (60-79%)', Value: analytics.scoreDistribution.good },
            { Metric: '  Needs Improvement (<60%)', Value: analytics.scoreDistribution.needsImprovement },
            { Metric: '', Value: '' },
            { Metric: 'CLI Distribution', Value: '' },
            { Metric: '  Low Load (≤35)', Value: analytics.cliDistribution.low },
            { Metric: '  Moderate (36-70)', Value: analytics.cliDistribution.moderate },
            { Metric: '  High Load (>70)', Value: analytics.cliDistribution.high }
          ]
        },
        {
          name: 'Students Summary',
          data: students.map(student => ({
            'Student Name': student.name,
            'Email': student.email,
            'College': student.college || '',
            'Department': student.department || '',
            'Total Assessments': student.stats.totalAssessments,
            'Average Score (%)': student.stats.averageScore.toFixed(1),
            'Average CLI': student.stats.averageCLI.toFixed(1),
            'Completion (%)': student.progress ? student.progress.completionPercentage.toFixed(1) : '0',
            'Completed Videos': student.progress ? student.progress.completedVideos : 0,
            'Total Videos': student.progress ? student.progress.totalVideos : 0,
            'Average Test Score': student.progress ? student.progress.averageTestScore.toFixed(1) : '0'
          }))
        }
      ]

      // Add detailed student assessments if available
      const allAssessments: any[] = []
      students.forEach(student => {
        if (student.assessments && student.assessments.length > 0) {
          student.assessments.forEach(assessment => {
            allAssessments.push({
              'Student Name': student.name,
              'Email': student.email,
              'College': student.college || '',
              'Department': student.department || '',
              'Video Title': assessment.videoTitle,
              'Video ID': assessment.videoId,
              'Test Score (%)': assessment.testScore ? assessment.testScore.toFixed(1) : '0',
              'CLI': assessment.cli ? assessment.cli.toFixed(1) : '0',
              'CLI Classification': assessment.cliClassification || 'N/A',
              'Assessment Date': formatDateForExport(assessment.createdAt)
            })
          })
        }
      })

      if (allAssessments.length > 0) {
        sheets.push({
          name: 'Student Assessments',
          data: allAssessments
        })
      }

      // Add video analytics if available
      if (videoAnalytics.length > 0) {
        sheets.push({
          name: 'Video Performance',
          data: videoAnalytics.map(video => ({
            'Video Title': video.title,
            'Completed By': video.completedBy,
            'Total Assessments': video.totalAssessments,
            'Average Score (%)': video.averageScore.toFixed(1),
            'Average CLI': video.averageCLI.toFixed(1)
          }))
        })
      }

      const filename = `Course_Analytics_${course.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}`
      exportMultipleSheets(sheets, filename)
      toast.success('Analytics exported to Excel successfully!')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export analytics')
    }
  }

  const handleExportCSV = () => {
    if (!course || !analytics || students.length === 0) {
      toast.error('No data to export')
      return
    }

    try {
      // Export detailed student assessments as CSV
      const allAssessments: any[] = []
      students.forEach(student => {
        if (student.assessments && student.assessments.length > 0) {
          student.assessments.forEach(assessment => {
            allAssessments.push({
              'Student Name': student.name,
              'Email': student.email,
              'College': student.college || '',
              'Department': student.department || '',
              'Video Title': assessment.videoTitle,
              'Test Score (%)': assessment.testScore ? assessment.testScore.toFixed(1) : '0',
              'CLI': assessment.cli ? assessment.cli.toFixed(1) : '0',
              'CLI Classification': assessment.cliClassification || 'N/A',
              'Assessment Date': formatDateForExport(assessment.createdAt),
              'Total Assessments': student.stats.totalAssessments,
              'Average Score (%)': student.stats.averageScore.toFixed(1),
              'Completion (%)': student.progress ? student.progress.completionPercentage.toFixed(1) : '0'
            })
          })
        } else {
          // Include students with no assessments but with progress
          allAssessments.push({
            'Student Name': student.name,
            'Email': student.email,
            'College': student.college || '',
            'Department': student.department || '',
            'Video Title': 'N/A',
            'Test Score (%)': '0',
            'CLI': '0',
            'CLI Classification': 'N/A',
            'Assessment Date': 'N/A',
            'Total Assessments': student.stats.totalAssessments,
            'Average Score (%)': student.stats.averageScore.toFixed(1),
            'Completion (%)': student.progress ? student.progress.completionPercentage.toFixed(1) : '0'
          })
        }
      })

      const filename = `Course_Analytics_${course.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}`
      exportToCSV(allAssessments.length > 0 ? allAssessments : students.map(student => ({
        'Student Name': student.name,
        'Email': student.email,
        'College': student.college || '',
        'Department': student.department || '',
        'Total Assessments': student.stats.totalAssessments,
        'Average Score (%)': student.stats.averageScore.toFixed(1),
        'Average CLI': student.stats.averageCLI.toFixed(1),
        'Completion (%)': student.progress ? student.progress.completionPercentage.toFixed(1) : '0'
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

  if (!course || !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Course not found</h2>
          <button
            onClick={() => navigate('/teacher/dashboard')}
            className="btn btn-primary mt-4"
          >
            Back to Dashboard
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
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/teacher/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            <div className="relative export-menu-container">
              <button
                className="btn btn-outline flex items-center gap-2"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Analytics"
              >
                <Download className="w-5 h-5" />
                <span className="hidden sm:inline">Export</span>
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
          </div>
          <div className="flex items-start gap-6">
            {course.thumbnail && (
              <img
                src={course.thumbnail}
                alt={course.title}
                className="w-32 h-32 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{course.title}</h1>
              <p className="text-lg text-gray-600">{course.description}</p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Students</h3>
            <p className="text-3xl font-bold text-gray-900">{analytics.totalStudents}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Average Score</h3>
            <p className="text-3xl font-bold text-gray-900">{analytics.averageScore.toFixed(1)}%</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <Brain className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Average CLI</h3>
            <p className="text-3xl font-bold text-gray-900">{analytics.averageCLI.toFixed(1)}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Avg Completion</h3>
            <p className="text-3xl font-bold text-gray-900">{analytics.averageCompletion.toFixed(1)}%</p>
          </div>
        </div>

        {/* Score Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Score Distribution</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-green-600">Excellent (≥80%)</span>
                  <span className="text-sm font-bold">{analytics.scoreDistribution.excellent}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full"
                    style={{
                      width: `${(analytics.scoreDistribution.excellent / analytics.totalAssessments) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-600">Good (60-79%)</span>
                  <span className="text-sm font-bold">{analytics.scoreDistribution.good}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-yellow-600 h-3 rounded-full"
                    style={{
                      width: `${(analytics.scoreDistribution.good / analytics.totalAssessments) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-red-600">Needs Improvement (&lt;60%)</span>
                  <span className="text-sm font-bold">{analytics.scoreDistribution.needsImprovement}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-red-600 h-3 rounded-full"
                    style={{
                      width: `${(analytics.scoreDistribution.needsImprovement / analytics.totalAssessments) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">CLI Distribution</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-green-600">Low Load (≤35)</span>
                  <span className="text-sm font-bold">{analytics.cliDistribution.low}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full"
                    style={{
                      width: `${(analytics.cliDistribution.low / analytics.totalAssessments) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-600">Moderate (36-70)</span>
                  <span className="text-sm font-bold">{analytics.cliDistribution.moderate}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-yellow-600 h-3 rounded-full"
                    style={{
                      width: `${(analytics.cliDistribution.moderate / analytics.totalAssessments) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-red-600">High Load (&gt;70)</span>
                  <span className="text-sm font-bold">{analytics.cliDistribution.high}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-red-600 h-3 rounded-full"
                    style={{
                      width: `${(analytics.cliDistribution.high / analytics.totalAssessments) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Video Analytics */}
        {videoAnalytics.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Video Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Video</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Completed</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Tests</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg CLI</th>
                  </tr>
                </thead>
                <tbody>
                  {videoAnalytics.map((video) => (
                    <tr key={video.videoId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900 line-clamp-1">{video.title}</p>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">{video.completedBy}</td>
                      <td className="py-3 px-4 text-center text-gray-600">{video.totalAssessments}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(video.averageScore)}`}>
                          {video.averageScore.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-sm font-medium ${getCLIColor(video.averageCLI)}`}>
                          {video.averageCLI.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </h2>
            <div className="flex items-center gap-2">
              {(selectedColleges.length > 0 || selectedDepartments.length > 0) && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn btn-sm btn-outline"
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* College Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by College
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={collegeSearch}
                    onChange={(e) => setCollegeSearch(e.target.value)}
                    placeholder="Search colleges..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto">
                  {filteredColleges.length > 0 ? (
                    filteredColleges.map((college) => (
                      <label
                        key={college}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedColleges.includes(college)}
                          onChange={() => toggleCollege(college)}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{college}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No colleges found</p>
                  )}
                </div>
                {selectedColleges.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedColleges.map((college) => (
                      <span
                        key={college}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                      >
                        {college}
                        <button
                          onClick={() => toggleCollege(college)}
                          className="hover:text-primary-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Department Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Department
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={departmentSearch}
                    onChange={(e) => setDepartmentSearch(e.target.value)}
                    placeholder="Search departments..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto">
                  {filteredDepartments.length > 0 ? (
                    filteredDepartments.map((department) => (
                      <label
                        key={department}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDepartments.includes(department)}
                          onChange={() => toggleDepartment(department)}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{department}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No departments found</p>
                  )}
                </div>
                {selectedDepartments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedDepartments.map((department) => (
                      <span
                        key={department}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                      >
                        {department}
                        <button
                          onClick={() => toggleDepartment(department)}
                          className="hover:text-primary-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Students List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Students ({students.length})
            {(selectedColleges.length > 0 || selectedDepartments.length > 0) && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (Filtered)
              </span>
            )}
          </h2>
          {isLoadingStudents ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Student</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Progress</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Tests</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg CLI</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
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
                        {student.progress ? (
                          <span className="text-sm font-medium text-gray-900">
                            {student.progress.completionPercentage.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600">{student.stats.totalAssessments}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(student.stats.averageScore)}`}>
                          {student.stats.averageScore.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-sm font-medium ${getCLIColor(student.stats.averageCLI)}`}>
                          {student.stats.averageCLI.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="btn btn-sm btn-primary"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No students enrolled in this course yet
            </div>
          )}
        </div>
      </div>

      {/* Student Progress Modal */}
      {selectedStudent && courseId && (
        <StudentProgressModal
          courseId={courseId}
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  )
}

export default CourseAnalyticsPage

