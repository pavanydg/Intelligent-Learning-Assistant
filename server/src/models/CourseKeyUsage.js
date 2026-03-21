const mongoose = require('mongoose');

const courseKeyUsageSchema = new mongoose.Schema({
  courseKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseKey',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: String, // YouTube playlist ID
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
courseKeyUsageSchema.index({ courseKeyId: 1, userId: 1 }, { unique: true });
courseKeyUsageSchema.index({ courseKeyId: 1 });
courseKeyUsageSchema.index({ userId: 1 });
courseKeyUsageSchema.index({ courseId: 1 });

module.exports = mongoose.model('CourseKeyUsage', courseKeyUsageSchema);

