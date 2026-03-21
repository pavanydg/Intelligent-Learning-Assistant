import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pin, Trash2, Edit2, Users, Bell, X, Loader2, BookOpen, FileText, Search, Clock, Mail, GraduationCap, Building2, Calendar, Key, Upload, Download, File } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import toast from 'react-hot-toast'

interface Classroom {
  id: string
  name: string
  description: string
  joinCode?: string
  teacherId: string
  teacherName: string
  teacherEmail?: string
  students: Array<{
    studentId: string
    name: string
    email: string
    college?: string
    department?: string
    joinedAt: string
  }>
  isActive: boolean
  metadata: {
    subject?: string
    semester?: string
    academicYear?: string
  }
  linkedCourses?: Array<{
    courseId: string
    courseKey: string
    courseTitle: string
    courseThumbnail?: string
    addedAt: string
  }>
  linkedQuizzes?: Array<{
    quizId: string
    quizKey: string
    quizTitle: string
    addedAt: string
    scheduledStartTime?: string
    scheduledEndTime?: string
  }>
}

interface Announcement {
  id: string
  title: string
  content: string
  authorName: string
  authorId: string
  isPinned: boolean
  metadata: {
    priority?: string
    tags?: string[]
    type?: 'course' | 'quiz'
    courseId?: string
    courseKey?: string
    quizId?: string
    quizKey?: string
  }
  createdAt: string
  updatedAt: string
}

interface Course {
  id: string
  key: string
  courseId: string
  courseTitle: string
  courseThumbnail?: string
  description?: string
  isActive?: boolean
  createdAt: string
}

interface Quiz {
  id: string
  title: string
  description?: string
}

interface Document {
  id: string
  title: string
  description?: string
  fileName: string
  originalFileName: string
  fileType: string
  fileSize: number
  uploadedBy: string
  uploadedById: string
  uploadedAt: string
  downloadCount: number
  metadata?: {
    tags?: string[]
    category?: string
  }
}

