import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { api, assessmentApi, notesApi, certificateApi, endpoints, handleApiError } from '../services/api'
import { progressService } from '../services/progressService'
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Settings,
  Brain,
  Loader2,
  Maximize2,
  SkipForward,
  SkipBack,
  List,
  Clock,
  User,
  FileText,
  Book
} from 'lucide-react'
import toast from 'react-hot-toast'
import NotesPopup from '../components/NotesPopup'
import ILABot from '../components/ILABot'

// Declare YouTube API
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

interface VideoDetails {
  id: string
  title: string
  thumbnail: string
  duration: string
  description: string
  channelTitle?: string
  publishedAt?: string
}

interface PlaylistVideo {
  videoId: string
  title: string
  thumbnail: string
  duration: string
  description: string
}

const VideoPlayerPage: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>()
  const location = useLocation()
  const [video, setVideo] = useState<VideoDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [quality, setQuality] = useState('auto')
  const [showSettings, setShowSettings] = useState(false)
  
  // Playlist context
  const [playlistVideos, setPlaylistVideos] = useState<PlaylistVideo[]>([])
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [playlistId, setPlaylistId] = useState<string | null>(null)
  const [autoPlayNext, setAutoPlayNext] = useState(true)
  const [showPlaylist, setShowPlaylist] = useState(false)
  
  // Video progress tracking
  const [videoProgress, setVideoProgress] = useState(0)
  const [watchTime, setWatchTime] = useState(0)
  const [isAssessmentReady, setIsAssessmentReady] = useState(false)
  const [isGeneratingTest, setIsGeneratingTest] = useState(false)
  const [testGenerationProgress, setTestGenerationProgress] = useState('')
  const [questionsReady, setQuestionsReady] = useState(false)
  const [generatedAssessmentId, setGeneratedAssessmentId] = useState<string | null>(null)
  const [videoProgressData, setVideoProgressData] = useState<any>(null)
  const [playlistProgress, setPlaylistProgress] = useState<any>(null)
  const [notes, setNotes] = useState<any>(null)
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false)
  const [notesGenerationProgress, setNotesGenerationProgress] = useState('')
  const [showNotesPopup, setShowNotesPopup] = useState(false)
  const [notesPopupType, setNotesPopupType] = useState<'short' | 'detailed'>('short')
  const [isIssuingCertificate, setIsIssuingCertificate] = useState(false)
  const [issuedCertificateId, setIssuedCertificateId] = useState<string | null>(null)
  const [minWatchTime] = useState(0) // No minimum time required
  const [optimalWatchTime] = useState(60) // 1 minute for better questions
  
  // Removed iframeRef - using direct iframe approach
  const navigate = useNavigate()

  useEffect(() => {
    if (videoId) {
      fetchVideoDetails()
      loadVideoProgress()
      loadNotes()
      
      // Check URL parameters for playlist context
      const urlParams = new URLSearchParams(window.location.search)
      const playlistParam = urlParams.get('playlist')
      const indexParam = urlParams.get('index')
      
      if (playlistParam && indexParam) {
        // Load playlist context from URL parameters
        loadPlaylistFromUrl(playlistParam, parseInt(indexParam))
      } else {
        // Check if we have playlist context from navigation
        const state = location.state as { playlistId?: string; videos?: PlaylistVideo[]; currentIndex?: number }
        if (state?.playlistId && state?.videos) {
          setPlaylistId(state.playlistId)
          setPlaylistVideos(state.videos)
          setCurrentVideoIndex(state.currentIndex || 0)
        } else {
          // Try to fetch playlist context if video is part of a course
          fetchPlaylistContext()
        }
      }
    }
  }, [videoId, location.state])

  const loadPlaylistFromUrl = async (playlistId: string, index: number) => {
    try {
      console.log('Loading playlist from URL:', playlistId, 'index:', index)
      // Fetch the full playlist data
      const response = await api.get(`/youtube/course/${playlistId}`)
      const course = response.data.data.course
      
      setPlaylistId(playlistId)
      setPlaylistVideos(course.videos)
      setCurrentVideoIndex(index)
      console.log('Playlist loaded from URL:', course.videos.length, 'videos')
    } catch (error) {
      console.error('Error loading playlist from URL:', error)
    }
  }

  const fetchPlaylistContext = async () => {
    if (!videoId) return
    
    try {
      console.log('Fetching playlist context for video:', videoId)
      // Try to find which course/playlist this video belongs to
      const response = await api.get(`/youtube/video/${videoId}/context`)
      console.log('Playlist context response:', response.data)
      if (response.data.data.playlist) {
        setPlaylistId(response.data.data.playlist.id)
        setPlaylistVideos(response.data.data.playlist.videos)
        setCurrentVideoIndex(response.data.data.currentIndex || 0)
        console.log('Playlist context loaded:', response.data.data.playlist.videos.length, 'videos')
      }
    } catch (error: any) {
      // If no playlist context found, that's okay - video will play standalone
      console.log('No playlist context found for this video:', error.message)
    }
  }

  const fetchVideoDetails = async () => {
    if (!videoId) return

    setIsLoading(true)
    try {
      console.log('Fetching video details for:', videoId)
      const response = await api.get(`/youtube/video/${videoId}`)
      console.log('Video details response:', response.data)
      
      if (response.data.data && response.data.data.video) {
        setVideo(response.data.data.video)
        console.log('Video set:', response.data.data.video)
      } else {
        console.error('No video data in response:', response.data)
        toast.error('No video data received')
      }
    } catch (error: any) {
      console.error('Error fetching video details:', error)
      handleApiError(error)
      // Don't navigate away immediately, show error first
      toast.error('Failed to load video details')
    } finally {
      setIsLoading(false)
    }
  }

  const loadVideoProgress = async () => {
    if (!videoId || !playlistId) return

    try {
      const response = await api.get(`/playlist-progress/${playlistId}/video/${videoId}`)
      if (response.data.success) {
        setVideoProgressData(response.data.data.videoProgress)
      }
    } catch (error: any) {
      console.log('No progress data found for this video')
    }
  }

  const generateAssessment = async () => {
    if (!videoId) return

    try {
      setIsGeneratingTest(true)
      setQuestionsReady(false)
      setGeneratedAssessmentId(null)
      
      // Step 1: Start the generation process
      setTestGenerationProgress('🎬 Starting video processing...')
      
      const response = await assessmentApi.post('/assessments/start', {
        courseId: 'temp',
        videoId: videoId,
        numQuestions: 5
      })
      
      const { assessmentId } = response.data.data
      setGeneratedAssessmentId(assessmentId)
      
      // Step 2: Poll for completion
      setTestGenerationProgress('⏳ Processing video content (this may take 2-5 minutes)...')
      
      let attempts = 0
      const maxAttempts = 60 // 5 minutes with 5-second intervals
      
      while (attempts < maxAttempts) {
        try {
          // Check if assessment is ready
          const checkResponse = await api.get(`/assessments/${assessmentId}`)
          
          if (checkResponse.data.success && checkResponse.data.data.questions?.length > 0) {
            setTestGenerationProgress('✅ Questions generated successfully!')
            setQuestionsReady(true)
            
            // Show success notification
            toast.success('🎉 Assessment questions are ready! Click "Start Assessment" to begin.', {
              duration: 8000,
              position: 'top-center',
              style: {
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold',
                padding: '20px 32px',
                borderRadius: '12px',
                boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
                border: '2px solid #10B981',
                maxWidth: '400px',
                textAlign: 'center'
              },
              icon: '🎉',
              iconTheme: {
                primary: '#fff',
                secondary: '#10B981',
              }
            })
            break
          }
          
          // Update progress message
          const progressMessages = [
            '🎬 Extracting video audio...',
            '🧠 Transcribing video content...',
            '🤖 Generating questions with AI...',
            '💾 Storing questions in database...',
            '⏳ Almost ready...'
          ]
          const messageIndex = Math.floor(attempts / 12) % progressMessages.length
          setTestGenerationProgress(progressMessages[messageIndex])
          
          // Wait 5 seconds before next check
          await new Promise(resolve => setTimeout(resolve, 5000))
          attempts++
          
        } catch (checkError: any) {
          console.log('Checking assessment status...', checkError.message)
          await new Promise(resolve => setTimeout(resolve, 5000))
          attempts++
        }
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Assessment generation timed out. Please try again.')
      }
      
    } catch (error: any) {
      console.error('Assessment generation error:', error)
      
      if (error.message.includes('timed out')) {
        toast.error('Assessment generation timed out. This usually takes 2-5 minutes. Please try again.', {
          duration: 8000,
          style: {
            background: '#EF4444',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '16px 24px',
            borderRadius: '8px',
            maxWidth: '500px'
          }
        })
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Request timed out. Please try again.', {
          duration: 5000,
          style: {
            background: '#EF4444',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '16px 24px',
            borderRadius: '8px',
            maxWidth: '500px'
          }
        })
      } else {
        handleApiError(error)
      }
    } finally {
      setIsGeneratingTest(false)
      setTestGenerationProgress('')
    }
  }

  const startAssessment = () => {
    if (generatedAssessmentId && videoId) {
      navigate(`/assessment/${generatedAssessmentId}`, {
        state: { videoId, returnPath: `/video/${videoId}` }
      })
    }
  }

  const loadNotes = async () => {
    if (!videoId) return

    try {
      const response = await api.get(`/notes/${videoId}`)
      if (response.data.success) {
        setNotes(response.data.data.notes)
      }
    } catch (error: any) {
      console.log('No notes found for this video')
    }
  }

  const generateNotes = async () => {
    if (!videoId || !video) return

    try {
      setIsGeneratingNotes(true)
      setNotesGenerationProgress('🎬 Starting notes generation...')
      
      const response = await notesApi.post(`/notes/generate/${videoId}`, {
        videoData: {
          title: video.title,
          thumbnail: video.thumbnail,
          duration: video.duration
        }
      })
      
      if (response.data.success) {
        setNotes(response.data.data.notes)
        setNotesGenerationProgress('✅ Notes generated successfully!')
        
        toast.success('📝 Notes generated successfully! You can now download them as PDF.', {
          duration: 8000,
          position: 'top-center',
          style: {
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: 'white',
            fontSize: '18px',
            fontWeight: 'bold',
            padding: '20px 32px',
            borderRadius: '12px',
            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
            border: '2px solid #10B981',
            maxWidth: '400px',
            textAlign: 'center'
          },
          icon: '📝',
          iconTheme: {
            primary: '#fff',
            secondary: '#10B981',
          }
        })
      }
    } catch (error: any) {
      console.error('Notes generation error:', error)
      
      if (error.code === 'ECONNABORTED') {
        toast.error('Notes generation timed out. This usually takes 3-5 minutes. Please try again.', {
          duration: 8000,
          style: {
            background: '#EF4444',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '16px 24px',
            borderRadius: '8px',
            maxWidth: '500px'
          }
        })
      } else {
        handleApiError(error)
      }
    } finally {
      setIsGeneratingNotes(false)
      setNotesGenerationProgress('')
    }
  }

  const showNotes = (type: 'short' | 'detailed') => {
    if (!notes) {
      toast.error('No notes available for this video. Please generate notes first.', {
        duration: 5000,
        style: {
          background: '#EF4444',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          padding: '16px 24px',
          borderRadius: '8px',
          maxWidth: '500px'
        }
      })
      return
    }

    setNotesPopupType(type)
    setShowNotesPopup(true)
  }

  const closeNotesPopup = () => {
    setShowNotesPopup(false)
  }

  const isPlaylistCompleted = () => {
    if (!playlistProgress || !playlistProgress.videos) return false
    const total = playlistProgress.videos.length
    const completed = playlistProgress.videos.filter((v: any) => v.completed).length
    return total > 0 && completed === total
  }

  const issueCertificate = async () => {
    if (!playlistId) {
      toast.error('No playlist context found')
      return
    }
    if (!isPlaylistCompleted()) {
      toast.error('Complete all videos in the playlist to get the certificate')
      return
    }

    try {
      setIsIssuingCertificate(true)
      const res = await certificateApi.post(endpoints.certificates.issue(playlistId))
      if (res.data?.success) {
        const certId = res.data.data?.certificate?._id
        setIssuedCertificateId(certId)
        toast.success('🎉 Certificate issued! You can download it now.', { duration: 4000 })
      }
    } catch (error: any) {
      handleApiError(error)
    } finally {
      setIsIssuingCertificate(false)
    }
  }

  const downloadCertificate = async () => {
    if (!issuedCertificateId) {
      toast.error('Certificate not ready yet')
      return
    }
    try {
      const url = `${certificateApi.defaults.baseURL}${endpoints.certificates.download(issuedCertificateId)}`
      window.open(url as string, '_blank')
    } catch (error: any) {
      handleApiError(error)
    }
  }

  // External control handlers
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
    // Open in YouTube for actual control
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')
    toast.success(isPlaying ? 'Video paused' : 'Video playing')
  }

  const handleMuteToggle = () => {
    setIsMuted(!isMuted)
    // Open in YouTube for actual control
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')
    toast.success(isMuted ? 'Video unmuted' : 'Video muted')
  }

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed)
    toast.success(`Playback speed set to ${speed}x`)
    // Open in YouTube for actual control
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')
  }

  const handleQualityChange = (newQuality: string) => {
    setQuality(newQuality)
    toast.success(`Quality set to ${newQuality}`)
    // Open in YouTube for actual control
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')
  }

  const openInYouTube = () => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')
    toast.success('Opening in YouTube for full controls')
  }

  // Instant assessment readiness - no timer needed
  useEffect(() => {
    // Set assessment ready immediately when video loads
    if (video && !isAssessmentReady) {
      setIsAssessmentReady(true)
      console.log('Assessment ready immediately - transcript will be generated on demand')
    }
  }, [video, isAssessmentReady])

  // Track video interaction (simulated)
  const handleVideoInteraction = () => {
    setWatchTime(prev => prev + 30) // Add 30 seconds for any interaction
  }

  // Manual progress tracking buttons (for testing/fallback)
  const addWatchTime = (seconds: number) => {
    setWatchTime(prev => {
      const newTime = prev + seconds
      if (newTime >= minWatchTime && !isAssessmentReady) {
        setIsAssessmentReady(true)
        toast.success('Assessment is now ready! You can take the test.')
      }
      return newTime
    })
  }

  // Simulate video progress (for testing when YouTube API fails)
  const simulateVideoProgress = () => {
    let simulatedTime = 0
    const interval = setInterval(() => {
      simulatedTime += 10
      setWatchTime(simulatedTime)
      
      if (simulatedTime >= minWatchTime && !isAssessmentReady) {
        setIsAssessmentReady(true)
        toast.success('Assessment is now ready! You can take the test.')
      }
      
      if (simulatedTime >= 300) { // Stop after 5 minutes
        clearInterval(interval)
      }
    }, 1000)
  }

  const markVideoCompleted = async () => {
    if (!video || !playlistId) return

    try {
      // Use playlist progress service instead of course progress
      const response = await api.post(`/playlist-progress/${playlistId}/video/${video.id}/complete`, {
        isCompleted: true,
        completionPercentage: 100,
        watchTime: watchTime
      })
      
      console.log('Video marked as completed:', video.title)
      
      // Refresh playlist progress to update UI
      if (response.data.success) {
        // Trigger a refresh of the playlist page if we're in a playlist context
        if (playlistId) {
          // You could emit an event or use a state management solution here
          console.log('Playlist progress updated')
        }
      }
    } catch (error) {
      console.error('Error marking video as completed:', error)
    }
  }

  const handleVideoEnded = async () => {
    // Mark current video as completed
    await markVideoCompleted()
    
    if (autoPlayNext && playlistVideos.length > 0) {
      const nextIndex = currentVideoIndex + 1
      if (nextIndex < playlistVideos.length) {
        const nextVideo = playlistVideos[nextIndex]
        navigate(`/video/${nextVideo.videoId}`, {
          state: {
            playlistId,
            videos: playlistVideos,
            currentIndex: nextIndex
          }
        })
        toast.success(`Playing next: ${nextVideo.title}`)
      } else {
        toast.success('You\'ve reached the end of the playlist!')
      }
    }
  }

  const navigateToVideo = (index: number) => {
    if (index >= 0 && index < playlistVideos.length) {
      const targetVideo = playlistVideos[index]
      setCurrentVideoIndex(index)
      
      // Force page refresh to ensure video loads properly
      window.location.href = `/video/${targetVideo.videoId}?playlist=${playlistId}&index=${index}`
    }
  }

  const goToNextVideo = () => {
    if (currentVideoIndex < playlistVideos.length - 1) {
      navigateToVideo(currentVideoIndex + 1)
    }
  }

  const goToPreviousVideo = () => {
    if (currentVideoIndex > 0) {
      navigateToVideo(currentVideoIndex - 1)
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

  if (!video) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <Play className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Video not found
          </h3>
          <p className="text-gray-600 mb-4">
            The requested video could not be found.
          </p>
          <button
            onClick={() => navigate('/search')}
            className="btn btn-primary"
          >
            Back to Search
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-primary-600 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Video Player */}
        <div className="lg:col-span-2">
          <div className="aspect-video bg-black rounded-lg overflow-hidden mb-6 relative video-container">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-white">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <div className="text-lg">Loading video...</div>
                </div>
              </div>
            ) : videoId ? (
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&modestbranding=1&rel=0&showinfo=0&enablejsapi=1`}
                title={video?.title || 'Video Player'}
                className="w-full h-full border-0"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                style={{ pointerEvents: 'auto' }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                <div className="text-center">
                  <div className="text-lg mb-2">No Video ID</div>
                  <div className="text-sm">Please check the URL</div>
                </div>
              </div>
            )}
          </div>

          {/* Video Info */}
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {video?.title || 'Loading video...'}
            </h1>
            
            {/* Video Metadata */}
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>{video?.duration || 'Loading...'}</span>
              </div>
              {video?.channelTitle && (
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-1" />
                  <span>{video.channelTitle}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handlePlayPause}
                  className="btn btn-primary"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 mr-2" />
                  ) : (
                    <Play className="h-5 w-5 mr-2" />
                  )}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                
                <button
                  onClick={handleMuteToggle}
                  className="btn btn-outline"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5 mr-2" />
                  ) : (
                    <Volume2 className="h-5 w-5 mr-2" />
                  )}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>

                {/* Playlist Navigation Controls */}
                {playlistVideos.length > 0 ? (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={goToPreviousVideo}
                      disabled={currentVideoIndex === 0}
                      className="btn btn-outline btn-sm disabled:opacity-50"
                    >
                      <SkipBack className="h-4 w-4" />
                    </button>
                    
                    <span className="text-sm text-gray-600">
                      {currentVideoIndex + 1} / {playlistVideos.length}
                    </span>
                    
                    <button
                      onClick={goToNextVideo}
                      disabled={currentVideoIndex === playlistVideos.length - 1}
                      className="btn btn-outline btn-sm disabled:opacity-50"
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>
                    
                    {/* Manual Next Video Button */}
                    {currentVideoIndex < playlistVideos.length - 1 && (
                      <button
                        onClick={goToNextVideo}
                        className="btn btn-primary btn-sm"
                      >
                        <SkipForward className="h-4 w-4 mr-1" />
                        Next Video
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigate('/search')}
                      className="btn btn-outline btn-sm"
                    >
                      <List className="h-4 w-4 mr-1" />
                      Find Playlist
                    </button>
                    <span className="text-sm text-gray-500">
                      No playlist context
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {playlistVideos.length > 0 && (
                  <button
                    onClick={() => setShowPlaylist(!showPlaylist)}
                    className="btn btn-outline"
                  >
                    <List className="h-5 w-5 mr-2" />
                    Playlist
                  </button>
                )}
                
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="btn btn-outline"
                >
                  <Settings className="h-5 w-5 mr-2" />
                  Settings
                </button>
                
                <button
                  onClick={openInYouTube}
                  className="btn btn-primary"
                >
                  <Maximize2 className="h-5 w-5 mr-2" />
                  Open in YouTube
                </button>
              </div>
            </div>

            {/* Video Description */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700 leading-relaxed text-sm">
                {video.description}
              </p>
              {video.publishedAt && (
                <div className="mt-2 text-xs text-gray-500">
                  Published: {new Date(video.publishedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Playlist Panel */}
          {showPlaylist && playlistVideos.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Playlist ({playlistVideos.length} videos)</h3>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {playlistVideos.map((playlistVideo, index) => (
                  <div
                    key={playlistVideo.videoId}
                    className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                      index === currentVideoIndex
                        ? 'bg-primary-100 border border-primary-300'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => navigateToVideo(index)}
                  >
                    <div className="w-16 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0 mr-3">
                      <img
                        src={playlistVideo.thumbnail}
                        alt={playlistVideo.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
                        {playlistVideo.title}
                      </h4>
                      <p className="text-xs text-gray-500">{playlistVideo.duration}</p>
                    </div>
                    {index === currentVideoIndex && (
                      <div className="text-primary-600 text-sm font-medium">Now Playing</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Video Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Playback Speed</label>
                  <select 
                    className="input w-full"
                    value={playbackSpeed}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-2">Quality</label>
                  <select 
                    className="input w-full"
                    value={quality}
                    onChange={(e) => handleQualityChange(e.target.value)}
                  >
                    <option value="auto">Auto</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="360p">360p</option>
                  </select>
                </div>
              </div>

              {/* Auto-play Settings */}
              {playlistVideos.length > 0 && (
                <div className="mt-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={autoPlayNext}
                      onChange={(e) => setAutoPlayNext(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Auto-play next video when current video ends</span>
                  </label>
                </div>
              )}

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> For full control over playback speed and quality, 
                  click "Open in YouTube" to use YouTube's native controls.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="space-y-6">
            {/* Video Info Card */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-lg">Video Information</h3>
              </div>
              <div className="card-content">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Duration</span>
                    <span className="text-sm font-medium">{video.duration}</span>
                  </div>
                  
                  {video.channelTitle && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Channel</span>
                      <span className="text-sm font-medium">{video.channelTitle}</span>
                    </div>
                  )}
                  
                  {video.publishedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Published</span>
                      <span className="text-sm font-medium">
                        {new Date(video.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Video Progress Data */}
            {videoProgressData && (
              <div className="card mb-4 bg-green-50 border-green-200">
                <div className="card-header">
                  <h3 className="card-title text-green-800">📊 Your Progress</h3>
                </div>
                <div className="card-content">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-green-700 font-medium">Best Score:</span>
                      <span className="ml-2 text-green-600">{videoProgressData.bestScore}%</span>
                    </div>
                    <div>
                      <span className="text-green-700 font-medium">Average Score:</span>
                      <span className="ml-2 text-green-600">{videoProgressData.averageScore}%</span>
                    </div>
                    <div>
                      <span className="text-green-700 font-medium">Attempts:</span>
                      <span className="ml-2 text-green-600">{videoProgressData.totalAttempts}</span>
                    </div>
                    <div>
                      <span className="text-green-700 font-medium">Status:</span>
                      <span className="ml-2 text-green-600">
                        {videoProgressData.isCompleted ? '✅ Completed' : '📚 In Progress'}
                      </span>
                    </div>
                  </div>
                  {videoProgressData.attempts && videoProgressData.attempts.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-green-700 mb-2">Recent Attempts:</h4>
                      <div className="space-y-1">
                        {videoProgressData.attempts.slice(-3).map((attempt: any, index: number) => (
                          <div key={index} className="flex justify-between text-xs text-green-600">
                            <span>Attempt {attempt.attemptNumber}</span>
                            <span>{attempt.testScore}%</span>
                            <span>{new Date(attempt.completedAt).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes Card */}
            <div className="card mb-4">
              <div className="card-header">
                <h3 className="card-title text-lg">📝 Video Notes</h3>
              </div>
              <div className="card-content">
      <p className="text-sm text-gray-600 mb-4">
        Generate comprehensive notes with short and detailed summaries from this video.
      </p>
                
                {!notes ? (
                  <div className="space-y-3">
                    <button
                      onClick={generateNotes}
                      disabled={isGeneratingNotes}
                      className={`btn w-full ${isGeneratingNotes ? 'btn-disabled' : 'btn-primary'}`}
                    >
                      <Brain className="h-5 w-5 mr-2" />
                      {isGeneratingNotes ? 'Generating Notes...' : 'Create Notes'}
                    </button>
                    
                    {isGeneratingNotes && (
                      <div className="mt-4 space-y-3">
                        <div className="text-sm text-blue-600 text-center">
                          {notesGenerationProgress}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                        </div>
                        <div className="text-xs text-gray-500 text-center">
                          This may take 3-5 minutes for comprehensive notes. Please be patient.
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center">
              <span className="text-gray-600 font-medium">Short Notes:</span>
              <span className="ml-2 text-blue-600">{notes.estimatedReadTime?.shortNotes || 5} min</span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-600 font-medium">Detailed Notes:</span>
              <span className="ml-2 text-blue-600">{notes.estimatedReadTime?.detailedNotes || 15} min</span>
            </div>
          </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => showNotes('short')}
                        className="btn btn-primary flex items-center justify-center"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Short Notes
                      </button>
                      <button
                        onClick={() => showNotes('detailed')}
                        className="btn btn-secondary flex items-center justify-center"
                      >
                        <Book className="h-4 w-4 mr-2" />
                        View Detailed Notes
                      </button>
                    </div>
                    
                    <div className="flex justify-center">
                      <button
                        onClick={async () => {
                          setNotes(null);
                          // Regenerate notes with force flag using cached transcript
                          try {
                            setIsGeneratingNotes(true);
                            setNotesGenerationProgress('🔄 Regenerating notes from cached transcript...');
                            
                            const response = await notesApi.post(`/notes/generate/${videoId}?force=true`, {
                              videoData: {
                                title: video?.title || 'Video',
                                thumbnail: video?.thumbnail || '',
                                duration: video?.duration || 'PT0S'
                              }
                            });
                            
                            if (response.data.success) {
                              setNotes(response.data.data.notes);
                              setNotesGenerationProgress('✅ Notes regenerated successfully!');
                              toast.success('📝 Notes regenerated successfully!', {
                                duration: 3000,
                              });
                            }
                            setIsGeneratingNotes(false);
                          } catch (error) {
                            console.error('Error regenerating notes:', error);
                            setIsGeneratingNotes(false);
                            setNotesGenerationProgress('');
                            toast.error('Failed to regenerate notes. Please try again.', {
                              duration: 3000,
                            });
                          }
                        }}
                        className="btn btn-outline text-sm"
                      >
                        🔄 Regenerate Notes
                      </button>
                    </div>
                  </div>
                )}
              </div>
          </div>

            {/* Assessment Card */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-lg">Ready to Test Your Knowledge?</h3>
              </div>
              <div className="card-content">
                <p className="text-sm text-gray-600 mb-4">
                  Take an AI-generated assessment based on this video's content.
                </p>
              {!questionsReady ? (
                <button
                  onClick={generateAssessment}
                  disabled={isGeneratingTest}
                  className={`btn w-full ${isGeneratingTest ? 'btn-disabled' : 'btn-primary'}`}
                >
                  <Brain className="h-5 w-5 mr-2" />
                  {isGeneratingTest ? 'Generating Assessment...' : 'Generate Assessment'}
                </button>
              ) : (
                <button
                  onClick={startAssessment}
                  className="btn w-full btn-success"
                >
                  <Brain className="h-5 w-5 mr-2" />
                  Start Assessment
                </button>
              )}
        
        {isGeneratingTest && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-blue-600 text-center">
              {testGenerationProgress}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
            <div className="text-xs text-gray-500 text-center">
              This may take 5-7 minutes for high-quality questions. Please be patient.
            </div>
          </div>
        )}
        
        {questionsReady && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-green-600 text-center font-semibold">
              ✅ Assessment questions are ready!
            </div>
            <div className="text-xs text-gray-600 text-center">
              Click "Start Assessment" to begin your test
            </div>
          </div>
        )}
        
        {!isGeneratingTest && !questionsReady && (
          <div className="text-sm text-gray-600 mt-2 text-center">
            Click "Generate Assessment" to create questions from video transcript
          </div>
        )}
              </div>
            </div>

            {/* Video Controls */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-lg">Video Controls</h3>
              </div>
              <div className="card-content space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Duration</span>
                  <span className="text-sm font-medium">{video.duration}</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Playback Speed</label>
                  <select 
                    className="input w-full"
                    value={playbackSpeed}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Quality</label>
                  <select 
                    className="input w-full"
                    value={quality}
                    onChange={(e) => handleQualityChange(e.target.value)}
                  >
                    <option value="auto">Auto</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="360p">360p</option>
                  </select>
                </div>
              </div>
            </div>

          {/* Assessment Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title text-lg">Assessment Info</h3>
            </div>
            <div className="card-content">
              <div className="space-y-3">
                {questionsReady ? (
                  <>
                    <div className="text-sm text-green-600 font-semibold">
                      ✅ Questions generated successfully
                    </div>
                    <div className="text-sm text-gray-600">
                      🎯 Ready to start your assessment
                    </div>
                    <div className="text-sm text-gray-600">
                      📝 Questions are based on video content
                    </div>
                  </>
                ) : isGeneratingTest ? (
                  <>
                    <div className="text-sm text-blue-600 font-semibold">
                      🔄 Generating questions...
                    </div>
                    <div className="text-sm text-gray-600">
                      🧠 AI is analyzing video transcript
                    </div>
                    <div className="text-sm text-gray-600">
                      ⏱️ This may take 5-7 minutes
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-gray-600">
                      🎬 Click "Generate Assessment" to begin
                    </div>
                    <div className="text-sm text-gray-600">
                      🧠 AI will generate questions from video transcript
                    </div>
                    <div className="text-sm text-gray-600">
                      📝 Questions will be video-specific and relevant
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

            {/* Learning Tips */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-lg">Learning Tips</h3>
              </div>
              <div className="card-content">
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    Take notes while watching
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    Pause to reflect on key concepts
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    Use the assessment to test understanding
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    Review difficult sections multiple times
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Certificate Card (only when playlist context exists) */}
      {playlistId && (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title text-lg">🏅 Certificate of Completion</h3>
          </div>
          <div className="card-content space-y-3">
            {isPlaylistCompleted() ? (
              <>
                <p className="text-sm text-gray-600">You've completed all videos in this playlist. Issue your professional certificate.</p>
                <div className="flex gap-2">
                  <button
                    onClick={issueCertificate}
                    disabled={isIssuingCertificate}
                    className={`btn ${isIssuingCertificate ? 'btn-disabled' : 'btn-primary'}`}
                  >
                    {isIssuingCertificate ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Issuing...
                      </>
                    ) : (
                      'Issue Certificate'
                    )}
                  </button>
                  <button
                    onClick={downloadCertificate}
                    disabled={!issuedCertificateId}
                    className={`btn btn-outline ${!issuedCertificateId ? 'btn-disabled' : ''}`}
                  >
                    Download
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600">Complete all videos in the playlist to unlock your certificate.</p>
            )}
          </div>
        </div>
      )}

      {/* Notes Popup */}
      {notes && (
        <NotesPopup
          isOpen={showNotesPopup}
          onClose={closeNotesPopup}
          notes={{
            ...notes,
            videoId: videoId || undefined
          }}
          type={notesPopupType}
        />
      )}

      {/* ILABot - Modern context-aware educational assistant */}
      <ILABot
        videoId={videoId}
        transcript={notes?.transcript}
        description={video?.description}
        topic={video?.title}
        videoTitle={video?.title}
        context={notes?.transcript}
      />
    </div>
  )
}

export default VideoPlayerPage
