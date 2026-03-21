const { asyncHandler } = require('../middlewares/errorHandler');
const completedCourseService = require('../services/completedCourseService');

/**
 * Get all completed courses for the authenticated user
 * GET /api/completed-courses
 */
const getCompletedCourses = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  const completedCourses = await completedCourseService.getUserCompletedCourses(userId);

  // Normalize certificateId to always be a string for the client
  const normalized = completedCourses.map((c) => {
    const obj = c.toObject ? c.toObject() : c
    const cert = obj.certificateId
    const certificateId = typeof cert === 'object' && cert !== null ? (cert._id?.toString?.() || cert.id || '') : (cert || '')
    return {
      ...obj,
      certificateId,
      certificate: cert && typeof cert === 'object' ? {
        _id: cert._id?.toString?.() || cert.id || undefined,
        certificateNumber: cert.certificateNumber,
        issuedAt: cert.issuedAt,
        certificatePath: cert.certificatePath
      } : undefined
    }
  })

  res.json({
    success: true,
    data: { completedCourses: normalized }
  });
});

/**
 * Get completed course by ID
 * GET /api/completed-courses/:id
 */
const getCompletedCourseById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  
  const completedCourse = await completedCourseService.getCompletedCourseById(id, userId);
  
  if (!completedCourse) {
    return res.status(404).json({
      success: false,
      message: 'Completed course not found'
    });
  }
  
  res.json({
    success: true,
    data: { completedCourse }
  });
});

/**
 * Get completion statistics for the authenticated user
 * GET /api/completed-courses/stats
 */
const getCompletionStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  const stats = await completedCourseService.getUserCompletionStats(userId);
  
  res.json({
    success: true,
    data: { stats }
  });
});

/**
 * Manually mark a course as completed (for testing/admin purposes)
 * POST /api/completed-courses/mark-completed
 */
const markCourseCompleted = asyncHandler(async (req, res) => {
  const { playlistId } = req.body;
  const userId = req.user._id;
  
  if (!playlistId) {
    return res.status(400).json({
      success: false,
      message: 'Playlist ID is required'
    });
  }
  
  const completedCourse = await completedCourseService.markCourseCompleted(userId, playlistId);
  
  res.json({
    success: true,
    message: 'Course marked as completed',
    data: { completedCourse }
  });
});

module.exports = {
  getCompletedCourses,
  getCompletedCourseById,
  getCompletionStats,
  markCourseCompleted
};


