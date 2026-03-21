import { api } from './api'

export interface VideoProgress {
  videoId: string
  videoTitle: string
  videoThumbnail: string
  isCompleted: boolean
  watchTime: number
  totalDuration: number
  completionPercentage: number
  attempts: AssessmentAttempt[]
  bestScore: number
  averageScore: number
  totalAttempts: number
}

export interface AssessmentAttempt {
  attemptNumber: number
  testScore: number
  cli: number
  cliClassification: string
  confidence: number
  timeSpent: number
  completedAt: string
  assessmentId: string
}

export interface PlaylistProgress {
  _id: string
  userId: string
  playlistId: string
  playlistTitle: string
  playlistThumbnail: string
  videos: VideoProgress[]
  overallProgress: number
  completedVideos: number
  totalVideos: number
  averageScore: number
  totalTimeSpent: number
  lastAccessed: string
  isCompleted: boolean
  completedAt?: string
}

export interface ProgressStats {
  totalPlaylists: number
  completedPlaylists: number
  totalVideos: number
  completedVideos: number
  averageScore: number
  totalTimeSpent: number
  recentActivity: PlaylistProgress[]
}

class PlaylistProgressService {
  /**
   * Get playlist progress for a user
   */
  async getPlaylistProgress(playlistId: string): Promise<PlaylistProgress | null> {
    try {
      const response = await api.get(`/playlist-progress/${playlistId}`)
      return response.data.success ? response.data.data.progress : null
    } catch (error) {
      console.error('Error fetching playlist progress:', error)
      return null
    }
  }

  /**
   * Get all user's playlist progress
   */
  async getAllUserProgress(): Promise<PlaylistProgress[]> {
    try {
      const response = await api.get('/playlist-progress')
      return response.data.success ? response.data.data.progress : []
    } catch (error) {
      console.error('Error fetching all user progress:', error)
      return []
    }
  }

  /**
   * Update video progress in a playlist
   */
  async updateVideoProgress(
    playlistId: string, 
    videoId: string, 
    progressData: Partial<VideoProgress>
  ): Promise<PlaylistProgress | null> {
    try {
      const response = await api.put(`/playlist-progress/${playlistId}/video/${videoId}`, progressData)
      return response.data.success ? response.data.data.progress : null
    } catch (error) {
      console.error('Error updating video progress:', error)
      return null
    }
  }

  /**
   * Get video progress within a playlist
   */
  async getVideoProgress(playlistId: string, videoId: string): Promise<VideoProgress | null> {
    try {
      const response = await api.get(`/playlist-progress/${playlistId}/video/${videoId}`)
      return response.data.success ? response.data.data.videoProgress : null
    } catch (error) {
      console.error('Error fetching video progress:', error)
      return null
    }
  }

  /**
   * Update playlist with video data
   */
  async updatePlaylistVideos(
    playlistId: string, 
    videos: any[], 
    playlistData?: any
  ): Promise<PlaylistProgress | null> {
    try {
      const response = await api.post(`/playlist-progress/${playlistId}/videos`, {
        videos,
        playlistData
      })
      return response.data.success ? response.data.data.progress : null
    } catch (error) {
      console.error('Error updating playlist videos:', error)
      return null
    }
  }

  /**
   * Get user progress statistics
   */
  async getUserProgressStats(): Promise<ProgressStats | null> {
    try {
      const response = await api.get('/playlist-progress/stats/overview')
      return response.data.success ? response.data.data.stats : null
    } catch (error) {
      console.error('Error fetching user progress stats:', error)
      return null
    }
  }
}

export const playlistProgressService = new PlaylistProgressService()
