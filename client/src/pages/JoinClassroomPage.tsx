import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, LogIn, Loader2, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'

interface Classroom {
  id: string
  name: string
  description: string
  teacherName: string
  joinedAt: string
  studentCount: number
  metadata: {
    subject?: string
    semester?: string
    academicYear?: string
  }
}

const JoinClassroomPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const [joinCode, setJoinCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [myClassrooms, setMyClassrooms] = useState<Classroom[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    fetchMyClassrooms()
  }, [token])

  const fetchMyClassrooms = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/classrooms/student/my-classrooms')
      setMyClassrooms(response.data.data.classrooms || [])
    } catch (error) {
      console.error('Error fetching classrooms:', error)
      handleApiError(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) {
      toast.error('Please enter a join code')
      return
    }

    setIsJoining(true)
    try {
      const response = await api.post('/classrooms/join', {
        joinCode: joinCode.trim().toUpperCase()
      })

      toast.success(`Successfully joined ${response.data.data.classroom.name}!`)
      setJoinCode('')
      fetchMyClassrooms()
      // Navigate to the classroom
      navigate(`/classrooms/${response.data.data.classroom.id}`)
    } catch (error: any) {
      console.error('Error joining classroom:', error)
      const errorMessage = error.response?.data?.message || 'Failed to join classroom'
      toast.error(errorMessage)
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeave = async (classroomId: string) => {
    if (!confirm('Are you sure you want to leave this classroom?')) {
      return
    }

    try {
      await api.post(`/classrooms/${classroomId}/leave`)
      toast.success('Left classroom successfully')
      fetchMyClassrooms()
    } catch (error) {
      console.error('Error leaving classroom:', error)
      handleApiError(error)
      toast.error('Failed to leave classroom')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Join Classroom</h1>
        <p className="text-gray-600">Enter a join code to join a classroom</p>
      </div>

      {/* Join Form */}
      <div className="card mb-8">
        <div className="card-content">
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Join Code
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="input flex-1 text-center text-2xl font-bold font-mono tracking-widest"
                  placeholder="ABCD12"
                  maxLength={6}
                  required
                />
                <button
                  type="submit"
                  disabled={isJoining || !joinCode.trim()}
                  className="btn btn-primary"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5 mr-2" />
                      Join
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Ask your teacher for the 6-character join code
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* My Classrooms */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">My Classrooms</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : myClassrooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myClassrooms.map((classroom) => (
              <div
                key={classroom.id}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/classrooms/${classroom.id}`)}
              >
                <div className="card-content">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {classroom.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Teacher: {classroom.teacherName}
                      </p>
                      {classroom.metadata.subject && (
                        <p className="text-xs text-gray-500 mt-1">
                          {classroom.metadata.subject}
                          {classroom.metadata.semester && ` • ${classroom.metadata.semester}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {classroom.studentCount} students
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLeave(classroom.id)
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="card-content">
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p>You haven't joined any classrooms yet</p>
                <p className="text-sm mt-1">Enter a join code above to get started</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default JoinClassroomPage

