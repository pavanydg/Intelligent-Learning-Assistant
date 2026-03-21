const mongoose = require('mongoose');

const quizKeyUsageSchema = new mongoose.Schema({
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
  quizId: {
    type: String, // Quiz ID as string
    required: true
  },
  firstAccessedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  accessCount: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes for performance
quizKeyUsageSchema.index({ quizKeyId: 1, userId: 1 }, { unique: true });
quizKeyUsageSchema.index({ quizKeyId: 1 });
quizKeyUsageSchema.index({ userId: 1 });
quizKeyUsageSchema.index({ quizId: 1 });

module.exports = mongoose.model('QuizKeyUsage', quizKeyUsageSchema);

