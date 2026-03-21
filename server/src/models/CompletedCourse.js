const mongoose = require('mongoose');

const completedCourseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  playlistId: {
    type: String,
    required: true,
  },
  courseTitle: {
    type: String,
    required: true,
  },
  courseDescription: {
    type: String,
    default: '',
  },
  courseThumbnail: {
    type: String,
    default: '',
  },
  channelTitle: {
    type: String,
    default: '',
  },
  totalVideos: {
    type: Number,
    required: true,
  },
  completedVideos: {
    type: Number,
    required: true,
  },
  completionPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  averageTestScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  totalWatchTime: {
    type: Number, // in seconds
    default: 0,
  },
  totalDuration: {
    type: Number, // in seconds
    default: 0,
  },
  startedAt: {
    type: Date,
    required: true,
  },
  completedAt: {
    type: Date,
    required: true,
  },
  certificateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate',
    default: null,
  },
  certificateNumber: {
    type: String,
    default: null,
  },
  certificateIssuedAt: {
    type: Date,
    default: null,
  },
  metadata: {
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    category: {
      type: String,
      default: 'general',
    },
    tags: [String],
    totalAttempts: {
      type: Number,
      default: 0,
    },
    bestScore: {
      type: Number,
      default: 0,
    },
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
completedCourseSchema.index({ userId: 1, playlistId: 1 }, { unique: true });
completedCourseSchema.index({ userId: 1, completedAt: -1 });
completedCourseSchema.index({ certificateId: 1 });

module.exports = mongoose.model('CompletedCourse', completedCourseSchema);


