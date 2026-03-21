const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  thumbnail: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    default: '0:00'
  },
  description: {
    type: String,
    default: ''
  },
  transcript: {
    type: String,
    default: ''
  },
  hasTranscript: {
    type: Boolean,
    default: false
  }
});

const courseSchema = new mongoose.Schema({
  playlistId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  thumbnail: {
    type: String,
    required: true
  },
  channelTitle: {
    type: String,
    default: ''
  },
  videos: [videoSchema],
  tags: [{
    type: String,
    trim: true
  }],
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  category: {
    type: String,
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    totalVideos: {
      type: Number,
      default: 0
    },
    totalDuration: {
      type: String,
      default: '0:00'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
courseSchema.index({ playlistId: 1 }, { unique: true });
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });
courseSchema.index({ category: 1, difficulty: 1 });
courseSchema.index({ isActive: 1 });

// Update metadata when videos change
courseSchema.pre('save', function(next) {
  if (this.isModified('videos')) {
    this.metadata.totalVideos = this.videos.length;
    this.metadata.lastUpdated = new Date();
  }
  next();
});

module.exports = mongoose.model('Course', courseSchema);
