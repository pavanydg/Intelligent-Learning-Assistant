const mongoose = require('mongoose');

const UserProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  courseId: {
    type: String, // YouTube playlist ID
    required: true,
  },
  courseTitle: {
    type: String,
    required: true,
  },
  completedVideos: [{
    videoId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    watchTime: {
      type: Number, // in seconds
      default: 0,
    },
  }],
  totalVideos: {
    type: Number,
    required: true,
  },
  completionPercentage: {
    type: Number,
    default: 0,
  },
  testScores: [{
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
    },
    score: {
      type: Number,
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Number,
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  averageTestScore: {
    type: Number,
    default: 0,
  },
  lastWatchedVideo: {
    videoId: String,
    title: String,
    watchedAt: Date,
  },
  totalWatchTime: {
    type: Number, // in seconds
    default: 0,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Index for efficient queries
UserProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });
UserProgressSchema.index({ userId: 1, lastUpdated: -1 });

// Method to calculate completion percentage
UserProgressSchema.methods.calculateCompletionPercentage = function() {
  if (this.totalVideos === 0) return 0;
  return Math.round((this.completedVideos.length / this.totalVideos) * 100);
};

// Method to calculate average test score
UserProgressSchema.methods.calculateAverageTestScore = function() {
  if (this.testScores.length === 0) return 0;
  const totalScore = this.testScores.reduce((sum, test) => sum + test.percentage, 0);
  return Math.round(totalScore / this.testScores.length);
};

// Method to update progress
UserProgressSchema.methods.updateProgress = function(videoId, videoTitle, watchTime = 0) {
  // Check if video is already completed
  const existingVideo = this.completedVideos.find(v => v.videoId === videoId);
  
  if (!existingVideo) {
    this.completedVideos.push({
      videoId,
      title: videoTitle,
      completedAt: new Date(),
      watchTime,
    });
    
    // Update completion percentage
    this.completionPercentage = this.calculateCompletionPercentage();
    
    // Update last watched video
    this.lastWatchedVideo = {
      videoId,
      title: videoTitle,
      watchedAt: new Date(),
    };
    
    // Update total watch time
    this.totalWatchTime += watchTime;
  }
  
  this.lastUpdated = new Date();
  return this.save();
};

// Method to add test score
UserProgressSchema.methods.addTestScore = function(assessmentId, score, totalQuestions) {
  const percentage = Math.round((score / totalQuestions) * 100);
  
  this.testScores.push({
    assessmentId,
    score,
    totalQuestions,
    percentage,
    completedAt: new Date(),
  });
  
  // Update average test score
  this.averageTestScore = this.calculateAverageTestScore();
  this.lastUpdated = new Date();
  
  return this.save();
};

module.exports = mongoose.model('UserProgress', UserProgressSchema);
