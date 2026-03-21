const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  courseId: {
    type: String, // Changed to String to handle YouTube playlist IDs
    required: true
  },
  videoId: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  options: [{
    type: String,
    required: true,
    trim: true
  }],
  correctAnswer: {
    type: String,
    required: true,
    trim: true
  },
  explanation: {
    type: String,
    default: ''
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'intermediate'],
    default: 'medium'
  },
  topic: {
    type: String,
    default: ''
  },
  timeStamp: {
    type: Number, // Video timestamp in seconds
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    generatedBy: {
      type: String,
      enum: ['gemini', 'template', 'manual', 'fallback'],
      default: 'gemini'
    },
    type: {
      type: String,
      enum: ['mcq', 'descriptive', 'coding', 'predict-output', 'general'],
      default: 'mcq'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },
    attempts: {
      type: Number,
      default: 0
    },
    correctAttempts: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
questionSchema.index({ courseId: 1, videoId: 1 });
questionSchema.index({ isActive: 1, difficulty: 1 });
questionSchema.index({ topic: 1 });
questionSchema.index({ 'metadata.type': 1 }); // Index for filtering by question type

// Calculate success rate
questionSchema.virtual('successRate').get(function() {
  if (this.metadata.attempts === 0) return 0;
  return (this.metadata.correctAttempts / this.metadata.attempts) * 100;
});

// Ensure virtual fields are serialized
questionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Question', questionSchema);
