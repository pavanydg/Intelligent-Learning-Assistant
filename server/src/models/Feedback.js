const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  assessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: String, // Changed to String to handle YouTube playlist IDs
    required: true
  },
  summary: {
    type: String,
    required: true,
    trim: true
  },
  strengths: [{
    type: String,
    trim: true
  }],
  weaknesses: [{
    type: String,
    trim: true
  }],
  recommendations: [{
    type: String,
    trim: true
  }],
  nextSteps: [{
    type: String,
    trim: true
  }],
  personalizedTips: [{
    type: String,
    trim: true
  }],
  suggestedTopics: [{
    type: String,
    trim: true
  }],
  suggestedPlaylists: [{
    playlistId: String,
    title: String,
    reason: String
  }],
  learningPath: {
    currentLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true
    },
    recommendedLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true
    },
    progressPercentage: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    }
  },
  cognitiveInsights: {
    attentionSpan: {
      type: String,
      enum: ['excellent', 'good', 'needs-improvement'],
      required: true
    },
    focusAreas: [String],
    distractionFactors: [String],
    optimalLearningTime: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night'],
      default: 'morning'
    }
  },
  metadata: {
    generatedBy: {
      type: String,
      enum: ['gemini', 'template', 'manual'],
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },
    version: {
      type: String,
      default: '1.0'
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
feedbackSchema.index({ userId: 1, courseId: 1 });
feedbackSchema.index({ assessmentId: 1 }, { unique: true });
feedbackSchema.index({ 'learningPath.currentLevel': 1 });

// Calculate overall feedback score
feedbackSchema.virtual('feedbackScore').get(function() {
  const strengthCount = this.strengths.length;
  const weaknessCount = this.weaknesses.length;
  const recommendationCount = this.recommendations.length;
  
  // Simple scoring based on comprehensiveness
  const baseScore = Math.min(100, (strengthCount + recommendationCount) * 10);
  const penalty = weaknessCount * 5;
  
  return Math.max(0, baseScore - penalty);
});

// Ensure virtual fields are serialized
feedbackSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
