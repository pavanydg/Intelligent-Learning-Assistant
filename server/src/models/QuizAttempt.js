const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  answer: {
    type: mongoose.Schema.Types.Mixed, // Can be string, array, etc.
    required: true
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  pointsEarned: {
    type: Number,
    default: 0
  },
  pointsPossible: {
    type: Number,
    default: 0
  }
});

const quizAttemptSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  quizKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuizKey',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: [answerSchema],
  score: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  pointsEarned: {
    type: Number,
    default: 0
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'in-progress'
  },
  passed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
quizAttemptSchema.index({ quizId: 1, userId: 1 });
quizAttemptSchema.index({ quizKeyId: 1 });
quizAttemptSchema.index({ userId: 1 });
quizAttemptSchema.index({ status: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);

