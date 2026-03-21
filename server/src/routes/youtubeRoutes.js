const express = require('express');
const { query, param } = require('express-validator');
const axios = require('axios');
const {
  searchPlaylists,
  getPlaylistDetails,
  getVideoTranscript,
  getCourse,
  getCourses,
  getVideoDetails,
  searchCourses,
  savePlaylist,
  getVideoContext,
  getVideoWithContent,
  generateCourseTest,
  getVideoNotes,
  getVideoQuestions
} = require('../controllers/youtubeController');
const { getCourseByKey } = require('../controllers/teacherController');
const { authenticateToken, optionalAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Validation rules
const searchValidation = [
  query('query')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters long'),
  query('maxResults')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Max results must be between 1 and 50')
];

const playlistIdValidation = [
  param('playlistId')
    .notEmpty()
    .withMessage('Playlist ID is required')
];

const videoIdValidation = [
  param('videoId')
    .notEmpty()
    .withMessage('Video ID is required')
];

const courseIdValidation = [
  param('courseId')
    .notEmpty()
    .withMessage('Course ID is required')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['title', 'createdAt', 'difficulty', 'category'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Test endpoint for YouTube API
router.get('/test-api', authenticateToken, async (req, res) => {
  try {
    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'YouTube API key not configured'
      });
    }

    // Test with a simple search
    const testResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: 'test',
        maxResults: 1,
        key: apiKey
      }
    });

    res.json({
      success: true,
      message: 'YouTube API key is working',
      data: {
        apiKeyConfigured: true,
        testResults: testResponse.data.items?.length || 0
      }
    });
  } catch (error) {
    console.error('YouTube API test error:', error);
    res.status(500).json({
      success: false,
      message: 'YouTube API test failed',
      error: error.message,
      details: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        apiKeyConfigured: !!process.env.YOUTUBE_DATA_API_KEY
      }
    });
  }
});

// Routes
router.get('/search', searchValidation, searchPlaylists);
router.get('/playlist/:playlistId', playlistIdValidation, getPlaylistDetails);
router.get('/video/:videoId/transcript', videoIdValidation, getVideoTranscript);
router.get('/course/:courseId', courseIdValidation, getCourse);
router.get('/courses', paginationValidation, getCourses);
router.get('/video/:videoId', videoIdValidation, getVideoDetails);
router.get('/video/:videoId/context', videoIdValidation, getVideoContext);
router.get('/search-courses', searchValidation, searchCourses);
router.post('/save-playlist', authenticateToken, savePlaylist);
router.get('/course-by-key/:key', authenticateToken, getCourseByKey); // For students to access courses by key

// AI-powered routes
router.get('/video/:videoId/content', videoIdValidation, getVideoWithContent);
router.get('/video/:videoId/notes', videoIdValidation, getVideoNotes);
router.get('/video/:videoId/questions', videoIdValidation, getVideoQuestions);
router.post('/course/:courseId/test', courseIdValidation, generateCourseTest);

module.exports = router;
