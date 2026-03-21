const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer'],
    default: 'multiple-choice'
  },
  options: [{
    text: String,
    isCorrect: Boolean
  }],
  correctAnswer: {
    type: String, // For short-answer or true-false
    required: false
  },
  points: {
    type: Number,
    default: 1
  },
  explanation: {
    type: String,
    default: ''
  }
});

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questions: [questionSchema],
  totalPoints: {
    type: Number,
    default: 0
  },
  timeLimit: {
    type: Number, // in minutes, 0 means no time limit
    default: 0
  },
  passingScore: {
    type: Number, // percentage
    default: 60
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDraft: {
    type: Boolean,
    default: false
  },
  allowMultipleAttempts: {
    type: Boolean,
    default: false
  },
  showResults: {
    type: Boolean,
    default: true // Whether to show results immediately after submission
  },
  scheduledStartTime: {
    type: Date,
    default: null // Optional: when the quiz should become available
  },
  scheduledEndTime: {
    type: Date,
    default: null // Optional: when the quiz should stop being available
  },
  metadata: {
    category: String,
    tags: [String],
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    }
  }
}, {
  timestamps: true
});

// Calculate total points before saving
quizSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.totalPoints = this.questions.reduce((sum, q) => sum + (q.points || 1), 0);
  }
  next();
});

// Indexes
quizSchema.index({ teacherId: 1 });
quizSchema.index({ isActive: 1 });
quizSchema.index({ 'metadata.tags': 1 });

module.exports = mongoose.model('Quiz', quizSchema);

