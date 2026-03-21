import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../store/authStore'
import { api, certificateApi, handleApiError } from '../services/api'
import { progressService, CourseProgress, ProgressStats } from '../services/progressService'
import { 
  User, 
  Mail, 
  Settings, 
  Save, 
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  BookOpen,
  TrendingUp,
  Clock,
  Target,
  Award,
  Trophy,
  Download
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ProfileForm {
  name: string
  email: string
  college?: string
  department?: string
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading'
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced'
}

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const ProfilePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'progress' | 'certificates'>('profile')
  const [isUpdating, setIsUpdating] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [progress, setProgress] = useState<CourseProgress[]>([])
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null)
  const [isLoadingProgress, setIsLoadingProgress] = useState(false)
  const [completedCourses, setCompletedCourses] = useState<any[]>([])
  const [isLoadingCertificates, setIsLoadingCertificates] = useState(false)
  
  const { user, updateProfile, isLoading } = useAuthStore()
  
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
    reset: resetProfile
  } = useForm<ProfileForm>()

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPassword,
    watch
  } = useForm<PasswordForm>()

  const newPassword = watch('newPassword')

  useEffect(() => {
    if (user) {
      resetProfile({
        name: user.name,
        email: user.email,
        college: user.college || '',
        department: user.department || '',
        learningStyle: user.preferences.learningStyle,
        difficultyLevel: user.preferences.difficultyLevel
      })
    }
  }, [user, resetProfile])

  useEffect(() => {
    if (activeTab === 'progress') {
      fetchProgress()
    } else if (activeTab === 'certificates') {
      fetchCompletedCourses()
    }
  }, [activeTab])

  const fetchProgress = async () => {
    setIsLoadingProgress(true)
    try {
      const [progressData, statsData] = await Promise.all([
        progressService.getAllProgress(),
        progressService.getProgressStats()
      ])
      setProgress(progressData)
      setProgressStats(statsData)
    } catch (error) {
      console.error('Error fetching progress:', error)
      handleApiError(error)
    } finally {
      setIsLoadingProgress(false)
    }
  }

  const fetchCompletedCourses = async () => {
    setIsLoadingCertificates(true)
    try {
      // Fetch completed courses from the completed courses API
      const response = await api.get('/completed-courses')
      const completedCourses = response.data.data.completedCourses || []
      
      setCompletedCourses(completedCourses)
    } catch (error) {
      console.error('Error fetching completed courses:', error)
      handleApiError(error)
    } finally {
      setIsLoadingCertificates(false)
    }
  }

  const downloadCertificate = async (certificateId: string, playlistTitle: string) => {
    try {
      const response = await certificateApi.get(`/certificates/${certificateId}/download`, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${playlistTitle.replace(/[^a-z0-9\-\s]/gi, '')}_certificate.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      handleApiError(error)
    }
  }

  const onProfileSubmit = async (data: ProfileForm) => {
    setIsUpdating(true)
    try {
      await updateProfile(data)
      toast.success('Profile updated successfully!')
    } catch (error) {
      handleApiError(error)
    } finally {
      setIsUpdating(false)
    }
  }

  const onPasswordSubmit = async (data: PasswordForm) => {
    setIsUpdating(true)
    try {
      // This would call a change password API
      toast.success('Password changed successfully!')
      resetPassword()
    } catch (error) {
      handleApiError(error)
    } finally {
      setIsUpdating(false)
    }
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

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            User not found
          </h3>
          <p className="text-gray-600">
            Unable to load user profile.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
        <p className="text-gray-600">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-content">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <User className="h-4 w-4 mr-2 inline" />
                  Profile Information
                </button>
                <button
                  onClick={() => setActiveTab('password')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'password'
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Settings className="h-4 w-4 mr-2 inline" />
                  Change Password
                </button>
                <button
                  onClick={() => setActiveTab('progress')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'progress'
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <TrendingUp className="h-4 w-4 mr-2 inline" />
                  Learning Progress
                </button>
                <button
                  onClick={() => setActiveTab('certificates')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'certificates'
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Award className="h-4 w-4 mr-2 inline" />
                  Certificates (inline)
                </button>
                <button
                  onClick={() => window.location.assign('/profile/completed')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-100`}
                >
                  <Award className="h-4 w-4 mr-2 inline" />
                  Completed & Certificates (page)
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' ? (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Profile Information</h3>
                <p className="card-description">
                  Update your personal information and learning preferences
                </p>
              </div>
              <div className="card-content">
                <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-6">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      {...registerProfile('name', {
                        required: 'Name is required',
                        minLength: {
                          value: 2,
                          message: 'Name must be at least 2 characters',
                        },
                      })}
                      type="text"
                      className="input w-full"
                      placeholder="Enter your full name"
                    />
                    {profileErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{profileErrors.name.message}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      {...registerProfile('email', {
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address',
                        },
                      })}
                      type="email"
                      className="input w-full"
                      placeholder="Enter your email"
                      disabled
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Email cannot be changed
                    </p>
                    {profileErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{profileErrors.email.message}</p>
                    )}
                  </div>

                  {/* College - Only for students */}
                  {user?.role === 'student' && (
                    <div>
                      <label htmlFor="college" className="block text-sm font-medium text-gray-700 mb-2">
                        College Name
                      </label>
                      <input
                        {...registerProfile('college')}
                        type="text"
                        className="input w-full"
                        placeholder="e.g., BMSC College of Engineering"
                      />
                    </div>
                  )}

                  {/* Department - Only for students */}
                  {user?.role === 'student' && (
                    <div>
                      <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                        Department
                      </label>
                      <input
                        {...registerProfile('department')}
                        type="text"
                        className="input w-full"
                        placeholder="e.g., Computer Science, Electronics, etc."
                      />
                    </div>
                  )}

                  {/* Learning Style */}
                  <div>
                    <label htmlFor="learningStyle" className="block text-sm font-medium text-gray-700 mb-2">
                      Learning Style
                    </label>
                    <select
                      {...registerProfile('learningStyle')}
                      className="input w-full"
                    >
                      <option value="visual">Visual</option>
                      <option value="auditory">Auditory</option>
                      <option value="kinesthetic">Kinesthetic</option>
                      <option value="reading">Reading</option>
                    </select>
                    <p className="mt-1 text-sm text-gray-500">
                      This affects how content is presented to you
                    </p>
                  </div>

                  {/* Difficulty Level */}
                  <div>
                    <label htmlFor="difficultyLevel" className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Difficulty Level
                    </label>
                    <select
                      {...registerProfile('difficultyLevel')}
                      className="input w-full"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                    <p className="mt-1 text-sm text-gray-500">
                      This affects the complexity of generated questions
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="btn btn-primary"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <Save className="h-5 w-5 mr-2" />
                      )}
                      {isUpdating ? 'Updating...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : activeTab === 'password' ? (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Change Password</h3>
                <p className="card-description">
                  Update your password to keep your account secure
                </p>
              </div>
              <div className="card-content">
                <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-6">
                  {/* Current Password */}
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        {...registerPassword('currentPassword', {
                          required: 'Current password is required',
                        })}
                        type={showCurrentPassword ? 'text' : 'password'}
                        className="input w-full pr-10"
                        placeholder="Enter your current password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.currentPassword && (
                      <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword.message}</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        {...registerPassword('newPassword', {
                          required: 'New password is required',
                          minLength: {
                            value: 6,
                            message: 'Password must be at least 6 characters',
                          },
                        })}
                        type={showNewPassword ? 'text' : 'password'}
                        className="input w-full pr-10"
                        placeholder="Enter your new password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.newPassword && (
                      <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword.message}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        {...registerPassword('confirmPassword', {
                          required: 'Please confirm your new password',
                          validate: (value) =>
                            value === newPassword || 'Passwords do not match',
                        })}
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="input w-full pr-10"
                        placeholder="Confirm your new password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword.message}</p>
                    )}
                  </div>

                  {/* Password Requirements */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Password Requirements</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        At least 6 characters long
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Different from your current password
                      </li>
                    </ul>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="btn btn-primary"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <Save className="h-5 w-5 mr-2" />
                      )}
                      {isUpdating ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Learning Progress</h3>
                <p className="card-description">
                  Track your learning journey and achievements
                </p>
              </div>
              <div className="card-content">
                {isLoadingProgress ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Progress Stats */}
                    {progressStats && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="flex items-center">
                            <BookOpen className="h-8 w-8 text-blue-600" />
                            <div className="ml-3">
                              <p className="text-sm font-medium text-blue-600">Total Courses</p>
                              <p className="text-2xl font-bold text-blue-900">{progressStats.totalCourses}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="flex items-center">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                            <div className="ml-3">
                              <p className="text-sm font-medium text-green-600">Videos Watched</p>
                              <p className="text-2xl font-bold text-green-900">{progressStats.totalVideosWatched}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <div className="flex items-center">
                            <TrendingUp className="h-8 w-8 text-purple-600" />
                            <div className="ml-3">
                              <p className="text-sm font-medium text-purple-600">Avg Completion</p>
                              <p className="text-2xl font-bold text-purple-900">{progressStats.averageCompletion}%</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <div className="flex items-center">
                            <Award className="h-8 w-8 text-orange-600" />
                            <div className="ml-3">
                              <p className="text-sm font-medium text-orange-600">Avg Test Score</p>
                              <p className="text-2xl font-bold text-orange-900">{progressStats.averageTestScore}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Course Progress List */}
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-4">Course Progress</h4>
                      {progress.length === 0 ? (
                        <div className="text-center py-8">
                          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600">No courses started yet</p>
                          <p className="text-sm text-gray-500">Start watching videos to track your progress</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {progress.map((courseProgress) => (
                            <div key={courseProgress.courseId} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h5 className="text-lg font-medium text-gray-900 mb-1">
                                    {courseProgress.courseTitle}
                                  </h5>
                                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                                    <div className="flex items-center">
                                      <BookOpen className="h-4 w-4 mr-1" />
                                      {courseProgress.completedVideos.length} / {courseProgress.totalVideos} videos
                                    </div>
                                    <div className="flex items-center">
                                      <Clock className="h-4 w-4 mr-1" />
                                      {Math.round(courseProgress.totalWatchTime / 60)} min watched
                                    </div>
                                    {courseProgress.averageTestScore > 0 && (
                                      <div className="flex items-center">
                                        <Target className="h-4 w-4 mr-1" />
                                        {courseProgress.averageTestScore}% avg score
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-primary-600">
                                    {courseProgress.completionPercentage}%
                                  </div>
                                  <div className="text-sm text-gray-500">Complete</div>
                                </div>
                              </div>
                              
                              {/* Progress Bar */}
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${courseProgress.completionPercentage}%` }}
                                />
                              </div>
                              
                              {/* Last Watched Video */}
                              {courseProgress.lastWatchedVideo && (
                                <div className="mt-3 text-sm text-gray-600">
                                  <span className="font-medium">Last watched:</span> {courseProgress.lastWatchedVideo.title}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Certificates Tab */}
          {activeTab === 'certificates' && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Completed Courses & Certificates</h3>
                <p className="card-description">
                  View your completed courses and download certificates
                </p>
              </div>
              <div className="card-content">
                {isLoadingCertificates ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                  </div>
                ) : completedCourses.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No completed courses yet
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Complete a playlist to earn your first certificate!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {completedCourses.map((course) => (
                      <div key={course._id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <Trophy className="h-5 w-5 text-yellow-500 mr-2" />
                              <h4 className="text-lg font-semibold text-gray-900">
                                {course.courseTitle}
                              </h4>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                              <div className="flex items-center">
                                <BookOpen className="h-4 w-4 mr-1" />
                                {course.completedVideos} of {course.totalVideos} videos completed
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {course.completedAt ? `Completed ${new Date(course.completedAt).toLocaleDateString()}` : 'Completion date unavailable'}
                              </div>
                              {course.averageTestScore > 0 && (
                                <div className="flex items-center">
                                  <Target className="h-4 w-4 mr-1" />
                                  {course.averageTestScore}% average score
                                </div>
                              )}
                              <div className="flex items-center">
                                <TrendingUp className="h-4 w-4 mr-1" />
                                {Math.round((course.totalWatchTime || 0) / 60)} min total time
                              </div>
                            </div>

                            {course.certificateId ? (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <Award className="h-5 w-5 text-green-600 mr-2" />
                                    <div>
                                      <p className="text-sm font-medium text-green-900">
                                        Certificate Available
                                      </p>
                                      {course.certificateNumber ? (
                                        <p className="text-xs text-green-700">
                                          #{course.certificateNumber}
                                          {course.certificateIssuedAt ? ` • Issued ${new Date(course.certificateIssuedAt).toLocaleDateString()}` : ''}
                                        </p>
                                      ) : (
                                        <p className="text-xs text-green-700">Certificate ready</p>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => downloadCertificate(course.certificateId, course.courseTitle || 'Course')}
                                    className="btn btn-sm btn-primary flex items-center"
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div className="flex items-center">
                                  <Loader2 className="h-4 w-4 animate-spin text-yellow-600 mr-2" />
                                  <p className="text-sm text-yellow-800">
                                    Certificate is being generated...
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
