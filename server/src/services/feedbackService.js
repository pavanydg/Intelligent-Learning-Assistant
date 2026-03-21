const Feedback = require('../models/Feedback');
const geminiService = require('./geminiService');
const cliService = require('./cliService');

class FeedbackService {
  /**
   * Generate feedback for an assessment
   * @param {string} assessmentId - Assessment ID
   * @param {Object} assessmentData - Assessment data
   * @returns {Promise<Object>} Generated feedback
   */
  async generateAssessmentFeedback(assessmentId, assessmentData) {
    try {
      // Check if feedback already exists
      const existingFeedback = await Feedback.findOne({ assessmentId });
      if (existingFeedback) {
        return existingFeedback;
      }

      // Prepare data for feedback generation
      const feedbackData = {
        testScore: assessmentData.testScore,
        cli: assessmentData.cli,
        cliClassification: assessmentData.cliClassification,
        confidence: assessmentData.confidence,
        answers: assessmentData.answers,
        metrics: assessmentData.avgMetrics,
        topic: assessmentData.topic || 'General'
      };

      // Generate feedback using Gemini or fallback
      let feedbackContent;
      try {
        feedbackContent = await geminiService.generateFeedback(feedbackData);
      } catch (error) {
        console.error('Gemini feedback generation failed:', error.message);
        console.log('Using fallback feedback generation');
        feedbackContent = geminiService.generateFallbackFeedback(feedbackData);
      }

      // Create feedback record
      const feedback = new Feedback({
        assessmentId,
        userId: assessmentData.userId,
        courseId: assessmentData.courseId,
        summary: feedbackContent.summary,
        strengths: feedbackContent.strengths || [],
        weaknesses: feedbackContent.weaknesses || [],
        recommendations: feedbackContent.recommendations || [],
        nextSteps: feedbackContent.nextSteps || [],
        personalizedTips: feedbackContent.personalizedTips || [],
        suggestedTopics: feedbackContent.suggestedTopics || [],
        learningPath: {
          currentLevel: this.determineCurrentLevel(assessmentData.testScore, assessmentData.cli),
          recommendedLevel: this.determineRecommendedLevel(assessmentData.testScore, assessmentData.cli),
          progressPercentage: this.calculateProgressPercentage(assessmentData.testScore, assessmentData.cli)
        },
        cognitiveInsights: {
          attentionSpan: this.assessAttentionSpan(assessmentData.metrics),
          focusAreas: this.identifyFocusAreas(assessmentData.answers),
          distractionFactors: this.identifyDistractionFactors(assessmentData.metrics),
          optimalLearningTime: this.suggestOptimalLearningTime(assessmentData.metrics)
        },
        metadata: {
          generatedBy: process.env.GEMINI_API_KEY ? 'gemini' : 'template',
          confidence: 0.8,
          version: '1.0'
        }
      });

      await feedback.save();
      return feedback;

    } catch (error) {
      console.error('Feedback generation error:', error.message);
      throw new Error('Failed to generate feedback');
    }
  }

  /**
   * Get feedback for an assessment
   * @param {string} assessmentId - Assessment ID
   * @returns {Promise<Object>} Feedback data
   */
  async getFeedback(assessmentId) {
    try {
      const feedback = await Feedback.findOne({ assessmentId })
        .populate('userId', 'name email')
        .populate('courseId', 'title');

      if (!feedback) {
        throw new Error('Feedback not found');
      }

      return feedback;

    } catch (error) {
      console.error('Get feedback error:', error.message);
      throw new Error('Failed to retrieve feedback');
    }
  }

  /**
   * Get user's feedback history
   * @param {string} userId - User ID
   * @param {number} limit - Number of feedback records to return
   * @returns {Promise<Array>} Feedback history
   */
  async getUserFeedbackHistory(userId, limit = 10) {
    try {
      return await Feedback.find({ userId })
        .populate('courseId', 'title thumbnail')
        .sort({ createdAt: -1 })
        .limit(limit);

    } catch (error) {
      console.error('Get feedback history error:', error.message);
      return [];
    }
  }

  /**
   * Determine current learning level
   * @param {number} testScore - Test score
   * @param {number} cli - Cognitive Load Index
   * @returns {string} Current level
   */
  determineCurrentLevel(testScore, cli) {
    if (testScore >= 80 && cli <= 40) return 'advanced';
    if (testScore >= 60 && cli <= 60) return 'intermediate';
    return 'beginner';
  }

