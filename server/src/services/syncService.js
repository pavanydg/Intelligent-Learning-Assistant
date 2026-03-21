/**
 * Sync Service
 * Handles cross-device synchronization of learning progress
 */

const PlaylistProgress = require('../models/PlaylistProgress');

class SyncService {
  /**
   * Sync video progress across devices
   * @param {string} userId - User ID
   * @param {string} playlistId - Playlist ID
   * @param {string} videoId - Video ID
   * @param {Object} progressData - Progress data
   * @returns {Promise<Object>} Sync result
   */
  async syncVideoProgress(userId, playlistId, videoId, progressData) {
    try {
      let playlistProgress = await PlaylistProgress.findOne({
        userId,
        playlistId
      });

      if (!playlistProgress) {
        // Create new progress entry
        playlistProgress = new PlaylistProgress({
          userId,
          playlistId,
          playlistTitle: progressData.playlistTitle || 'Untitled Playlist',
          playlistThumbnail: progressData.playlistThumbnail || '',
          videos: [],
          overallProgress: 0,
          completedVideos: 0,
          totalVideos: 0,
          averageScore: 0,
          totalTimeSpent: 0,
          lastSyncedAt: new Date()
        });
      }

      // Update video progress
      playlistProgress.updateVideoProgress(videoId, {
        videoTitle: progressData.videoTitle,
        videoThumbnail: progressData.videoThumbnail,
        watchTime: progressData.watchTime || 0,
        totalDuration: progressData.totalDuration || 0,
        completionPercentage: progressData.completionPercentage || 0,
        lastPosition: progressData.lastPosition || 0,
        isCompleted: progressData.isCompleted || false
      });

      // Update total time spent
      if (progressData.watchTime) {
        const video = playlistProgress.videos.find(v => v.videoId === videoId);
        if (video) {
          const oldWatchTime = video.watchTime || 0;
          playlistProgress.totalTimeSpent = (playlistProgress.totalTimeSpent || 0) - oldWatchTime + progressData.watchTime;
        }
      }

      await playlistProgress.save();

      return {
        success: true,
        lastSyncedAt: playlistProgress.lastSyncedAt,
        progress: {
          videoId,
          lastPosition: progressData.lastPosition || 0,
          completionPercentage: progressData.completionPercentage || 0
        }
      };
    } catch (error) {
      console.error('Sync video progress error:', error);
      throw error;
    }
  }

  /**
   * Get last synced position for a video
   * @param {string} userId - User ID
   * @param {string} playlistId - Playlist ID
   * @param {string} videoId - Video ID
   * @returns {Promise<Object>} Last position data
   */
  async getLastPosition(userId, playlistId, videoId) {
    try {
      const playlistProgress = await PlaylistProgress.findOne({
        userId,
        playlistId
      });

      if (!playlistProgress) {
        return {
          lastPosition: 0,
          completionPercentage: 0,
          watchTime: 0
        };
      }

      const video = playlistProgress.videos.find(v => v.videoId === videoId);
      
      if (!video) {
        return {
          lastPosition: 0,
          completionPercentage: 0,
          watchTime: 0
        };
      }

      return {
        lastPosition: video.lastPosition || 0,
        completionPercentage: video.completionPercentage || 0,
        watchTime: video.watchTime || 0,
        lastSyncedAt: playlistProgress.lastSyncedAt
      };
    } catch (error) {
      console.error('Get last position error:', error);
      throw error;
    }
  }

  /**
   * Get all synced progress for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of synced progress
   */
  async getAllSyncedProgress(userId) {
    try {
      const progressList = await PlaylistProgress.find({ userId })
        .select('playlistId playlistTitle lastSyncedAt videos.videoId videos.lastPosition videos.completionPercentage')
        .sort({ lastSyncedAt: -1 });

      return progressList.map(progress => ({
        playlistId: progress.playlistId,
        playlistTitle: progress.playlistTitle,
        lastSyncedAt: progress.lastSyncedAt,
        videos: progress.videos.map(v => ({
          videoId: v.videoId,
          lastPosition: v.lastPosition || 0,
          completionPercentage: v.completionPercentage || 0
        }))
      }));
    } catch (error) {
      console.error('Get all synced progress error:', error);
      throw error;
    }
  }
}

module.exports = new SyncService();


