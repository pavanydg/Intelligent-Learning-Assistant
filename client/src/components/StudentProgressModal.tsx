import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Target, Brain, Clock, TrendingUp, CheckCircle, Circle } from 'lucide-react'
import { api } from '../services/api'

interface Student {
  userId: string
  name: string
  email: string
}

interface VideoProgress {
  videoId: string
  title: string
  thumbnail: string
  isCompleted: boolean
  assessments: Array<{
    id: string
    testScore: number
    cli: number
    cliClassification: string
    confidence: number
    timeSpent: number
    createdAt: string
  }>
}

interface StudentProgressModalProps {
  courseId: string
  student: Student
  onClose: () => void
}

const StudentProgressModal: React.FC<StudentProgressModalProps> = ({
  courseId,
  student,
  onClose
}) => {
  const [progress, setProgress] = useState<any>(null)
  const [videoProgress, setVideoProgress] = useState<VideoProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStudentProgress()
  }, [courseId, student.userId])

  const fetchStudentProgress = async () => {
    setIsLoading(true)
    try {
      const response = await api.get(`/teacher/courses/${courseId}/students/${student.userId}`)
      setProgress(response.data.data.progress)
      setVideoProgress(response.data.data.videoProgress || [])
    } catch (error) {
      console.error('Error fetching student progress:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getCLIColor = (cli: number) => {
    if (cli <= 35) return 'text-green-600'
    if (cli <= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{student.name}</h2>
                  <p className="text-primary-100">{student.email}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <>
                  {/* Summary Stats */}
                  {progress && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">Progress</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900">
                          {progress.completionPercentage.toFixed(0)}%
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          {progress.completedVideos} / {progress.totalVideos} videos
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-medium text-green-600">Avg Score</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900">
                          {progress.averageTestScore.toFixed(1)}%
                        </p>
                      </div>

                      <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-5 h-5 text-purple-600" />
                          <span className="text-sm font-medium text-purple-600">Tests</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-900">
                          {videoProgress.reduce((sum, v) => sum + v.assessments.length, 0)}
                        </p>
                      </div>

                      <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-orange-600" />
                          <span className="text-sm font-medium text-orange-600">Watch Time</span>
                        </div>
                        <p className="text-lg font-bold text-orange-900">
                          {formatTime(progress.totalWatchTime || 0)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Video Progress */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Video Progress</h3>
                    <div className="space-y-3">
                      {videoProgress.map((video, index) => (
                        <div
                          key={video.videoId}
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start gap-4">
                            {/* Video Number & Status */}
                            <div className="flex-shrink-0">
                              {video.isCompleted ? (
                                <CheckCircle className="w-6 h-6 text-green-600" />
                              ) : (
                                <Circle className="w-6 h-6 text-gray-300" />
                              )}
                            </div>

                            {/* Video Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-3">
                                {video.thumbnail && (
                                  <img
                                    src={video.thumbnail}
                                    alt={video.title}
                                    className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">
                                    {index + 1}. {video.title}
                                  </h4>
                                  {video.assessments.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                      {video.assessments.map((assessment) => (
                                        <div
                                          key={assessment.id}
                                          className="flex items-center gap-4 text-sm bg-gray-50 rounded-lg p-2"
                                        >
                                          <div className={`px-3 py-1 rounded-lg border ${getScoreColor(assessment.testScore)}`}>
                                            <span className="font-bold">{assessment.testScore}%</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Brain className="w-4 h-4 text-purple-600" />
                                            <span className={`font-medium ${getCLIColor(assessment.cli)}`}>
                                              CLI: {assessment.cli.toFixed(1)}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              ({assessment.cliClassification})
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1 text-gray-500">
                                            <Clock className="w-3 h-3" />
                                            <span className="text-xs">{formatTime(assessment.timeSpent || 0)}</span>
                                          </div>
                                          <div className="text-xs text-gray-400 ml-auto">
                                            {new Date(assessment.createdAt).toLocaleDateString()}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {video.assessments.length === 0 && (
                                    <p className="text-sm text-gray-400 italic">No tests taken</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-end">
              <button
                onClick={onClose}
                className="btn btn-primary btn-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  )
}

export default StudentProgressModal

