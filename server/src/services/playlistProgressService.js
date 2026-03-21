const PlaylistProgress = require('../models/PlaylistProgress');
const Assessment = require('../models/Assessment');

class PlaylistProgressService {
  /**
   * Get or create playlist progress for a user
   * @param {string} userId - User ID
   * @param {string} playlistId - Playlist ID
   * @param {Object} playlistData - Playlist information
   * @returns {Promise<Object>} Playlist progress
   */
  async getOrCreatePlaylistProgress(userId, playlistId, playlistData) {
    try {
      let progress = await PlaylistProgress.findOne({
        userId,
        playlistId
      });

      if (!progress) {
        // Create new progress record
        progress = new PlaylistProgress({
          userId,
          playlistId,
          playlistTitle: playlistData.title || 'Untitled Playlist',
          playlistThumbnail: playlistData.thumbnail || '',
          videos: [],
          overallProgress: 0,
          completedVideos: 0,
          totalVideos: 0,
          averageScore: 0,
          totalTimeSpent: 0,
          isCompleted: false
        });

        await progress.save();
      }

      return progress;
    } catch (error) {
      console.error('Error getting playlist progress:', error);
      throw error;
    }
  }

  /**
   * Update video progress in a playlist
   * @param {string} userId - User ID
   * @param {string} playlistId - Playlist ID
   * @param {string} videoId - Video ID
   * @param {Object} progressData - Progress data
   * @returns {Promise<Object>} Updated progress
   */
  async updateVideoProgress(userId, playlistId, videoId, progressData) {
    try {
      const progress = await this.getOrCreatePlaylistProgress(userId, playlistId, {});
      
      progress.updateVideoProgress(videoId, progressData);
      await progress.save();

      return progress;
    } catch (error) {
      console.error('Error updating video progress:', error);
      throw error;
    }
  }

  /**
   * Add assessment attempt to playlist progress
   * @param {string} userId - User ID
   * @param {string} playlistId - Playlist ID
   * @param {string} videoId - Video ID
   * @param {Object} attemptData - Attempt data
   * @returns {Promise<Object>} Updated progress
   */
  async addAssessmentAttempt(userId, playlistId, videoId, attemptData) {
    try {
      const progress = await this.getOrCreatePlaylistProgress(userId, playlistId, {});
      
      progress.addAssessmentAttempt(videoId, attemptData);
      await progress.save();

      return progress;
    } catch (error) {
      console.error('Error adding assessment attempt:', error);
      throw error;
    }
  }

  /**
   * Get user's playlist progress
   * @param {string} userId - User ID
   * @param {string} playlistId - Playlist ID
   * @returns {Promise<Object>} Playlist progress
   */
  async getUserPlaylistProgress(userId, playlistId) {
    try {
      const progress = await PlaylistProgress.findOne({
        userId,
        playlistId
      }).populate('userId', 'name email');

      return progress;
    } catch (error) {
      console.error('Error getting user playlist progress:', error);
      throw error;
    }
  }

  /**
   * Get all user's playlist progress
   * @param {string} userId - User ID
   * @returns {Promise<Array>} All playlist progress
   */
  async getAllUserProgress(userId) {
    try {
      const progress = await PlaylistProgress.find({
        userId
      }).sort({ lastAccessed: -1 });

      // Recalculate overall progress for each playlist to ensure accuracy
      for (const p of progress) {
        p.calculateOverallProgress();
        await p.save();
      }

      return progress;
    } catch (error) {
      console.error('Error getting all user progress:', error);
      throw error;
    }
  }

  /**
   * Get video progress within a playlist
   * @param {string} userId - User ID
   * @param {string} playlistId - Playlist ID
   * @param {string} videoId - Video ID
   * @returns {Promise<Object>} Video progress
   */
  async getVideoProgress(userId, playlistId, videoId) {
    try {
      const progress = await PlaylistProgress.findOne({
        userId,
        playlistId,
        'videos.videoId': videoId
      });

      if (!progress) {
        return null;
      }

      const video = progress.videos.find(v => v.videoId === videoId);
      return video;
    } catch (error) {
      console.error('Error getting video progress:', error);
      throw error;
    }
  }