  /**
   * Determine recommended learning level
   * @param {number} testScore - Test score
   * @param {number} cli - Cognitive Load Index
   * @returns {string} Recommended level
   */
  determineRecommendedLevel(testScore, cli) {
    if (testScore >= 90 && cli <= 30) return 'advanced';
    if (testScore >= 70 && cli <= 50) return 'intermediate';
    if (testScore < 50 || cli > 70) return 'beginner';
    return 'intermediate';
  }

  /**
   * Calculate progress percentage
   * @param {number} testScore - Test score
   * @param {number} cli - Cognitive Load Index
   * @returns {number} Progress percentage
   */
  calculateProgressPercentage(testScore, cli) {
    // Weighted combination of score and cognitive load
    const scoreWeight = 0.7;
    const cliWeight = 0.3;
    
    const normalizedCLI = Math.max(0, 100 - cli); // Invert CLI (lower is better)
    const progress = (testScore * scoreWeight + normalizedCLI * cliWeight);
    
    return Math.min(100, Math.max(0, Math.round(progress)));
  }

  /**
   * Assess attention span based on metrics
   * @param {Object} metrics - Cognitive metrics
   * @returns {string} Attention span assessment
   */
  assessAttentionSpan(metrics) {
    if (!metrics) return 'needs-improvement';
    
    const { avgOnScreen, eyeGazeStability } = metrics;
    const avgFocus = (avgOnScreen + eyeGazeStability) / 2;
    
    if (avgFocus >= 85) return 'excellent';
    if (avgFocus >= 70) return 'good';
    return 'needs-improvement';
  }

  /**
   * Identify focus areas from answers
   * @param {Array} answers - User answers
   * @returns {Array} Focus areas
   */
  identifyFocusAreas(answers) {
    const focusAreas = [];
    
    if (!answers || answers.length === 0) return focusAreas;
    
    const incorrectAnswers = answers.filter(a => !a.isCorrect);
    const lowConfidenceAnswers = answers.filter(a => a.confidence <= 2);
    
    if (incorrectAnswers.length > answers.length * 0.3) {
      focusAreas.push('Conceptual understanding');
    }
    
    if (lowConfidenceAnswers.length > answers.length * 0.4) {
      focusAreas.push('Confidence building');
    }
    
    return focusAreas;
  }

  /**
   * Identify distraction factors
   * @param {Object} metrics - Cognitive metrics
   * @returns {Array} Distraction factors
   */
  identifyDistractionFactors(metrics) {
    const factors = [];
    
    if (!metrics) return factors;
    
    if (metrics.avgOnScreen < 70) {
      factors.push('Screen attention');
    }
    
    if (metrics.headMovement > 30) {
      factors.push('Head movement');
    }
    
    if (metrics.blinkRatePerMin > 25) {
      factors.push('Eye strain');
    }
    
    return factors;
  }

  /**
   * Suggest optimal learning time
   * @param {Object} metrics - Cognitive metrics
   * @returns {string} Optimal learning time
   */
  suggestOptimalLearningTime(metrics) {
    // This would typically be based on user's historical performance
    // For now, return a default suggestion
    return 'morning';
  }

  /**
   * Generate learning recommendations based on feedback
   * @param {Object} feedback - Feedback object
   * @returns {Array} Learning recommendations
   */
  generateLearningRecommendations(feedback) {
    const recommendations = [];
    
    // Based on weaknesses
    if (feedback.weaknesses && feedback.weaknesses.length > 0) {
      recommendations.push('Focus on identified weak areas');
    }
    
    // Based on cognitive load
    if (feedback.cognitiveInsights.attentionSpan === 'needs-improvement') {
      recommendations.push('Practice attention and focus exercises');
    }
    
    // Based on learning path
    if (feedback.learningPath.progressPercentage < 50) {
      recommendations.push('Review foundational concepts');
    }
    
    return recommendations;
  }

  /**
   * Update feedback with user interaction
   * @param {string} feedbackId - Feedback ID
   * @param {Object} interaction - User interaction data
   * @returns {Promise<Object>} Updated feedback
   */
  async updateFeedbackInteraction(feedbackId, interaction) {
    try {
      const feedback = await Feedback.findById(feedbackId);
      if (!feedback) {
        throw new Error('Feedback not found');
      }

      // Update based on interaction type
      if (interaction.type === 'helpful') {
        feedback.metadata.helpfulCount = (feedback.metadata.helpfulCount || 0) + 1;
      } else if (interaction.type === 'not_helpful') {
        feedback.metadata.notHelpfulCount = (feedback.metadata.notHelpfulCount || 0) + 1;
      }

      await feedback.save();
      return feedback;

    } catch (error) {
      console.error('Update feedback interaction error:', error.message);
      throw new Error('Failed to update feedback interaction');
    }
  }
}

module.exports = new FeedbackService();
