import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Copy, Check, Settings, Trash2, Eye, Loader2, Bell, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'

interface Classroom {
  id: string
  name: string
  description: string
  joinCode: string
  studentCount: number
  students: Array<{
    studentId: string
    name: string
    email: string
    joinedAt: string
  }>
  isActive: boolean
  settings: {
    allowStudentJoin: boolean
    requireApproval: boolean
    maxStudents: number | null
  }
  metadata: {
    subject?: string
    semester?: string
    academicYear?: string
  }
  createdAt: string
}

const ClassroomPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [newClassroom, setNewClassroom] = useState({
    name: '',
    description: '',
    subject: '',
    semester: '',
    academicYear: ''
  })
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    fetchClassrooms()
  }, [token])

  const fetchClassrooms = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/classrooms/teacher/my-classrooms')
      setClassrooms(response.data.data.classrooms || [])
    } catch (error) {
      console.error('Error fetching classrooms:', error)
      handleApiError(error)
      toast.error('Failed to load classrooms')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClassroom.name.trim()) {
      toast.error('Classroom name is required')
      return
    }

    setIsCreating(true)
    try {
      const response = await api.post('/classrooms', {
        name: newClassroom.name,
        description: newClassroom.description,
        metadata: {
          subject: newClassroom.subject || undefined,
          semester: newClassroom.semester || undefined,
          academicYear: newClassroom.academicYear || undefined
        }
      })

      toast.success('Classroom created successfully!')
      setShowCreateModal(false)
      setNewClassroom({ name: '', description: '', subject: '', semester: '', academicYear: '' })
      fetchClassrooms()
    } catch (error) {
      console.error('Error creating classroom:', error)
      handleApiError(error)
      toast.error('Failed to create classroom')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast.success('Join code copied to clipboard!')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleDeleteClassroom = async (id: string) => {
    if (!confirm('Are you sure you want to delete this classroom? This will also delete all announcements.')) {
      return
    }

    try {
      await api.delete(`/classrooms/${id}`)
      toast.success('Classroom deleted successfully')
      fetchClassrooms()
    } catch (error) {
      console.error('Error deleting classroom:', error)
      handleApiError(error)
      toast.error('Failed to delete classroom')
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Classrooms</h1>
          <p className="text-gray-600">Create and manage your virtual classrooms</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Classroom
        </button>
      </div>

      {/* Classrooms Grid */}
      {classrooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map((classroom) => (
            <div
              key={classroom.id}
              className="card hover:shadow-lg transition-shadow"
            >
              <div className="card-content">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      {classroom.name}
                    </h3>
                    {classroom.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {classroom.description}
                      </p>
                    )}
                    {classroom.metadata.subject && (
                      <p className="text-xs text-gray-500">
                        {classroom.metadata.subject}
                        {classroom.metadata.semester && ` • ${classroom.metadata.semester}`}
                      </p>
                    )}
                  </div>
                  {!classroom.isActive && (
                    <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Join Code */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <p className="text-xs text-blue-600 font-medium mb-1">Join Code</p>
                      <p className="text-lg font-bold text-blue-900 font-mono">
                        {classroom.joinCode}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopyCode(classroom.joinCode)}
                      className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      {copiedCode === classroom.joinCode ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-blue-600" />
                      )}
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {classroom.studentCount} Student{classroom.studentCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => navigate(`/classrooms/${classroom.id}`)}
                      className="flex-1 btn btn-sm btn-primary"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => handleDeleteClassroom(classroom.id)}
                      className="btn btn-sm btn-outline text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="card-content">
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No classrooms yet
              </h3>
              <p className="text-gray-600 mb-6">
                Create your first classroom to start sharing announcements with students
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Classroom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Classroom Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create New Classroom</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClassroom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Classroom Name *
                </label>
                <input
                  type="text"
                  value={newClassroom.name}
                  onChange={(e) => setNewClassroom({ ...newClassroom, name: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., CS101 - Introduction to Programming"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newClassroom.description}
                  onChange={(e) => setNewClassroom({ ...newClassroom, description: e.target.value })}
                  className="input w-full"
                  rows={3}
                  placeholder="Optional description of the classroom"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={newClassroom.subject}
                    onChange={(e) => setNewClassroom({ ...newClassroom, subject: e.target.value })}
                    className="input w-full"
                    placeholder="e.g., Computer Science"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Semester
                  </label>
                  <input
                    type="text"
                    value={newClassroom.semester}
                    onChange={(e) => setNewClassroom({ ...newClassroom, semester: e.target.value })}
                    className="input w-full"
                    placeholder="e.g., Fall 2024"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 btn btn-primary"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Classroom'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClassroomPage

