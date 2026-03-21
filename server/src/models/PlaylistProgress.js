const mongoose = require('mongoose');

const videoProgressSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true
  },
  videoTitle: {
    type: String,
    required: true
  },
  videoThumbnail: {
    type: String,
    default: ''
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  watchTime: {
    type: Number, // in seconds
    default: 0
  },
  totalDuration: {
    type: Number, // in seconds
    default: 0
  },
  lastPosition: {
    type: Number, // Last watched position in seconds
    default: 0
  },
  completionPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  attempts: [{
    attemptNumber: {
      type: Number,
      required: true
    },
    testScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    cli: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    cliClassification: {
      type: String,
      enum: ['Low Load', 'Moderate Load', 'High Load'],
      required: true
    },
    confidence: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    timeSpent: {
      type: Number, // in seconds
      required: true
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true
    }
  }],
  bestScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  averageScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  totalAttempts: {
    type: Number,
    default: 0
  }
});

const playlistProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  playlistId: {
    type: String,
    required: true
  },
  playlistTitle: {
    type: String,
    required: true
  },
  playlistThumbnail: {
    type: String,
    default: ''
  },
  videos: [videoProgressSchema],
  overallProgress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  completedVideos: {
    type: Number,
    default: 0
  },
  totalVideos: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  totalTimeSpent: {
    type: Number, // in seconds
    default: 0
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
playlistProgressSchema.index({ userId: 1, playlistId: 1 });
playlistProgressSchema.index({ userId: 1, lastAccessed: -1 });
playlistProgressSchema.index({ 'videos.videoId': 1 });

// Calculate overall progress
playlistProgressSchema.methods.calculateOverallProgress = function() {
  if (this.videos.length === 0) {
    this.overallProgress = 0;
    return;
  }

  const totalVideos = this.videos.length;
  const completedVideos = this.videos.filter(video => video.isCompleted).length;
  
  this.completedVideos = completedVideos;
  this.totalVideos = totalVideos;
  this.overallProgress = Math.round((completedVideos / totalVideos) * 100);
  
  // Calculate average score
  const allScores = this.videos
    .filter(video => video.attempts.length > 0)
    .map(video => video.averageScore)
    .filter(score => score > 0);
  
  this.averageScore = allScores.length > 0 
    ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length)
    : 0;
  
  // Check if playlist is completed
  const wasCompleted = this.isCompleted;
  this.isCompleted = completedVideos === totalVideos;
  if (this.isCompleted && !this.completedAt) {
    this.completedAt = new Date();
    
    // Auto-generate certificate if playlist just got completed
    if (!wasCompleted) {
      this.triggerCertificateGeneration();
    }
  }
};

// Update video progress
playlistProgressSchema.methods.updateVideoProgress = function(videoId, progressData) {
  const video = this.videos.find(v => v.videoId === videoId);
  
  if (!video) {
    // Add new video to progress
    this.videos.push({
      videoId,
      videoTitle: progressData.videoTitle || '',
      videoThumbnail: progressData.videoThumbnail || '',
      isCompleted: progressData.isCompleted || false,
      watchTime: progressData.watchTime || 0,
      totalDuration: progressData.totalDuration || 0,
      completionPercentage: progressData.completionPercentage || 0,
      attempts: [],
      bestScore: 0,
      averageScore: 0,
      totalAttempts: 0
    });
  } else {
    // Update existing video
    if (progressData.isCompleted !== undefined) {
      video.isCompleted = progressData.isCompleted;
    }
    if (progressData.watchTime !== undefined) {
      video.watchTime = progressData.watchTime;
    }
    if (progressData.completionPercentage !== undefined) {
      video.completionPercentage = progressData.completionPercentage;
    }
    if (progressData.lastPosition !== undefined) {
      video.lastPosition = progressData.lastPosition;
    }
  }
  
  // Update last synced timestamp
  this.lastSyncedAt = new Date();
  
  // Recalculate overall progress
  this.calculateOverallProgress();
};

// Add assessment attempt
playlistProgressSchema.methods.addAssessmentAttempt = function(videoId, attemptData) {
  let video = this.videos.find(v => v.videoId === videoId);
  
  // Create video entry if it doesn't exist
  if (!video) {
    video = {
      videoId,
      videoTitle: attemptData.videoTitle || 'Unknown Video',
      videoThumbnail: attemptData.videoThumbnail || '',
      isCompleted: false,
      watchTime: 0,
      totalDuration: 0,
      lastPosition: 0,
      completionPercentage: 0,
      attempts: [],
      bestScore: 0,
      averageScore: 0,
      totalAttempts: 0
    };
    this.videos.push(video);
  }
  
  // Add new attempt
  const attemptNumber = video.attempts.length + 1;
  video.attempts.push({
    attemptNumber,
    testScore: attemptData.testScore,
    cli: attemptData.cli,
    cliClassification: attemptData.cliClassification,
    confidence: attemptData.confidence,
    timeSpent: attemptData.timeSpent,
    completedAt: new Date(),
    assessmentId: attemptData.assessmentId
  });
  
  // Update video statistics
  video.totalAttempts = video.attempts.length;
  video.bestScore = Math.max(...video.attempts.map(a => a.testScore));
  
  const totalScore = video.attempts.reduce((sum, attempt) => sum + attempt.testScore, 0);
  video.averageScore = Math.round(totalScore / video.attempts.length);
  
  // Mark as completed if score is good enough
  if (attemptData.testScore >= 70) {
    video.isCompleted = true;
  }
  
  // Recalculate overall progress
  this.calculateOverallProgress();
};

// Trigger certificate generation when playlist is completed
playlistProgressSchema.methods.triggerCertificateGeneration = async function() {
  try {
    const certificateService = require('../services/certificateService');
    const User = require('./User');
    
    // Get user details
    const user = await User.findById(this.userId);
    if (!user) {
      console.log('User not found for certificate generation');
      return;
    }
    
    // Check if certificate already exists
    const Certificate = require('./Certificate');
    const existingCert = await Certificate.findOne({
      userId: this.userId,
      playlistId: this.playlistId
    });
    
    if (existingCert) {
      console.log('Certificate already exists for this playlist');
      return;
    }
    
    // Generate certificate
    console.log(`🎓 Auto-generating certificate for completed playlist: ${this.playlistTitle}`);
    const result = await certificateService.issueCertificate(user, this.playlistId);
    
    if (result.success) {
      console.log(`✅ Certificate generated successfully: ${result.certificate.certificateNumber}`);
    } else {
      console.log(`❌ Certificate generation failed: ${result.reason}`);
    }
  } catch (error) {
    console.error('Error auto-generating certificate:', error);
  }
};

module.exports = mongoose.model('PlaylistProgress', playlistProgressSchema);
