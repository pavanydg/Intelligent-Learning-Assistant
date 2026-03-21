const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getFeedback,
  getUserFeedbackHistory,
  updateFeedbackInteraction,
  getLearningRecommendations,
  getCognitiveInsights,
  getSuggestedTopics
} = require('../controllers/feedbackController');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Validation rules
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

const feedbackIdValidation = [
  param('feedbackId')
    .isMongoId()
    .withMessage('Invalid feedback ID')
];

const interactionValidation = [
  body('type')
    .isIn(['helpful', 'not_helpful'])
    .withMessage('Interaction type must be helpful or not_helpful')
];

const limitValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// Routes
router.get('/assessment/:assessmentId', authenticateToken, assessmentIdValidation, getFeedback);
router.get('/user/:userId/history', authenticateToken, userIdValidation, limitValidation, getUserFeedbackHistory);
router.put('/:feedbackId/interaction', authenticateToken, feedbackIdValidation, interactionValidation, updateFeedbackInteraction);
router.get('/user/:userId/recommendations', authenticateToken, userIdValidation, getLearningRecommendations);
router.get('/user/:userId/insights', authenticateToken, userIdValidation, getCognitiveInsights);
router.get('/user/:userId/suggested-topics', authenticateToken, userIdValidation, getSuggestedTopics);

module.exports = router;
