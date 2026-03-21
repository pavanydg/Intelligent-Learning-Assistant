const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  timestamp: {
    type: Number,
    required: true
  },
  avgOnScreen: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  blinkRatePerMin: {
    type: Number,
    min: 0,
    required: true
  },
  headMovement: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  eyeGazeStability: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
});

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  selectedAnswer: {
    type: String,
    required: true
  },
  isCorrect: {
    type: Boolean,
    required: true
  },
  timeSpent: {
    type: Number, // in seconds
    required: true
  },
  confidence: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  }
});

const assessmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: String, // Changed to String to handle YouTube playlist IDs
    required: true
  },
  courseTitle: {
    type: String,
    required: false // Optional, can be fetched from YouTube API if not stored
  },
  videoId: {
    type: String,
    required: true
  },
  videoTitle: {
    type: String,
    required: false // Optional, can be fetched from YouTube API if not stored
  },
  questionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }], // Store which questions were used in this assessment
  answers: [answerSchema],
  metrics: [metricSchema],
  testScore: {
    type: Number,
    min: 0,
    max: 100,
    required: false // Will be set when assessment is completed
  },
  cli: {
    type: Number,
    min: 0,
    max: 100,
    required: false // Will be set when assessment is completed
  },
  cliClassification: {
    type: String,
    enum: ['Low Load', 'Moderate Load', 'High Load'],
    required: false // Will be set when assessment is completed
  },
  confidence: {
    type: Number,
    min: 1,
    max: 5,
    required: false // Will be set when assessment is completed
  },
  timeSpent: {
    type: Number, // total time in seconds
    required: false // Will be set when assessment is completed
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'in-progress'
  },
  feedback: {
    summary: String,
    strengths: [String],
    weaknesses: [String],
    recommendations: [String],
    nextSteps: [String]
  },
  metadata: {
    deviceInfo: {
      userAgent: String,
      screenResolution: String,
      browser: String
    },
    sessionInfo: {
      startTime: Date,
      endTime: Date,
      totalFocusTime: Number,
      distractions: Number
    }
  },
  proctoring: {
    integrityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    flags: [{
      type: String
    }],
    metrics: {
      offScreenTime: Number, // Total seconds off-screen
      noFaceFrames: Number, // Number of frames without face detected
      gazeDeviation: Number, // Average gaze deviation from center
      avgKeyDelay: Number, // Average delay between keystrokes (ms)
      pasteEvents: Number, // Number of paste events detected
      backspaceRate: Number, // Backspace key presses per minute
      tabSwitches: Number, // Number of tab/window switches
      copyEvents: Number // Number of copy events detected
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
assessmentSchema.index({ userId: 1, courseId: 1 });
assessmentSchema.index({ status: 1, createdAt: -1 });
assessmentSchema.index({ cli: 1, testScore: 1 });

// Calculate average metrics
assessmentSchema.virtual('avgMetrics').get(function() {
  if (this.metrics.length === 0) return null;
  
  const totals = this.metrics.reduce((acc, metric) => ({
    avgOnScreen: acc.avgOnScreen + metric.avgOnScreen,
    blinkRate: acc.blinkRate + metric.blinkRatePerMin,
    headMovement: acc.headMovement + metric.headMovement,
    eyeGazeStability: acc.eyeGazeStability + metric.eyeGazeStability
  }), { avgOnScreen: 0, blinkRate: 0, headMovement: 0, eyeGazeStability: 0 });

  const count = this.metrics.length;
  return {
    avgOnScreen: totals.avgOnScreen / count,
    avgBlinkRate: totals.blinkRate / count,
    avgHeadMovement: totals.headMovement / count,
    avgEyeGazeStability: totals.eyeGazeStability / count
  };
});

// Ensure virtual fields are serialized
assessmentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Assessment', assessmentSchema);
