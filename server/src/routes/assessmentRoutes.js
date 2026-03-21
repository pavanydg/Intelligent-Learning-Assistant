const express = require('express');
const { body, param, query } = require('express-validator');
const {
  startAssessment,
  submitMetrics,
  completeAssessment,
  getAssessmentData,
  getAssessmentResults,
  getUserAssessments,
  getAssessmentAnalytics
} = require('../controllers/assessmentController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Validation rules
const startAssessmentValidation = [
  body('courseId')
    .notEmpty()
    .withMessage('Course ID is required'),
  body('videoId')
    .notEmpty()
    .withMessage('Video ID is required'),
  body('numQuestions')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Number of questions must be between 1 and 50'),
  body('difficulty')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Difficulty must be beginner, intermediate, or advanced')
];

const metricsValidation = [
  body('metrics')
    .isArray({ min: 1 })
    .withMessage('Metrics array is required'),
  body('metrics.*.timestamp')
    .isNumeric()
    .withMessage('Timestamp must be a number'),
  body('metrics.*.avgOnScreen')
    .isFloat({ min: 0, max: 100 })
    .withMessage('avgOnScreen must be between 0 and 100'),
  body('metrics.*.blinkRatePerMin')
    .isFloat({ min: 0 })
    .withMessage('blinkRatePerMin must be a positive number'),
  body('metrics.*.headMovement')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('headMovement must be between 0 and 100'),
  body('metrics.*.eyeGazeStability')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('eyeGazeStability must be between 0 and 100')
];

const completeAssessmentValidation = [
  body('answers')
    .isArray({ min: 1 })
    .withMessage('Answers array is required'),
  body('answers.*.questionId')
    .isMongoId()
    .withMessage('Invalid question ID'),
  body('answers.*.selectedAnswer')
    .notEmpty()
    .withMessage('Selected answer is required'),
  body('answers.*.timeSpent')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Time spent must be a positive number'),
  body('answers.*.confidence')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Confidence must be between 1 and 5'),
  body('confidence')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Overall confidence must be between 1 and 5'),
  body('timeSpent')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total time spent must be a positive number')
];

const assessmentIdValidation = [
  param('assessmentId')
    .isMongoId()
    .withMessage('Invalid assessment ID')
];

const userIdValidation = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID')
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
  query('status')
    .optional()
    .isIn(['in-progress', 'completed', 'abandoned'])
    .withMessage('Invalid status filter')
];

// Routes
router.post('/start', authenticateToken, startAssessmentValidation, startAssessment);
router.get('/:assessmentId', authenticateToken, assessmentIdValidation, getAssessmentData);
router.post('/:assessmentId/metrics', authenticateToken, assessmentIdValidation, metricsValidation, submitMetrics);
router.post('/:assessmentId/complete', authenticateToken, assessmentIdValidation, completeAssessmentValidation, completeAssessment);
router.get('/:assessmentId/results', authenticateToken, assessmentIdValidation, getAssessmentResults);
router.get('/user/:userId', authenticateToken, userIdValidation, paginationValidation, getUserAssessments);
router.get('/analytics/:userId', authenticateToken, userIdValidation, getAssessmentAnalytics);

module.exports = router;
