const express = require('express');
const { body, param } = require('express-validator');
const {
  getCompletedCourses,
  getCompletedCourseById,
  getCompletionStats,
  markCourseCompleted
} = require('../controllers/completedCourseController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const playlistIdValidation = [
  body('playlistId')
    .notEmpty()
    .withMessage('Playlist ID is required')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid completed course ID')
];

/**
 * @route   GET /api/completed-courses
 * @desc    Get all completed courses for the authenticated user
 * @access  Private
 */
router.get('/', getCompletedCourses);

/**
 * @route   GET /api/completed-courses/:id
 * @desc    Get completed course by ID
 * @access  Private
 */
router.get('/:id', idValidation, getCompletedCourseById);

/**
 * @route   GET /api/completed-courses/stats/overview
 * @desc    Get completion statistics for the authenticated user
 * @access  Private
 */
router.get('/stats/overview', getCompletionStats);

/**
 * @route   POST /api/completed-courses/mark-completed
 * @desc    Manually mark a course as completed
 * @access  Private
 */
router.post('/mark-completed', playlistIdValidation, markCourseCompleted);

module.exports = router;


