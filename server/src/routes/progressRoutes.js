const express = require('express');
const { body } = require('express-validator');
const {
  getCourseProgress,
  getAllUserProgress,
  markVideoCompleted,
  addTestScore,
  getProgressStats,
} = require('../controllers/progressController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Validation rules
const markVideoValidation = [
  body('courseId').notEmpty().withMessage('Course ID is required'),
  body('videoId').notEmpty().withMessage('Video ID is required'),
  body('videoTitle').notEmpty().withMessage('Video title is required'),
  body('watchTime').optional().isNumeric().withMessage('Watch time must be a number'),
];

const addTestScoreValidation = [
  body('courseId').notEmpty().withMessage('Course ID is required'),
  body('assessmentId').notEmpty().withMessage('Assessment ID is required'),
  body('score').isNumeric().withMessage('Score must be a number'),
  body('totalQuestions').isNumeric().withMessage('Total questions must be a number'),
];

// All routes require authentication
router.use(authenticateToken);

// Routes
router.get('/course/:courseId', getCourseProgress);
router.get('/all', getAllUserProgress);
router.get('/stats', getProgressStats);
router.post('/mark-video-completed', markVideoValidation, markVideoCompleted);
router.post('/add-test-score', addTestScoreValidation, addTestScore);

module.exports = router;
