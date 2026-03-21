const mongoose = require('mongoose');

const notesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  videoDuration: {
    type: Number, // in seconds
    default: 0
  },
  transcript: {
    type: String,
    required: true
  },
  transcriptLanguage: {
    type: String,
    default: 'en'
  },
  shortNotes: {
    type: String,
    required: true
  },
  detailedNotes: {
    type: String,
    required: true
  },
  keyPoints: [{
    point: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['concept', 'example', 'formula', 'definition', 'tip', 'warning'],
      default: 'concept'
    },
    importance: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    }
  }],
  examples: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['practical', 'theoretical', 'code', 'diagram', 'case-study'],
      default: 'practical'
    }
  }],
  illustrations: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['diagram', 'flowchart', 'timeline', 'comparison', 'hierarchy'],
      default: 'diagram'
    }
  }],
  links: [{
    title: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      enum: ['reference', 'tutorial', 'documentation', 'article', 'video'],
      default: 'reference'
    }
  }],
  topics: [{
    type: String
  }],
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'intermediate'
  },
  estimatedReadTime: {
    shortNotes: {
      type: Number, // in minutes
      default: 5
    },
    detailedNotes: {
      type: Number, // in minutes
      default: 15
    }
  },
  metadata: {
    generatedBy: {
      type: String,
      enum: ['gemini', 'fallback'],
      default: 'gemini'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.9
    },
    generationTime: {
      type: Number, // in seconds
      default: 0
    },
    wordCount: {
      shortNotes: {
        type: Number,
        default: 0
      },
      detailedNotes: {
        type: Number,
        default: 0
      }
    }
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloaded: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
notesSchema.index({ userId: 1, videoId: 1 });
notesSchema.index({ userId: 1, createdAt: -1 });
notesSchema.index({ videoId: 1 });
notesSchema.index({ topics: 1 });
notesSchema.index({ difficulty: 1 });

// Virtual for total word count
notesSchema.virtual('totalWordCount').get(function() {
  return this.metadata.wordCount.shortNotes + this.metadata.wordCount.detailedNotes;
});

// Method to increment download count
notesSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  this.lastDownloaded = new Date();
  return this.save();
};

// Method to get formatted notes for PDF
notesSchema.methods.getFormattedNotes = function() {
  return {
    videoTitle: this.videoTitle,
    videoDuration: this.videoDuration,
    shortNotes: this.shortNotes,
    detailedNotes: this.detailedNotes,
    keyPoints: this.keyPoints,
    examples: this.examples,
    illustrations: this.illustrations,
    links: this.links,
    topics: this.topics,
    difficulty: this.difficulty,
    estimatedReadTime: this.estimatedReadTime,
    createdAt: this.createdAt,
    totalWordCount: this.totalWordCount
  };
};

module.exports = mongoose.model('Notes', notesSchema);
