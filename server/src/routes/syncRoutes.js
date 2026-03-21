/**
 * Sync Routes
 * Handles cross-device synchronization endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../middlewares/errorHandler');
const syncService = require('../services/syncService');

/**
 * PUT /api/sync/progress/:playlistId/video/:videoId
 * Sync video progress (called every 10 seconds from frontend)
 */
router.put('/progress/:playlistId/video/:videoId', authenticateToken, asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const { progress, lastPosition, watchTime, totalDuration, completionPercentage, isCompleted, videoTitle, videoThumbnail, playlistTitle, playlistThumbnail } = req.body;

  const result = await syncService.syncVideoProgress(req.user.id, playlistId, videoId, {
    progress,
    lastPosition: lastPosition || 0,
    watchTime: watchTime || 0,
    totalDuration: totalDuration || 0,
    completionPercentage: completionPercentage || 0,
    isCompleted: isCompleted || false,
    videoTitle,
    videoThumbnail,
    playlistTitle,
    playlistThumbnail
  });

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/sync/position/:playlistId/video/:videoId
 * Get last synced position for a video
 */
router.get('/position/:playlistId/video/:videoId', authenticateToken, asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  const position = await syncService.getLastPosition(req.user.id, playlistId, videoId);

  res.json({
    success: true,
    data: position
  });
}));

/**
 * GET /api/sync/progress
 * Get all synced progress for current user
 */
router.get('/progress', authenticateToken, asyncHandler(async (req, res) => {
  const progress = await syncService.getAllSyncedProgress(req.user.id);

  res.json({
    success: true,
    data: progress
  });
}));

module.exports = router;


