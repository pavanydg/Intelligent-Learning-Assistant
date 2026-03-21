import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, BookOpen, Users, TrendingUp, Award, BarChart3, Eye, Key, Plus, Copy, Check, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'

interface Course {
  id: string
  playlistId: string
  title: string
  description: string
  thumbnail: string
  channelTitle: string
  totalVideos: number
  tags: string[]
  difficulty: string
  category: string
}

interface CourseKey {
  id: string
  key: string
  courseId: string
  courseTitle: string
  courseThumbnail: string
  description: string
  isActive: boolean
  usageCount: number
  expiresAt: string | null
  createdAt: string
}

const TeacherDashboardPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([])
  const [courseKeys, setCourseKeys] = useState<CourseKey[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingKeys, setIsLoadingKeys] = useState(false)
  const [activeTab, setActiveTab] = useState<'search' | 'keys'>('search')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [showGenerateKeyModal, setShowGenerateKeyModal] = useState(false)
  const [keyDescription, setKeyDescription] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const { user, isLoading: authLoading, token } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname !== '/teacher/dashboard') {
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
      // Redirect students to their dashboard
      navigate('/dashboard', { replace: true })
      setIsLoading(false)
      return
    }

    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    // Load course keys
    fetchCourseKeys()

    // Load initial courses if search query exists
    if (searchQuery.trim()) {
      searchCourses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname, authLoading, token])

  const searchCourses = async () => {
    if (!searchQuery.trim()) {
      setCourses([])
      return
    }

    setIsSearching(true)
    try {
      const response = await api.get('/teacher/courses/search', {
        params: {
          query: searchQuery,
          limit: 20
        }
      })
      setCourses(response.data.data.courses || [])
    } catch (error) {
      console.error('Error searching courses:', error)
      handleApiError(error)
      setCourses([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchCourses()
  }

  const fetchCourseKeys = async () => {
    setIsLoadingKeys(true)
    try {
      const response = await api.get('/teacher/course-keys')
      setCourseKeys(response.data.data.courseKeys || [])
    } catch (error) {
      console.error('Error fetching course keys:', error)
      handleApiError(error)
    } finally {
      setIsLoadingKeys(false)
    }
  }

  const handleGenerateKey = async () => {
    if (!selectedCourse) return

    try {
      const response = await api.post('/teacher/course-keys/generate', {
        courseId: selectedCourse.playlistId,
        description: keyDescription
      })
      
      toast.success('Course key generated successfully!')
      setShowGenerateKeyModal(false)
      setSelectedCourse(null)
      setKeyDescription('')
      fetchCourseKeys()
    } catch (error) {
      console.error('Error generating course key:', error)
      handleApiError(error)
    }
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    toast.success('Course key copied to clipboard!')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleDeactivateKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to deactivate this course key?')) {
      return
    }

    try {
      await api.put(`/teacher/course-keys/${keyId}/deactivate`)
      toast.success('Course key deactivated successfully')
      fetchCourseKeys()
    } catch (error) {
      console.error('Error deactivating course key:', error)
      handleApiError(error)
    }
  }

  const handleCourseClick = (course: Course) => {
    if (activeTab === 'search') {
      // In search mode, show generate key modal
      setSelectedCourse(course)
      setShowGenerateKeyModal(true)
    } else {
      // In keys mode, navigate to analytics
      navigate(`/teacher/courses/${course.playlistId}/analytics`)
    }
  }

  const handleViewKeyAnalytics = (keyId: string) => {
    navigate(`/teacher/course-keys/${keyId}/analytics`)
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Teacher Dashboard</h1>
          <p className="text-lg text-gray-600">Search courses, generate keys, and analyze student performance</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'search'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Search className="w-4 h-4 inline mr-2" />
            Search Courses
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
            My Course Keys ({courseKeys.filter(k => k.isActive).length})
          </button>
        </div>

        {activeTab === 'search' ? (
          <>
            {/* Search Bar */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <form onSubmit={handleSearch} className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for courses by title, description, or tags..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="btn btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    'Search'
                  )}
                </button>
              </form>
            </div>

            {/* Courses List */}
        {courses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                onClick={() => handleCourseClick(course)}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
              >
                <div className="relative h-48 bg-gray-200">
                  {course.thumbnail ? (
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      course.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                      course.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {course.difficulty}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
                    {course.title}
                  </h3>
                  {course.channelTitle && (
                    <p className="text-sm text-gray-500 mb-3">{course.channelTitle}</p>
                  )}
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {course.description || 'No description available'}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <BarChart3 className="w-4 h-4" />
                      <span>{course.totalVideos} videos</span>
                    </div>
                    <div className="flex items-center gap-1 text-primary-600 font-medium">
                      <Key className="w-4 h-4" />
                      <span>Generate Key</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery.trim() ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No courses found</h3>
            <p className="text-gray-600">Try a different search query</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Search for Courses</h3>
            <p className="text-gray-600">Enter a search query above to find courses and generate keys for them</p>
          </div>
        )}
          </>
        ) : (
          <>
            {/* Course Keys List */}
            {isLoadingKeys ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : courseKeys.length > 0 ? (
              <div className="space-y-4">
                {courseKeys.map((courseKey) => (
                  <div
                    key={courseKey.id}
                    className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {courseKey.courseThumbnail && (
                            <img
                              src={courseKey.courseThumbnail}
                              alt={courseKey.courseTitle}
                              className="w-16 h-12 object-cover rounded"
                            />
                          )}
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {courseKey.courseTitle}
                            </h3>
                            {courseKey.description && (
                              <p className="text-sm text-gray-600">{courseKey.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-4">
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-mono font-bold text-primary-600">
                              {courseKey.key}
                            </span>
                            <button
                              onClick={() => handleCopyKey(courseKey.key)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              {copiedKey === courseKey.key ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Users className="w-4 h-4" />
                            <span>{courseKey.usageCount} student{courseKey.usageCount !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Created: {new Date(courseKey.createdAt).toLocaleDateString()}
                          </div>
                          {courseKey.expiresAt && (
                            <div className="text-sm text-gray-500">
                              Expires: {new Date(courseKey.expiresAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {courseKey.isActive ? (
                          <>
                            <button
                              onClick={() => handleViewKeyAnalytics(courseKey.id)}
                              className="btn btn-sm btn-primary"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Analytics
                            </button>
                            <button
                              onClick={() => handleDeactivateKey(courseKey.id)}
                              className="btn btn-sm btn-outline"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Deactivate
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-gray-500 italic">Inactive</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <Key className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Course Keys Yet</h3>
                <p className="text-gray-600 mb-6">
                  Search for courses and generate keys to share with your students
                </p>
                <button
                  onClick={() => setActiveTab('search')}
                  className="btn btn-primary"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Search Courses
                </button>
              </div>
            )}
          </>
        )}

        {/* Generate Key Modal */}
        {showGenerateKeyModal && selectedCourse && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowGenerateKeyModal(false)}></div>
              <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate Course Key</h2>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Course:</p>
                  <p className="font-medium text-gray-900">{selectedCourse.title}</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={keyDescription}
                    onChange={(e) => setKeyDescription(e.target.value)}
                    placeholder="e.g., Spring 2024 - CS101"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowGenerateKeyModal(false)
                      setSelectedCourse(null)
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
      </div>
    </div>
  )
}

export default TeacherDashboardPage

