import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, certificateApi, handleApiError } from '../services/api'
import { Award, BookOpen, Clock, Download, ArrowLeft, Trophy, TrendingUp, Target, Loader2 } from 'lucide-react'

interface CompletedCourse {
  _id: string
  playlistId: string
  courseTitle?: string
  totalVideos: number
  completedVideos: number
  completionPercentage: number
  averageTestScore?: number
  totalWatchTime?: number
  completedAt?: string
  certificateId?: string | null
  certificateNumber?: string | null
  certificateIssuedAt?: string | null
}

const CompletedPage: React.FC = () => {
  const navigate = useNavigate()
  const [items, setItems] = useState<CompletedCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get('/completed-courses')
        setItems(res.data?.data?.completedCourses || [])
      } catch (error) {
        handleApiError(error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const downloadCertificate = async (certificateId: string, title: string) => {
    try {
      const response = await certificateApi.get(`/certificates/${certificateId}/download`, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const safeTitle = (title || 'certificate').replace(/[^a-z0-9\-\s]/gi, '')
      link.download = `${safeTitle}_certificate.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      handleApiError(error)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/profile')} className="flex items-center text-gray-600 hover:text-primary-600 mb-6">
        <ArrowLeft className="h-5 w-5 mr-2" /> Back to Profile
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Completed Courses & Certificates</h1>
        <p className="text-gray-600">Review your completed playlists and download certificates</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No completed courses yet</h3>
          <p className="text-gray-600 mb-4">Finish a playlist to earn your first certificate</p>
          <button onClick={() => navigate('/search')} className="btn btn-primary">Find Courses</button>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map(course => (
            <div key={course._id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <Trophy className="h-5 w-5 text-yellow-500 mr-2" />
                    <h4 className="text-lg font-semibold text-gray-900">{course.courseTitle || course.playlistId}</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center"><BookOpen className="h-4 w-4 mr-1" />{course.completedVideos} of {course.totalVideos} videos completed</div>
                    <div className="flex items-center"><Clock className="h-4 w-4 mr-1" />{course.completedAt ? `Completed ${new Date(course.completedAt).toLocaleDateString()}` : 'Completion date unavailable'}</div>
                    {course.averageTestScore ? (
                      <div className="flex items-center"><Target className="h-4 w-4 mr-1" />{course.averageTestScore}% average score</div>
                    ) : null}
                    <div className="flex items-center"><TrendingUp className="h-4 w-4 mr-1" />{Math.round((course.totalWatchTime || 0)/60)} min total time</div>
                  </div>

                  {course.certificateId ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Award className="h-5 w-5 text-green-600 mr-2" />
                          <div>
                            <p className="text-sm font-medium text-green-900">Certificate Available</p>
                            <p className="text-xs text-green-700">{course.certificateNumber ? `#${course.certificateNumber}` : 'Ready'}{course.certificateIssuedAt ? ` • Issued ${new Date(course.certificateIssuedAt).toLocaleDateString()}` : ''}</p>
                          </div>
                        </div>
                        <button onClick={() => downloadCertificate(course.certificateId as string, course.courseTitle || 'Course')} className="btn btn-sm btn-primary flex items-center">
                          <Download className="h-4 w-4 mr-1" /> Download
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin text-yellow-600 mr-2" />
                        <p className="text-sm text-yellow-800">Certificate is being generated...</p>
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
  )
}

export default CompletedPage