  /**
   * Update playlist with video data
   * @param {string} userId - User ID
   * @param {string} playlistId - Playlist ID
   * @param {Array} videos - Array of video data
   * @returns {Promise<Object>} Updated progress
   */
  async updatePlaylistVideos(userId, playlistId, videos) {
    try {
      const progress = await this.getOrCreatePlaylistProgress(userId, playlistId, {});
      
      // Update or add videos to progress
      videos.forEach(videoData => {
        const existingVideo = progress.videos.find(v => v.videoId === videoData.videoId);
        
        if (!existingVideo) {
          progress.videos.push({
            videoId: videoData.videoId,
            videoTitle: videoData.title || '',
            videoThumbnail: videoData.thumbnail || '',
            isCompleted: false,
            watchTime: 0,
            totalDuration: videoData.duration || 0,
            completionPercentage: 0,
            attempts: [],
            bestScore: 0,
            averageScore: 0,
            totalAttempts: 0
          });
        } else {
          // Update existing video data
          existingVideo.videoTitle = videoData.title || existingVideo.videoTitle;
          existingVideo.videoThumbnail = videoData.thumbnail || existingVideo.videoThumbnail;
          existingVideo.totalDuration = videoData.duration || existingVideo.totalDuration;
        }
      });

      // Recalculate overall progress
      progress.calculateOverallProgress();
      await progress.save();

      return progress;
    } catch (error) {
      console.error('Error updating playlist videos:', error);
      throw error;
    }
  }

  /**
   * Get progress statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Progress statistics
   */
  async getUserProgressStats(userId) {
    try {
      const allProgress = await this.getAllUserProgress(userId);
      
      const stats = {
        totalPlaylists: allProgress.length,
        completedPlaylists: allProgress.filter(p => p.isCompleted).length,
        totalVideos: allProgress.reduce((sum, p) => sum + p.totalVideos, 0),
        completedVideos: allProgress.reduce((sum, p) => sum + p.completedVideos, 0),
        averageScore: 0,
        totalTimeSpent: allProgress.reduce((sum, p) => sum + p.totalTimeSpent, 0),
        recentActivity: allProgress
          .sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed))
          .slice(0, 5)
      };

      // Calculate overall average score
      const allScores = allProgress
        .filter(p => p.averageScore > 0)
        .map(p => p.averageScore);
      
      if (allScores.length > 0) {
        stats.averageScore = Math.round(
          allScores.reduce((sum, score) => sum + score, 0) / allScores.length
        );
      }

      return stats;
    } catch (error) {
      console.error('Error getting user progress stats:', error);
      throw error;
    }
  }

  /**
   * Get completed playlists with certificates
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Completed playlists with certificate info
   */
  async getCompletedPlaylistsWithCertificates(userId) {
    try {
      const completedProgress = await PlaylistProgress.find({
        userId,
        isCompleted: true
      }).sort({ completedAt: -1 });

      const Certificate = require('../models/Certificate');
      const playlistsWithCerts = await Promise.all(
        completedProgress.map(async (progress) => {
          const certificate = await Certificate.findOne({
            userId,
            playlistId: progress.playlistId
          });

          return {
            ...progress.toObject(),
            certificate: certificate ? {
              id: certificate._id,
              certificateNumber: certificate.certificateNumber,
              issuedAt: certificate.issuedAt,
              certificatePath: certificate.certificatePath
            } : null
          };
        })
      );

      return playlistsWithCerts;
    } catch (error) {
      console.error('Error getting completed playlists with certificates:', error);
      throw error;
    }
  }
}

module.exports = new PlaylistProgressService();
