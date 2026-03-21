const express = require('express');
const router = express.Router();
const playlistProgressService = require('../services/playlistProgressService');
const { asyncHandler } = require('../middlewares/errorHandler');
const { authenticateToken } = require('../middlewares/authMiddleware');

/**
 * Get playlist progress for a user
 * GET /api/playlist-progress/:playlistId
 */
router.get('/:playlistId', authenticateToken, asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const userId = req.user._id;

  // Validate playlist ID format (YouTube playlist IDs start with 'PL')
  if (!playlistId || !playlistId.startsWith('PL')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid playlist ID format. YouTube playlist IDs should start with "PL"'
    });
  }

  let progress = await playlistProgressService.getUserPlaylistProgress(userId, playlistId);

  // If no progress exists, create it with basic data
  if (!progress) {
    console.log(`📝 No progress found for playlist: ${playlistId}, creating new entry...`);
    
    try {
      // Get playlist data from YouTube API to create initial progress
      const youtubeService = require('../services/youtubeService');
      const playlistData = await youtubeService.getPlaylistDetails(playlistId);
      
      progress = await playlistProgressService.getOrCreatePlaylistProgress(
        userId, 
        playlistId, 
        {
          title: playlistData.title,
          description: playlistData.description,
          thumbnail: playlistData.thumbnail
        }
      );
      
      // Update with video data
      await playlistProgressService.updatePlaylistVideos(userId, playlistId, playlistData.videos);
      
      // Refresh progress to get updated data
      progress = await playlistProgressService.getUserPlaylistProgress(userId, playlistId);
      console.log(`✅ Successfully created playlist progress for: ${playlistData.title}`);
    } catch (error) {
      console.error('Error creating playlist progress:', error);
      console.log(`⚠️ YouTube API failed for playlist: ${playlistId}, creating fallback entry...`);
      
      // Create a basic progress entry without YouTube data as fallback
      try {
        progress = await playlistProgressService.getOrCreatePlaylistProgress(
          userId, 
          playlistId, 
          {
            title: `Playlist ${playlistId}`,
            description: 'Playlist details unavailable - YouTube API error',
            thumbnail: null
          }
        );
        
        // Try to get video data from existing course in database
        try {
          const Course = require('../models/Course');
          const existingCourse = await Course.findOne({ playlistId });
          if (existingCourse && existingCourse.videos && existingCourse.videos.length > 0) {
            console.log(`📹 Found existing course with ${existingCourse.videos.length} videos, adding to progress...`);
            await playlistProgressService.updatePlaylistVideos(userId, playlistId, existingCourse.videos);
          } else {
            console.log(`⚠️ No existing course found for playlist: ${playlistId}`);
          }
        } catch (courseError) {
          console.log('No existing course found, creating empty progress entry');
        }
        
        console.log(`✅ Created fallback playlist progress entry for: ${playlistId}`);
      } catch (fallbackError) {
        console.error('Error creating fallback playlist progress:', fallbackError);
        return res.status(404).json({
          success: false,
          message: 'Playlist progress not found and could not be created',
          error: error.message
        });
      }
    }
  }

  res.json({
    success: true,
    data: { progress }
  });
}));

/**
 * Get all user's playlist progress
 * GET /api/playlist-progress
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const progress = await playlistProgressService.getAllUserProgress(userId);

  res.json({
    success: true,
    data: { progress }
  });
}));

/**
 * Update video progress in a playlist
 * PUT /api/playlist-progress/:playlistId/video/:videoId
 */
router.put('/:playlistId/video/:videoId', authenticateToken, asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const userId = req.user._id;
  const progressData = req.body;

  const progress = await playlistProgressService.updateVideoProgress(
    userId,
    playlistId,
    videoId,
    progressData
  );

  res.json({
    success: true,
    data: { progress }
  });
}));

/**
 * Get video progress within a playlist
 * GET /api/playlist-progress/:playlistId/video/:videoId
 */
router.get('/:playlistId/video/:videoId', authenticateToken, asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const userId = req.user._id;

  const videoProgress = await playlistProgressService.getVideoProgress(userId, playlistId, videoId);

  if (!videoProgress) {
    return res.status(404).json({
      success: false,
      message: 'Video progress not found'
    });
  }

  res.json({
    success: true,
    data: { videoProgress }
  });
}));

/**
 * Update playlist with video data
 * POST /api/playlist-progress/:playlistId/videos
 */
router.post('/:playlistId/videos', authenticateToken, asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const userId = req.user._id;
  const { videos, playlistData } = req.body;

  const progress = await playlistProgressService.updatePlaylistVideos(
    userId,
    playlistId,
    videos
  );

  res.json({
    success: true,
    data: { progress }
  });
}));

/**
 * Get user progress statistics
 * GET /api/playlist-progress/stats/overview
 */
router.get('/stats/overview', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await playlistProgressService.getUserProgressStats(userId);

  res.json({
    success: true,
    data: { stats }
  });
}));

/**
 * Sync playlist completion status
 * PUT /api/playlist-progress/:playlistId/sync-completion
 */
router.put('/:playlistId/sync-completion', authenticateToken, asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const userId = req.user._id;
  const { totalVideos, completedVideos } = req.body;

  try {
    const progress = await playlistProgressService.getUserPlaylistProgress(userId, playlistId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Playlist progress not found'
      });
    }

    // Update video completion status if needed
    if (completedVideos === totalVideos && totalVideos > 0) {
      // Mark all videos as completed
      progress.videos.forEach(video => {
        video.isCompleted = true;
        video.completionPercentage = 100;
      });
      
      // Recalculate overall progress (this will trigger certificate generation)
      progress.calculateOverallProgress();
      await progress.save();
      
      console.log(`✅ Synced playlist completion: ${playlistId} - ${completedVideos}/${totalVideos} videos completed`);
    }

    res.json({
      success: true,
      data: { progress }
    });
  } catch (error) {
    console.error('Error syncing playlist completion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync playlist completion',
      error: error.message
    });
  }
}));

/**
 * Mark video as completed in playlist
 * POST /api/playlist-progress/:playlistId/video/:videoId/complete
 */
router.post('/:playlistId/video/:videoId/complete', authenticateToken, asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const userId = req.user._id;
  const { isCompleted = true, completionPercentage = 100, watchTime = 0 } = req.body;

  try {
    const progress = await playlistProgressService.getUserPlaylistProgress(userId, playlistId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Playlist progress not found'
      });
    }

    // Update video progress
    progress.updateVideoProgress(videoId, {
      isCompleted,
      completionPercentage,
      watchTime
    });

    await progress.save();

    res.json({
      success: true,
      message: 'Video progress updated successfully',
      data: {
        progress: {
          overallProgress: progress.overallProgress,
          completedVideos: progress.completedVideos,
          totalVideos: progress.totalVideos,
          isCompleted: progress.isCompleted
        }
      }
    });
  } catch (error) {
    console.error('Error updating video progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update video progress',
      error: error.message
    });
  }
}));

/**
 * Get completed playlists with certificates
 * GET /api/playlist-progress/completed
 */
router.get('/completed', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const completedPlaylists = await playlistProgressService.getCompletedPlaylistsWithCertificates(userId);

  res.json({
    success: true,
    data: { completedPlaylists }
  });
}));

module.exports = router;