// Function to format announcement content with proper markdown handling
const formatAnnouncementContent = (content: string): JSX.Element[] => {
  if (!content) return []

  const lines = content.split('\n')
  const formattedElements: JSX.Element[] = []
  let currentListItems: string[] = []
  let listKey = 0

  const processList = () => {
    if (currentListItems.length > 0) {
      formattedElements.push(
        <ul key={`list-${listKey++}`} className="list-disc list-inside mb-4 space-y-2 ml-4">
          {currentListItems.map((item, idx) => (
            <li key={idx} className="text-gray-700 leading-relaxed">
              {formatInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      )
      currentListItems = []
    }
  }

  const formatInlineMarkdown = (line: string): JSX.Element => {
    if (!line) return <></>
    
    const parts: (string | JSX.Element)[] = []
    let key = 0
    let lastIndex = 0

    // Remove markdown from codes (e.g., **Course Code: DTLJFW7X** or **Code: DTLJFW7X**)
    // Extract codes and make them copyable
    // First, find all code patterns and their positions
    const codeMatches: Array<{index: number, length: number, label: string, code: string}> = []
    
    // Pattern 1: **Course Code: DTLJFW7X** or **Quiz Code: DTLJFW7X**
    const pattern1 = /\*\*([^*:]+[Cc]ode[^*:]*:\s*)([A-Z0-9]{6,})\*\*/gi
    let match: RegExpExecArray | null
    while ((match = pattern1.exec(line)) !== null) {
      codeMatches.push({
        index: match.index,
        length: match[0].length,
        label: match[1].trim(),
        code: match[2]
      })
    }
    
    // Pattern 2: **Code: DTLJFW7X**
    const pattern2 = /\*\*([Cc]ode:\s*)([A-Z0-9]{6,})\*\*/gi
    match = null
    while ((match = pattern2.exec(line)) !== null) {
      // Check if not already captured by pattern1
      const alreadyCaptured = codeMatches.some(m => 
        m.index <= match!.index && match!.index < m.index + m.length
      )
      if (!alreadyCaptured) {
        codeMatches.push({
          index: match.index,
          length: match[0].length,
          label: match[1].trim(),
          code: match[2]
        })
      }
    }
    
    // Pattern 3: **DTLJFW7X** (standalone code, at least 6 chars)
    const pattern3 = /\*\*([A-Z0-9]{6,})\*\*/g
    match = null
    while ((match = pattern3.exec(line)) !== null) {
      // Check if not already captured
      const alreadyCaptured = codeMatches.some(m => 
        m.index <= match!.index && match!.index < m.index + m.length
      )
      if (!alreadyCaptured) {
        codeMatches.push({
          index: match.index,
          length: match[0].length,
          label: '',
          code: match[1]
        })
      }
    }
    
    // Sort matches by index
    codeMatches.sort((a, b) => a.index - b.index)
    
    // Process matches
    codeMatches.forEach((codeMatch) => {
      // Add text before the match
      if (codeMatch.index > lastIndex) {
        const textBefore = line.substring(lastIndex, codeMatch.index)
        if (textBefore) {
          parts.push(formatBoldText(textBefore, key))
          key += 100
        }
      }
      
      // Add label if it exists
      if (codeMatch.label) {
        parts.push(
          <span key={`label-${key++}`} className="font-semibold text-gray-900">
            {codeMatch.label}
          </span>
        )
      }
      
      // Add copyable code
      parts.push(
        <span
          key={`code-${key++}`}
          className="font-mono font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded cursor-pointer hover:bg-primary-100 select-all inline-block mx-1"
          onClick={() => {
            navigator.clipboard.writeText(codeMatch.code)
            toast.success('Code copied to clipboard!')
          }}
          title="Click to copy"
        >
          {codeMatch.code}
        </span>
      )
      
      lastIndex = codeMatch.index + codeMatch.length
    })

    // Add remaining text
    if (lastIndex < line.length) {
      const remainingText = line.substring(lastIndex)
      if (remainingText) {
        parts.push(formatBoldText(remainingText, key))
      }
    }

    return <>{parts.length > 0 ? parts : formatBoldText(line, 0)}</>
  }

  const formatBoldText = (text: string, startKey: number): JSX.Element => {
    if (!text) return <></>
    
    const parts: (string | JSX.Element)[] = []
    let key = startKey
    let lastIndex = 0

    // Match **bold** text
    const boldRegex = /\*\*([^*]+?)\*\*/g
    let match

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index)
        if (textBefore) {
          parts.push(textBefore)
        }
      }
      // Add bold text
      parts.push(
        <strong key={`bold-${key++}`} className="font-semibold text-gray-900">
          {match[1]}
        </strong>
      )
      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex)
      if (remainingText) {
        parts.push(remainingText)
      }
    }

    return <>{parts.length > 0 ? parts : text}</>
  }

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()

    // Check if it's a bullet point
    if (trimmedLine.match(/^[\*\-\•]\s+/)) {
      const listItem = trimmedLine.replace(/^[\*\-\•]\s+/, '').trim()
      if (listItem) {
        currentListItems.push(listItem)
      }
    } else {
      processList()

      // Check if it's a header
      if (trimmedLine.startsWith('#')) {
        const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/)
        if (headerMatch) {
          const level = headerMatch[1].length
          const text = headerMatch[2]
          const HeaderTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements
          formattedElements.push(
            <HeaderTag
              key={`header-${index}`}
              className={`font-bold text-gray-900 mb-3 mt-4 ${
                level === 1 ? 'text-2xl' :
                level === 2 ? 'text-xl' :
                level === 3 ? 'text-lg' :
                'text-base'
              }`}
            >
              {formatInlineMarkdown(text)}
            </HeaderTag>
          )
          return
        }
      }

      // Regular paragraph
      if (trimmedLine) {
        formattedElements.push(
          <p key={`para-${index}`} className="mb-3 text-gray-700 leading-relaxed">
            {formatInlineMarkdown(trimmedLine)}
          </p>
        )
      } else if (index < lines.length - 1) {
        formattedElements.push(<div key={`space-${index}`} className="mb-2" />)
      }
    }
  })

  processList()

  return formattedElements.length > 0 ? formattedElements : [<p key="empty" className="text-gray-500">No content</p>]
}

const ClassroomViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    isPinned: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchingCourses, setIsSearchingCourses] = useState(false)
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [quizDetails, setQuizDetails] = useState<Map<string, { scheduledStartTime?: string; scheduledEndTime?: string }>>(new Map())
  const [selectedStudent, setSelectedStudent] = useState<{ studentId: string; name: string; email: string; college?: string; department?: string; joinedAt: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'announcements' | 'participants' | 'courses' | 'quizzes' | 'documents'>('announcements')
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [documentForm, setDocumentForm] = useState({
    title: '',
    description: '',
    file: null as File | null
  })
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)

  const isTeacher = user?.role === 'instructor' || user?.role === 'admin'
  const isAuthor = (announcement: Announcement) => announcement.authorId === (user?.id || (user as any)?._id)

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    if (id) {
      fetchClassroom()
      fetchAnnouncements()
    }
  }, [id, token])

  const fetchClassroom = async () => {
    try {
      const response = await api.get(`/classrooms/${id}`)
      setClassroom(response.data.data.classroom)
    } catch (error) {
      console.error('Error fetching classroom:', error)
      handleApiError(error)
      toast.error('Failed to load classroom')
      navigate('/classrooms/join')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAnnouncements = async () => {
    try {
      const response = await api.get(`/classrooms/${id}/announcements`)
      const announcements = response.data.data.announcements || []
      setAnnouncements(announcements)
      
      // Fetch quiz details for quiz announcements to get scheduled times
      const quizIds = announcements
        .filter((a: Announcement) => a.metadata?.type === 'quiz' && a.metadata?.quizId)
        .map((a: Announcement) => a.metadata?.quizId)
      
      if (quizIds.length > 0) {
        const detailsMap = new Map<string, { scheduledStartTime?: string; scheduledEndTime?: string }>()
        await Promise.all(
          quizIds.map(async (quizId: string) => {
            try {
              const quizResponse = await api.get(`/quiz/${quizId}`)
              const quiz = quizResponse.data.data.quiz
              if (quiz && (quiz.scheduledStartTime || quiz.scheduledEndTime)) {
                detailsMap.set(quizId, {
                  scheduledStartTime: quiz.scheduledStartTime,
                  scheduledEndTime: quiz.scheduledEndTime
                })
              }
            } catch (error) {
              console.error(`Error fetching quiz ${quizId}:`, error)
            }
          })
        )
        setQuizDetails(detailsMap)
      }
    } catch (error) {
      console.error('Error fetching announcements:', error)
      handleApiError(error)
    }
  }

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      toast.error('Title and content are required')
      return
    }

    setIsSubmitting(true)
    try {
      if (editingAnnouncement) {
        await api.put(`/classrooms/announcements/${editingAnnouncement.id}`, announcementForm)
        toast.success('Announcement updated successfully!')
      } else {
        await api.post(`/classrooms/${id}/announcements`, {
          ...announcementForm,
          classroomId: id
        })
        toast.success('Announcement created successfully!')
      }
      setShowAnnouncementModal(false)
      setEditingAnnouncement(null)
      setAnnouncementForm({ title: '', content: '', isPinned: false })
      fetchAnnouncements()
    } catch (error) {
      console.error('Error saving announcement:', error)
      handleApiError(error)
      toast.error('Failed to save announcement')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) {
      return
    }

    try {
      await api.delete(`/classrooms/announcements/${announcementId}`)
      toast.success('Announcement deleted successfully')
      fetchAnnouncements()
    } catch (error) {
      console.error('Error deleting announcement:', error)
      handleApiError(error)
      toast.error('Failed to delete announcement')
    }
  }

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setAnnouncementForm({
      title: announcement.title,
      content: announcement.content,
      isPinned: announcement.isPinned
    })
    setShowAnnouncementModal(true)
  }

  const fetchCourses = async () => {
    setIsSearchingCourses(true)
    try {
      const response = await api.get('/teacher/course-keys')
      const courseKeys = response.data.data.courseKeys || []
      
      // Filter only active courses
      const activeCourses = courseKeys.filter((course: Course) => course.isActive !== false)
      
      // Filter by search query if provided
      let filteredCourses = activeCourses
      if (searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase()
        filteredCourses = activeCourses.filter((course: Course) =>
          course.courseTitle.toLowerCase().includes(lowerQuery) ||
          (course.description && course.description.toLowerCase().includes(lowerQuery)) ||
          course.key.toLowerCase().includes(lowerQuery)
        )
      }
      
      setCourses(filteredCourses)
    } catch (error) {
      console.error('Error fetching course keys:', error)
      handleApiError(error)
      setCourses([])
    } finally {
      setIsSearchingCourses(false)
    }
  }

  const fetchQuizzes = async () => {
    setIsLoadingQuizzes(true)
    try {
      const response = await api.get('/quiz/teacher/quizzes')
      setQuizzes(response.data.data.quizzes || [])
    } catch (error) {
      console.error('Error fetching quizzes:', error)
      handleApiError(error)
      setQuizzes([])
    } finally {
      setIsLoadingQuizzes(false)
    }
  }

  const handleLinkCourse = async (course: Course) => {
    setIsLinking(true)
    try {
      await api.post(`/classrooms/${id}/link-course`, {
        courseId: course.courseId,
        courseDescription: course.description || '',
        sourceCourseKeyId: course.id
      })
      toast.success('Course linked successfully!')
      setShowCourseModal(false)
      setSearchQuery('')
      setCourses([])
      fetchClassroom()
      fetchAnnouncements()
    } catch (error) {
      console.error('Error linking course:', error)
      handleApiError(error)
      toast.error('Failed to link course')
    } finally {
      setIsLinking(false)
    }
  }

  const handleLinkQuiz = async (quiz: Quiz) => {
    setIsLinking(true)
    try {
      await api.post(`/classrooms/${id}/link-quiz`, {
        quizId: quiz.id
      })
      toast.success('Quiz linked successfully!')
      setShowQuizModal(false)
      fetchClassroom()
      fetchAnnouncements()
    } catch (error) {
      console.error('Error linking quiz:', error)
      handleApiError(error)
      toast.error('Failed to link quiz')
    } finally {
      setIsLinking(false)
    }
  }

  const handleUnlinkCourse = async (courseKey: string, courseTitle: string) => {
    if (!confirm(`Are you sure you want to remove "${courseTitle}" from this classroom?`)) {
      return
    }

    setIsLinking(true)
    try {
      await api.delete(`/classrooms/${id}/unlink-course`, {
        data: { courseKey }
      })
      toast.success('Course removed successfully!')
      fetchClassroom()
      fetchAnnouncements()
    } catch (error) {
      console.error('Error unlinking course:', error)
      handleApiError(error)
      toast.error('Failed to remove course')
    } finally {
      setIsLinking(false)
    }
  }

  const handleUnlinkQuiz = async (quizKey: string, quizTitle: string) => {
    if (!confirm(`Are you sure you want to remove "${quizTitle}" from this classroom?`)) {
      return
    }

    setIsLinking(true)
    try {
      await api.delete(`/classrooms/${id}/unlink-quiz`, {
        data: { quizKey }
      })
      toast.success('Quiz removed successfully!')
      fetchClassroom()
      fetchAnnouncements()
    } catch (error) {
      console.error('Error unlinking quiz:', error)
      handleApiError(error)
      toast.error('Failed to remove quiz')
    } finally {
      setIsLinking(false)
    }
  }

  const fetchDocuments = async () => {
    setIsLoadingDocuments(true)
    try {
      const response = await api.get(`/classrooms/${id}/documents`)
      setDocuments(response.data.data.documents || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
      handleApiError(error)
      setDocuments([])
    } finally {
      setIsLoadingDocuments(false)
    }
  }

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!documentForm.title.trim()) {
      toast.error('Document title is required')
      return
    }

    if (!documentForm.file) {
      toast.error('Please select a file to upload')
      return
    }

    // Check file size (50MB limit)
    if (documentForm.file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB')
      return
    }

    setIsUploadingDocument(true)
    try {
      const formData = new FormData()
      formData.append('file', documentForm.file)
      formData.append('title', documentForm.title.trim())
      if (documentForm.description.trim()) {
        formData.append('description', documentForm.description.trim())
      }

      await api.post(`/classrooms/${id}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      toast.success('Document uploaded successfully!')
      setShowDocumentModal(false)
      setDocumentForm({ title: '', description: '', file: null })
      fetchDocuments()
    } catch (error) {
      console.error('Error uploading document:', error)
      handleApiError(error)
      toast.error('Failed to upload document')
    } finally {
      setIsUploadingDocument(false)
    }
  }

  const handleDownloadDocument = async (documentId: string, originalFileName: string) => {
    try {
      const response = await api.get(`/classrooms/documents/${documentId}/download`, {
        responseType: 'blob'
      })

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', originalFileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      // Refresh documents to update download count
      fetchDocuments()
    } catch (error) {
      console.error('Error downloading document:', error)
      handleApiError(error)
      toast.error('Failed to download document')
    }
  }

  const handleDeleteDocument = async (documentId: string, documentTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${documentTitle}"?`)) {
      return
    }

    try {
      await api.delete(`/classrooms/documents/${documentId}`)
      toast.success('Document deleted successfully!')
      fetchDocuments()
    } catch (error) {
      console.error('Error deleting document:', error)
      handleApiError(error)
      toast.error('Failed to delete document')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊'
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️'
    if (fileType.includes('image')) return '🖼️'
    if (fileType.includes('text')) return '📃'
    return '📎'
  }

  useEffect(() => {
    if (showCourseModal) {
      fetchCourses()
    } else {
      setCourses([])
      setSearchQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCourseModal])

  useEffect(() => {
    if (showCourseModal) {
      const timeoutId = setTimeout(() => {
        fetchCourses()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, showCourseModal])

  useEffect(() => {
    if (showQuizModal) {
      fetchQuizzes()
    }
  }, [showQuizModal])

  useEffect(() => {
    if (activeTab === 'documents' && id) {
      fetchDocuments()
    }
  }, [activeTab, id])

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  if (!classroom) {
    return null
  }

  // Sort announcements: pinned first, then by date
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6 transition-colors duration-200 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="font-medium">Back</span>
        </button>
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              {classroom.name}
            </h1>
            {classroom.description && (
              <p className="text-lg text-gray-600 mb-4">{classroom.description}</p>
            )}
            <div className="flex items-center gap-6 text-sm">
              <span className="flex items-center gap-2 text-gray-700">
                <span className="font-semibold">Teacher:</span>
                <span className="text-gray-600">{classroom.teacherName}</span>
              </span>
              <span className="flex items-center gap-2 text-gray-700">
                <Users className="w-4 h-4 text-primary-600" />
                <span className="font-semibold">{classroom.students.length}</span>
                <span className="text-gray-600">Student{classroom.students.length !== 1 ? 's' : ''}</span>
              </span>
              {classroom.metadata.subject && (
                <span className="badge badge-primary">{classroom.metadata.subject}</span>
              )}
            </div>
          </div>
          {isTeacher && (
            <div className="flex gap-3 flex-shrink-0">
              <button
                onClick={() => setShowCourseModal(true)}
                className="btn btn-outline"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Add Course
              </button>
              <button
                onClick={() => setShowQuizModal(true)}
                className="btn btn-outline"
              >
                <FileText className="w-5 h-5 mr-2" />
                Add Quiz
              </button>
              <button
                onClick={() => setShowAnnouncementModal(true)}
                className="btn btn-primary"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Announcement
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Join Code (Teacher only) */}
      {isTeacher && classroom.joinCode && (
        <div className="mb-8 p-6 bg-gradient-to-br from-primary-50 to-blue-50 border-2 border-primary-200 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-primary-900 mb-2 uppercase tracking-wide">Join Code</p>
              <p className="text-3xl font-bold text-primary-900 font-mono tracking-wider">{classroom.joinCode}</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(classroom.joinCode!)
                toast.success('Join code copied!')
              }}
              className="btn btn-primary"
            >
              Copy Code
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-6 py-3 font-semibold text-sm transition-all duration-200 border-b-2 ${
              activeTab === 'announcements'
                ? 'border-primary-600 text-primary-600 bg-primary-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <span>Announcements</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`px-6 py-3 font-semibold text-sm transition-all duration-200 border-b-2 ${
              activeTab === 'participants'
                ? 'border-primary-600 text-primary-600 bg-primary-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>Participants ({classroom.students.length + 1})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-6 py-3 font-semibold text-sm transition-all duration-200 border-b-2 ${
              activeTab === 'courses'
                ? 'border-primary-600 text-primary-600 bg-primary-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              <span>Courses ({classroom.linkedCourses?.length ?? 0})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('quizzes')}
            className={`px-6 py-3 font-semibold text-sm transition-all duration-200 border-b-2 ${
              activeTab === 'quizzes'
                ? 'border-primary-600 text-primary-600 bg-primary-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <span>Quizzes ({classroom.linkedQuizzes?.length ?? 0})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-6 py-3 font-semibold text-sm transition-all duration-200 border-b-2 ${
              activeTab === 'documents'
                ? 'border-primary-600 text-primary-600 bg-primary-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <File className="w-5 h-5" />
              <span>Documents ({documents.length})</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'announcements' && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Bell className="w-6 h-6 text-primary-600" />
            </div>
            Announcements
          </h2>

        {sortedAnnouncements.length > 0 ? (
          <div className="space-y-6">
            {sortedAnnouncements.map((announcement, index) => {
              const isCourseAnnouncement = announcement.metadata?.type === 'course'
              const isQuizAnnouncement = announcement.metadata?.type === 'quiz'
              
              return (
                <div
                  key={announcement.id}
                  className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 ${
                    announcement.isPinned 
                      ? 'border-l-4 border-l-yellow-400 border-t-2 border-r-2 border-b-2 border-gray-200' 
                      : 'border-gray-200'
                  } ${isCourseAnnouncement ? 'ring-2 ring-blue-100 border-blue-200' : ''} ${isQuizAnnouncement ? 'ring-2 ring-green-100 border-green-200' : ''} hover:border-primary-200`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {announcement.isPinned && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded-md">
                              <Pin className="w-3.5 h-3.5 text-yellow-600 fill-yellow-600" />
                              <span className="text-xs font-medium text-yellow-700">Pinned</span>
                            </div>
                          )}
                          {isCourseAnnouncement && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-md">
                              <BookOpen className="w-4 h-4 text-blue-600" />
                              <span className="text-xs font-semibold text-blue-700">Course</span>
                            </div>
                          )}
                          {isQuizAnnouncement && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-md">
                              <FileText className="w-4 h-4 text-green-600" />
                              <span className="text-xs font-semibold text-green-700">Quiz</span>
                            </div>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {announcement.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="font-medium text-gray-700">{announcement.authorName}</span>
                          <span>•</span>
                          <span>{new Date(announcement.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</span>
                        </div>
                      </div>
                      {isTeacher && isAuthor(announcement) && (
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditAnnouncement(announcement)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit announcement"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete announcement"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="mb-4">
                      <div className="text-gray-700 leading-relaxed text-base">
                        {formatAnnouncementContent(announcement.content)}
                      </div>
                    </div>

                    {/* Quiz Schedule in Announcement */}
                    {isQuizAnnouncement && announcement.metadata?.quizId && (() => {
                      const quizId = announcement.metadata.quizId
                      const quizSchedule = quizDetails.get(quizId)
                      const hasSchedule = !!(quizSchedule?.scheduledStartTime || quizSchedule?.scheduledEndTime)
                      
                      return hasSchedule ? (
                        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                              <Clock className="w-5 h-5 text-green-700" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-green-900 mb-2 uppercase tracking-wide">Quiz Schedule</p>
                              <div className="space-y-2">
                                {quizSchedule?.scheduledStartTime && (
                                  <div className="flex items-center gap-2 text-sm text-green-800">
                                    <span className="font-medium">Starts:</span>
                                    <span>{new Date(quizSchedule.scheduledStartTime).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    })}</span>
                                  </div>
                                )}
                                {quizSchedule?.scheduledEndTime && (
                                  <div className="flex items-center gap-2 text-sm text-green-800">
                                    <span className="font-medium">Ends:</span>
                                    <span>{new Date(quizSchedule.scheduledEndTime).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    })}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null
                    })()}

                    {/* Course/Quiz Code Section */}
                    {isCourseAnnouncement && announcement.metadata?.courseKey && (
                      <div className="mt-5 pt-5 border-t border-gray-200">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border-2 border-blue-200 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <BookOpen className="w-5 h-5 text-blue-600" />
                                <p className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
                                  Course Access Code
                                </p>
                              </div>
                              <div 
                                className="inline-block px-4 py-3 bg-white rounded-lg border-2 border-blue-300 shadow-sm cursor-pointer hover:border-blue-400 transition-colors group"
                                onClick={() => {
                                  navigator.clipboard.writeText(announcement.metadata.courseKey!)
                                  toast.success('Course code copied to clipboard!')
                                }}
                                title="Click to copy"
                              >
                                <p className="text-3xl font-bold text-blue-900 font-mono tracking-wider select-all group-hover:text-blue-700">
                                  {announcement.metadata.courseKey}
                                </p>
                              </div>
                              <p className="text-xs text-blue-700 mt-3 flex items-center gap-1">
                                <span>💡</span>
                                <span>Use this code on the Search page to access the course</span>
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(announcement.metadata.courseKey!)
                                toast.success('Course code copied to clipboard!')
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
                            >
                              <span>Copy</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {isQuizAnnouncement && announcement.metadata?.quizKey && (
                      <div className="mt-5 pt-5 border-t border-gray-200">
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border-2 border-green-200 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <FileText className="w-5 h-5 text-green-600" />
                                <p className="text-sm font-semibold text-green-900 uppercase tracking-wide">
                                  Quiz Access Code
                                </p>
                              </div>
                              <div 
                                className="inline-block px-4 py-3 bg-white rounded-lg border-2 border-green-300 shadow-sm cursor-pointer hover:border-green-400 transition-colors group"
                                onClick={() => {
                                  navigator.clipboard.writeText(announcement.metadata.quizKey!)
                                  toast.success('Quiz code copied to clipboard!')
                                }}
                                title="Click to copy"
                              >
                                <p className="text-3xl font-bold text-green-900 font-mono tracking-wider select-all group-hover:text-green-700">
                                  {announcement.metadata.quizKey}
                                </p>
                              </div>
                              <p className="text-xs text-green-700 mt-3 flex items-center gap-1">
                                <span>💡</span>
                                <span>Use this code on the Quiz page to take the quiz</span>
                              </p>
                              {(() => {
                                const quizId = announcement.metadata?.quizId
                                const quizSchedule = quizId ? quizDetails.get(quizId) : null
                                const hasSchedule = !!(quizSchedule?.scheduledStartTime || quizSchedule?.scheduledEndTime)
                                
                                return hasSchedule ? (
                                  <div className="mt-4 pt-4 border-t border-green-200">
                                    <p className="text-xs font-semibold text-green-900 mb-2 uppercase tracking-wide">Quiz Schedule</p>
                                    <div className="space-y-2 text-sm text-green-800">
                                      {quizSchedule?.scheduledStartTime && (
                                        <div className="flex items-center gap-2">
                                          <Clock className="w-4 h-4" />
                                          <span><strong>Starts:</strong> {new Date(quizSchedule.scheduledStartTime).toLocaleString()}</span>
                                        </div>
                                      )}
                                      {quizSchedule?.scheduledEndTime && (
                                        <div className="flex items-center gap-2">
                                          <Clock className="w-4 h-4" />
                                          <span><strong>Ends:</strong> {new Date(quizSchedule.scheduledEndTime).toLocaleString()}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : null
                              })()}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(announcement.metadata.quizKey!)
                                toast.success('Quiz code copied to clipboard!')
                              }}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
                            >
                              <span>Copy</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card">
            <div className="card-content">
              <div className="text-center py-8 text-gray-500">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p>No announcements yet</p>
                {isTeacher && (
                  <p className="text-sm mt-1">Create your first announcement to get started</p>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {activeTab === 'participants' && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            Participants ({classroom.students.length + 1})
          </h2>
          
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            {/* Teacher */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {classroom.teacherName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{classroom.teacherName}</h3>
                    <span className="badge badge-primary text-xs">Teacher</span>
                  </div>
                  {classroom.teacherEmail && (
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3" />
                      {classroom.teacherEmail}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Students */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Students ({classroom.students.length})</h3>
              {classroom.students.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classroom.students.map((student) => (
                    <div
                      key={student.studentId}
                      className="p-4 rounded-lg border-2 border-gray-200 transition-all duration-200 hover:border-primary-300 hover:shadow-md cursor-pointer"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-semibold shadow-sm flex-shrink-0">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">{student.name}</h4>
                          <p className="text-xs text-gray-600 flex items-center gap-1 mt-1 truncate">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{student.email}</span>
                          </p>
                          {student.college && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 truncate">
                              <Building2 className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{student.college}</span>
                            </p>
                          )}
                          {student.department && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 truncate">
                              <GraduationCap className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{student.department}</span>
                            </p>
                          )}
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-2">
                            <Calendar className="w-3 h-3" />
                            Joined {new Date(student.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No students have joined this classroom yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'courses' && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-primary-600" />
            </div>
            Linked Courses
          </h2>
          {(classroom.linkedCourses?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classroom.linkedCourses?.map((course) => (
                <div
                  key={`${course.courseId}-${course.courseKey}`}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-4">
                    {course.courseThumbnail ? (
                      <img
                        src={course.courseThumbnail}
                        alt={course.courseTitle}
                        className="w-24 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-24 h-20 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
                        <BookOpen className="w-8 h-8" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                            {course.courseTitle}
                          </h3>
                          <p className="text-xs text-gray-500">
                            Linked on{' '}
                            {new Date(course.addedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        {isTeacher && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUnlinkCourse(course.courseKey, course.courseTitle)
                            }}
                            disabled={isLinking}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove course from classroom"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Key className="w-4 h-4 text-primary-600" />
                        Course Access Code
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(course.courseKey)
                          toast.success('Course code copied!')
                        }}
                        className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 font-mono tracking-wide select-all">
                      {course.courseKey}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="card-content">
                <div className="text-center py-10 text-gray-500">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p>No courses linked yet</p>
                  {isTeacher && (
                    <p className="text-sm mt-1">Click “Add Course” to link a course to this classroom</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'quizzes' && (
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <FileText className="w-6 h-6 text-primary-600" />
            </div>
            Linked Quizzes
          </h2>
          {(classroom.linkedQuizzes?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classroom.linkedQuizzes?.map((quiz) => {
                const schedule = quizDetails.get(quiz.quizId)
                const hasSchedule = !!(schedule?.scheduledStartTime || schedule?.scheduledEndTime)
                return (
                  <div
                    key={`${quiz.quizId}-${quiz.quizKey}`}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-5 flex flex-col gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-semibold shadow-sm flex-shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                              {quiz.quizTitle}
                            </h3>
                            <p className="text-xs text-gray-500">
                              Linked on{' '}
                              {new Date(quiz.addedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                          {isTeacher && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnlinkQuiz(quiz.quizKey, quiz.quizTitle)
                              }}
                              disabled={isLinking}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Remove quiz from classroom"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <Key className="w-4 h-4 text-primary-600" />
                          Quiz Access Code
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(quiz.quizKey)
                            toast.success('Quiz code copied!')
                          }}
                          className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 font-mono tracking-wide select-all">
                        {quiz.quizKey}
                      </p>
                    </div>
                    {hasSchedule && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 space-y-2">
                        <p className="font-semibold text-green-900 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Quiz Schedule
                        </p>
                        {schedule?.scheduledStartTime && (
                          <p>
                            <strong>Starts:</strong>{' '}
                            {new Date(schedule.scheduledStartTime).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </p>
                        )}
                        {schedule?.scheduledEndTime && (
                          <p>
                            <strong>Ends:</strong>{' '}
                            {new Date(schedule.scheduledEndTime).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card">
              <div className="card-content">
                <div className="text-center py-10 text-gray-500">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p>No quizzes linked yet</p>
                  {isTeacher && (
                    <p className="text-sm mt-1">Click “Add Quiz” to link a quiz to this classroom</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <File className="w-6 h-6 text-primary-600" />
              </div>
              Documents
            </h2>
            <button
              onClick={() => setShowDocumentModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Upload Document
            </button>
          </div>

          {isLoadingDocuments ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-4xl flex-shrink-0">
                      {getFileIcon(document.fileType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                        {document.title}
                      </h3>
                      {document.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {document.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatFileSize(document.fileSize)}</span>
                        <span>•</span>
                        <span>{document.downloadCount} downloads</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Uploaded by {document.uploadedBy} on{' '}
                        {new Date(document.uploadedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => handleDownloadDocument(document.id, document.originalFileName)}
                      className="flex-1 btn btn-outline btn-sm flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    {(isTeacher || document.uploadedById === (user?.id || (user as any)?._id)) && (
                      <button
                        onClick={() => handleDeleteDocument(document.id, document.title)}
                        className="btn btn-outline btn-sm text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="card-content">
                <div className="text-center py-10 text-gray-500">
                  <File className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p>No documents uploaded yet</p>
                  <p className="text-sm mt-1">Click "Upload Document" to share files with the classroom</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
              </h2>
              <button
                onClick={() => {
                  setShowAnnouncementModal(false)
                  setEditingAnnouncement(null)
                  setAnnouncementForm({ title: '', content: '', isPinned: false })
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                    className="input w-full"
                    placeholder="Enter announcement title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content *
                  </label>
                  <textarea
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                    className="input w-full"
                    rows={8}
                    placeholder="Enter announcement content"
                    required
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPinned"
                    checked={announcementForm.isPinned}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, isPinned: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="isPinned" className="ml-2 text-sm text-gray-700 flex items-center gap-1">
                    <Pin className="w-4 h-4" />
                    Pin this announcement
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAnnouncementModal(false)
                    setEditingAnnouncement(null)
                    setAnnouncementForm({ title: '', content: '', isPinned: false })
                  }}
                  className="flex-1 btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 btn btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingAnnouncement ? 'Update Announcement' : 'Create Announcement'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Course to Classroom</h2>
              <button
                onClick={() => {
                  setShowCourseModal(false)
                  setSearchQuery('')
                  setCourses([])
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search your generated course keys
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input w-full pl-10"
                      placeholder="Search by course name, description, or key..."
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Select a course key from your teacher dashboard to add to this classroom
                </p>
              </div>

              {isSearchingCourses ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : courses.length > 0 ? (
                <div className="space-y-3">
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      className="card hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleLinkCourse(course)}
                    >
                      <div className="card-content">
                        <div className="flex items-start gap-4">
                          {course.courseThumbnail ? (
                            <img
                              src={course.courseThumbnail}
                              alt={course.courseTitle}
                              className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
                            />
                          ) : (
                            <div className="w-24 h-16 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
                              <BookOpen className="w-8 h-8" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                              {course.courseTitle}
                            </h3>
                            {course.description && (
                              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                {course.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Key className="w-3 h-3" />
                                {course.key}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Created: {new Date(course.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p>No matching courses found</p>
                  <p className="text-sm mt-1">Try a different search term or generate a new key</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p>Search your generated courses</p>
                  <p className="text-sm mt-1">Enter a course name, description, or key above</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Quiz Modal */}
      {showQuizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Quiz to Classroom</h2>
              <button
                onClick={() => setShowQuizModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingQuizzes ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : quizzes.length > 0 ? (
                <div className="space-y-3">
                  {quizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="card hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleLinkQuiz(quiz)}
                    >
                      <div className="card-content">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-6 h-6 text-primary-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {quiz.title}
                            </h3>
                            {quiz.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {quiz.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p>No quizzes found</p>
                  <p className="text-sm mt-1">Create a quiz first to add it to the classroom</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showDocumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Upload Document</h2>
              <button
                onClick={() => {
                  setShowDocumentModal(false)
                  setDocumentForm({ title: '', description: '', file: null })
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    value={documentForm.title}
                    onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                    className="input w-full"
                    placeholder="Enter document title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={documentForm.description}
                    onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
                    className="input w-full"
                    rows={3}
                    placeholder="Enter document description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    File *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
                    <input
                      type="file"
                      id="document-file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.jpg,.jpeg,.png,.gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (file.size > 50 * 1024 * 1024) {
                            toast.error('File size must be less than 50MB')
                            return
                          }
                          setDocumentForm({ ...documentForm, file })
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="document-file" className="cursor-pointer">
                      {documentForm.file ? (
                        <div className="space-y-2">
                          <File className="w-12 h-12 text-primary-600 mx-auto" />
                          <p className="text-sm font-medium text-gray-900">{documentForm.file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(documentForm.file.size)}</p>
                          <p className="text-xs text-primary-600 mt-2">Click to change file</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                          <p className="text-sm font-medium text-gray-700">Click to upload or drag and drop</p>
                          <p className="text-xs text-gray-500">
                            PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, MD, JPG, PNG, GIF (Max 50MB)
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowDocumentModal(false)
                    setDocumentForm({ title: '', description: '', file: null })
                  }}
                  className="flex-1 btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDocument || !documentForm.file}
                  className="flex-1 btn btn-primary"
                >
                  {isUploadingDocument ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Document
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Profile Modal (Teacher only) */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStudent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Student Profile</h3>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  {selectedStudent.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-bold text-gray-900">{selectedStudent.name}</h4>
                  <span className="badge badge-success mt-1">Student</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">Email</span>
                  </div>
                  <p className="text-gray-900 ml-8">{selectedStudent.email}</p>
                </div>

                {selectedStudent.college && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="w-5 h-5 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-700">College</span>
                    </div>
                    <p className="text-gray-900 ml-8">{selectedStudent.college}</p>
                  </div>
                )}

                {selectedStudent.department && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <GraduationCap className="w-5 h-5 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-700">Department</span>
                    </div>
                    <p className="text-gray-900 ml-8">{selectedStudent.department}</p>
                  </div>
                )}

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">Joined Date</span>
                  </div>
                  <p className="text-gray-900 ml-8">
                    {new Date(selectedStudent.joinedAt).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClassroomViewPage

