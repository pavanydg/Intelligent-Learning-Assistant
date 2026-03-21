import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Users, TrendingUp, Award, BarChart3, Target, Brain, Clock, Eye, Key, Download, FileSpreadsheet } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'
import StudentProgressModal from '../components/StudentProgressModal'
import { exportToExcel, exportToCSV, exportMultipleSheets, formatDateForExport } from '../utils/exportUtils'

interface Course {
  id: string
  playlistId: string
  title: string
  thumbnail: string
  totalVideos: number
}

interface CourseKey {
  id: string
  key: string
  courseId: string
  courseTitle: string
  description: string
  usageCount: number
  createdAt: string
  expiresAt: string | null
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
    totalWatchTime: number
    lastUpdated: string
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

const CourseKeyAnalyticsPage: React.FC = () => {
  const { keyId } = useParams<{ keyId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading: authLoading, token } = useAuthStore()

  const [courseKey, setCourseKey] = useState<CourseKey | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)

  useEffect(() => {
    if (location.pathname !== `/teacher/course-keys/${keyId}/analytics`) {
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
      navigate('/dashboard', { replace: true })
      setIsLoading(false)
      return
    }

    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    if (keyId) {
      fetchAnalytics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId, user, location.pathname, authLoading, token])

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
    if (!keyId) return

    setIsLoading(true)
    try {
      const response = await api.get(`/teacher/course-keys/${keyId}/analytics`)
      setCourseKey(response.data.data.courseKey)
      setCourse(response.data.data.course)
      setStudents(response.data.data.students || [])
    } catch (error) {
      console.error('Error fetching course key analytics:', error)
      handleApiError(error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!courseKey || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Course Key Not Found</h2>
          <button onClick={() => navigate('/teacher/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const totalStudents = students.length
  const totalAssessments = students.reduce((sum, s) => sum + s.stats.totalAssessments, 0)
  const avgScore = students.length > 0
    ? students.reduce((sum, s) => sum + s.stats.averageScore, 0) / students.length
    : 0
  const avgCLI = students.length > 0
    ? students.reduce((sum, s) => sum + s.stats.averageCLI, 0) / students.length
    : 0
  const avgCompletion = students.length > 0
    ? students.reduce((sum, s) => sum + (s.progress?.completionPercentage || 0), 0) / students.length
    : 0

  const handleExportExcel = () => {
    if (!courseKey || !course || students.length === 0) {
      toast.error('No data to export')
      return
    }

    try {
      const sheets = [
        {
          name: 'Summary',
          data: [
            { Metric: 'Course Title', Value: courseKey.courseTitle },
            { Metric: 'Course Key', Value: courseKey.key },
            { Metric: 'Description', Value: courseKey.description || 'N/A' },
            { Metric: 'Total Videos', Value: course.totalVideos },
            { Metric: '', Value: '' },
            { Metric: 'Total Students', Value: totalStudents },
            { Metric: 'Total Assessments', Value: totalAssessments },
            { Metric: 'Average Score', Value: `${Math.round(avgScore)}%` },
            { Metric: 'Average CLI', Value: Math.round(avgCLI) },
            { Metric: 'Average Completion', Value: `${Math.round(avgCompletion)}%` }
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

      const filename = `CourseKey_Analytics_${courseKey.key}_${courseKey.courseTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}`
      exportMultipleSheets(sheets, filename)
      toast.success('Analytics exported to Excel successfully!')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export analytics')
    }
  }

  const handleExportCSV = () => {
    if (!courseKey || !course || students.length === 0) {
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

      const filename = `CourseKey_Analytics_${courseKey.key}_${courseKey.courseTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}`
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
              Back to Dashboard
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
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Key className="w-8 h-8 text-primary-600" />
                <h1 className="text-3xl font-bold text-gray-900">Course Key Analytics</h1>
              </div>
              <p className="text-lg text-gray-600">{courseKey.courseTitle}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm font-mono font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded">
                  {courseKey.key}
                </span>
                {courseKey.description && (
                  <span className="text-sm text-gray-600">{courseKey.description}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">{totalStudents}</p>
              </div>
              <Users className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Assessments</p>
                <p className="text-3xl font-bold text-gray-900">{totalAssessments}</p>
              </div>
              <Target className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Average Score</p>
                <p className="text-3xl font-bold text-gray-900">{Math.round(avgScore)}%</p>
              </div>
              <Award className="w-12 h-12 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Completion</p>
                <p className="text-3xl font-bold text-gray-900">{Math.round(avgCompletion)}%</p>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Students List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Students ({students.length})
          </h2>
          {students.length > 0 ? (
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
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {student.progress.completedVideos} / {student.progress.totalVideos}
                            </p>
                            <p className="text-xs text-gray-500">
                              {Math.round(student.progress.completionPercentage)}%
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No progress</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm font-medium text-gray-900">
                          {student.stats.totalAssessments}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-sm font-medium ${
                          student.stats.averageScore >= 80 ? 'text-green-600' :
                          student.stats.averageScore >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {Math.round(student.stats.averageScore)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-sm font-medium ${
                          student.stats.averageCLI <= 35 ? 'text-green-600' :
                          student.stats.averageCLI <= 70 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {Math.round(student.stats.averageCLI)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="btn btn-sm btn-outline"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-600 py-8">No students have accessed this course yet.</p>
          )}
        </div>
      </div>

      {/* Student Progress Modal */}
      {selectedStudent && (
        <StudentProgressModal
          student={selectedStudent}
          courseId={courseKey.courseId}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  )
}

export default CourseKeyAnalyticsPage

