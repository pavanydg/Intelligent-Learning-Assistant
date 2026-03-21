const { validationResult } = require('express-validator');
const feedbackService = require('../services/feedbackService');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * Get feedback for an assessment
 */
const getFeedback = asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;

  const feedback = await feedbackService.getFeedback(assessmentId);

  // Check if user can access this feedback
  if (req.user.role !== 'admin' && feedback.userId._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.json({
    success: true,
    data: {
      feedback: {
        id: feedback._id,
        assessmentId: feedback.assessmentId,
        summary: feedback.summary,
        strengths: feedback.strengths,
        weaknesses: feedback.weaknesses,
        recommendations: feedback.recommendations,
        nextSteps: feedback.nextSteps,
        personalizedTips: feedback.personalizedTips,
        suggestedTopics: feedback.suggestedTopics,
        learningPath: feedback.learningPath,
        cognitiveInsights: feedback.cognitiveInsights,
        feedbackScore: feedback.feedbackScore,
        createdAt: feedback.createdAt
      }
    }
  });
});

/**
 * Get user's feedback history
 */
const getUserFeedbackHistory = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = 10 } = req.query;

  // Check if user can access this data
  if (req.user.role !== 'admin' && userId !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const feedbackHistory = await feedbackService.getUserFeedbackHistory(userId, parseInt(limit));

  res.json({
    success: true,
    data: {
      feedbackHistory: feedbackHistory.map(feedback => ({
        id: feedback._id,
        course: feedback.courseId,
        summary: feedback.summary,
        strengths: feedback.strengths,
        weaknesses: feedback.weaknesses,
        learningPath: feedback.learningPath,
        cognitiveInsights: feedback.cognitiveInsights,
        feedbackScore: feedback.feedbackScore,
        createdAt: feedback.createdAt
      }))
    }
  });
});

/**
 * Update feedback interaction (helpful/not helpful)
 */
const updateFeedbackInteraction = asyncHandler(async (req, res) => {
  const { feedbackId } = req.params;
  const { type } = req.body; // 'helpful' or 'not_helpful'

  if (!type || !['helpful', 'not_helpful'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Interaction type must be "helpful" or "not_helpful"'
    });
  }

  const feedback = await feedbackService.updateFeedbackInteraction(feedbackId, { type });

  res.json({
    success: true,
    message: 'Feedback interaction updated successfully',
    data: {
      feedback: {
        id: feedback._id,
        helpfulCount: feedback.metadata.helpfulCount || 0,
        notHelpfulCount: feedback.metadata.notHelpfulCount || 0
      }
    }
  });
});

/**
 * Get learning recommendations based on feedback
 */
const getLearningRecommendations = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Check if user can access this data
  if (req.user.role !== 'admin' && userId !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Get recent feedback
  const recentFeedback = await feedbackService.getUserFeedbackHistory(userId, 5);

  if (recentFeedback.length === 0) {
    return res.json({
      success: true,
      data: {
        recommendations: [
          'Complete your first assessment to get personalized recommendations',
          'Explore different course topics to find your interests',
          'Start with beginner-level content to build confidence'
        ],
        message: 'No feedback history available yet'
      }
    });
  }

  // Generate recommendations based on recent feedback
  const recommendations = [];
  const allWeaknesses = [];
  const allStrengths = [];

  recentFeedback.forEach(feedback => {
    allWeaknesses.push(...feedback.weaknesses);
    allStrengths.push(...feedback.strengths);
  });

  // Analyze patterns
  const weaknessCounts = {};
  allWeaknesses.forEach(weakness => {
    weaknessCounts[weakness] = (weaknessCounts[weakness] || 0) + 1;
  });

  const strengthCounts = {};
  allStrengths.forEach(strength => {
    strengthCounts[strength] = (strengthCounts[strength] || 0) + 1;
  });

  // Generate recommendations based on patterns
  Object.entries(weaknessCounts).forEach(([weakness, count]) => {
    if (count >= 2) {
      recommendations.push(`Focus on improving: ${weakness}`);
    }
  });

  Object.entries(strengthCounts).forEach(([strength, count]) => {
    if (count >= 2) {
      recommendations.push(`Continue leveraging your strength in: ${strength}`);
    }
  });

  // Add general recommendations
  recommendations.push('Practice regularly to maintain progress');
  recommendations.push('Take breaks between learning sessions');
  recommendations.push('Review previous feedback to track improvement');

  res.json({
    success: true,
    data: {
      recommendations,
      patterns: {
        commonWeaknesses: Object.entries(weaknessCounts)
          .filter(([, count]) => count >= 2)
          .map(([weakness, count]) => ({ weakness, frequency: count })),
        commonStrengths: Object.entries(strengthCounts)
          .filter(([, count]) => count >= 2)
          .map(([strength, count]) => ({ strength, frequency: count }))
      }
    }
  });
});

/**
 * Get cognitive insights for user
 */
const getCognitiveInsights = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Check if user can access this data
  if (req.user.role !== 'admin' && userId !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const cliService = require('../services/cliService');
  const insights = await cliService.getUserInsights(userId);

  res.json({
    success: true,
    data: insights
  });
});

/**
 * Get suggested topics for user
 */
const getSuggestedTopics = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Check if user can access this data
  if (req.user.role !== 'admin' && userId !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Get recent feedback to extract suggested topics
  const recentFeedback = await feedbackService.getUserFeedbackHistory(userId, 3);

  const suggestedTopics = [];
  recentFeedback.forEach(feedback => {
    suggestedTopics.push(...feedback.suggestedTopics);
  });

  // Remove duplicates
  const uniqueTopics = [...new Set(suggestedTopics)];

  res.json({
    success: true,
    data: {
      suggestedTopics: uniqueTopics,
      totalSuggestions: uniqueTopics.length
    }
  });
});

module.exports = {
  getFeedback,
  getUserFeedbackHistory,
  updateFeedbackInteraction,
  getLearningRecommendations,
  getCognitiveInsights,
  getSuggestedTopics
};
