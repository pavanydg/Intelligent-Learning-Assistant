import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Target, Brain, Clock, TrendingUp, Award, BarChart3, Play, ChevronRight } from 'lucide-react'
import { api } from '../services/api'
import TestDetailsModalSingle from './TestDetailsModalSingle'

interface Assessment {
  id: string
  course: {
    title: string
    thumbnail: string
  }
  videoId: string
  videoTitle: string
  testName: string
  testScore: number
  cli: number
  cliClassification: string
  confidence: number
  timeSpent: number
  createdAt: string
}

interface CourseWithTests {
  courseId: string
  courseTitle: string
  courseThumbnail: string
  assessments: Assessment[]
  averageScore: number
  totalTests: number
  lastTestDate: string
}

interface Video {
  videoId: string
  title: string
  thumbnail: string
  duration?: string
}

interface VideoWithScore extends Video {
  assessment?: Assessment
  hasTest: boolean
}

interface TestDetailsModalProps {
  course: CourseWithTests
  onClose: () => void
}

const TestDetailsModal: React.FC<TestDetailsModalProps> = ({ course, onClose }) => {
  const [videos, setVideos] = useState<VideoWithScore[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTest, setSelectedTest] = useState<Assessment | null>(null)

  useEffect(() => {
    fetchPlaylistVideos()
  }, [course.courseId])

  const fetchPlaylistVideos = async () => {
    setIsLoading(true)
    
    // Skip fetching if courseId is invalid (like 'temp')
    if (!course.courseId || course.courseId === 'temp' || course.courseId === 'unknown') {
      // Just show videos from assessments
      const videosFromAssessments: VideoWithScore[] = course.assessments.map((assessment, idx) => ({
        videoId: assessment.videoId,
        title: assessment.videoTitle || assessment.testName,
        thumbnail: '',
        assessment,
        hasTest: true
      }))
      setVideos(videosFromAssessments)
      setIsLoading(false)
      return
    }

    try {
      // Fetch playlist details to get all videos
      const response = await api.get(`/youtube/course/${course.courseId}`)
      const playlistVideos: Video[] = response.data.data.course?.videos || []

      // Create a map of assessments by videoId (use first assessment if multiple exist for same video)
      const assessmentMap = new Map<string, Assessment>()
      course.assessments.forEach(assessment => {
        if (!assessmentMap.has(assessment.videoId)) {
          assessmentMap.set(assessment.videoId, assessment)
        }
      })

      // Combine videos with their assessments, deduplicate by videoId
      const videoMap = new Map<string, VideoWithScore>()
      
      // First, add all playlist videos
      playlistVideos.forEach(video => {
        if (!videoMap.has(video.videoId)) {
          const assessment = assessmentMap.get(video.videoId)
          videoMap.set(video.videoId, {
            ...video,
            assessment,
            hasTest: !!assessment
          })
        }
      })

      // Then, add any assessments that don't have a corresponding playlist video
      course.assessments.forEach(assessment => {
        if (!videoMap.has(assessment.videoId)) {
          videoMap.set(assessment.videoId, {
            videoId: assessment.videoId,
            title: assessment.videoTitle || assessment.testName,
            thumbnail: '',
            assessment,
            hasTest: true
          })
        }
      })

      setVideos(Array.from(videoMap.values()))
    } catch (error) {
      console.error('Error fetching playlist videos:', error)
      // If playlist fetch fails, just show videos from assessments (deduplicated)
      const videoMap = new Map<string, VideoWithScore>()
      course.assessments.forEach(assessment => {
        if (!videoMap.has(assessment.videoId)) {
          videoMap.set(assessment.videoId, {
            videoId: assessment.videoId,
            title: assessment.videoTitle || assessment.testName,
            thumbnail: '',
            assessment,
            hasTest: true
          })
        }
      })
      setVideos(Array.from(videoMap.values()))
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
    if (cli <= 35) return 'text-green-600 bg-green-50'
    if (cli <= 70) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getCLIClassificationColor = (classification: string) => {
    switch (classification) {
      case 'Low Load':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Moderate Load':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'High Load':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 4) return 'text-green-600'
    if (confidence >= 3) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{course.courseTitle}</h2>
                  <div className="flex items-center gap-4 text-sm text-primary-100">
                    <span className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {course.totalTests} Test{course.totalTests !== 1 ? 's' : ''} Completed
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Avg Score: {course.averageScore}%
                    </span>
                  </div>
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
                <div className="space-y-3">
                  {videos.map((video, index) => (
                    <motion.div
                      key={`${video.videoId}-${index}-${video.assessment?.id || ''}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => {
                        if (video.assessment) {
                          setSelectedTest(video.assessment)
                        }
                      }}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                        video.hasTest
                          ? 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-md cursor-pointer'
                          : 'bg-gray-50 border-gray-100 opacity-60 cursor-default'
                      }`}
                    >
                      {/* Video Number */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        video.hasTest ? 'bg-primary-100' : 'bg-gray-200'
                      }`}>
                        <span className={`font-bold text-sm ${
                          video.hasTest ? 'text-primary-600' : 'text-gray-400'
                        }`}>
                          {index + 1}
                        </span>
                      </div>

                      {/* Video Thumbnail */}
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-24 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Play className="w-6 h-6 text-gray-400" />
                        </div>
                      )}

                      {/* Video Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 line-clamp-2">
                          {video.title}
                        </h4>
                        {video.assessment && (
                          <p className="text-xs text-gray-500 mt-1">
                            Test taken: {new Date(video.assessment.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {/* Score Badge */}
                      {video.hasTest && video.assessment ? (() => {
                        const scoreColorClass = getScoreColor(video.assessment.testScore || 0).split(' ')[0]
                        return (
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className={`text-xl font-bold ${scoreColorClass}`}>
                                {video.assessment.testScore !== undefined && !isNaN(video.assessment.testScore) 
                                  ? video.assessment.testScore 
                                  : 0}%
                              </div>
                              <div className="text-xs text-gray-500">Score</div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        )
                      })() : (
                        <div className="text-sm text-gray-400 italic">
                          No test taken
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {videos.filter(v => v.hasTest).length} of {videos.length} videos tested
              </div>
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

      {/* Single Test Details Modal */}
      {selectedTest && (
        <TestDetailsModalSingle
          test={selectedTest}
          onClose={() => setSelectedTest(null)}
        />
      )}
    </>
  )
}

export default TestDetailsModal

