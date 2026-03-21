const mongoose = require('mongoose');

const quizKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null // null means never expires
  },
  usageCount: {
    type: Number,
    default: 0 // Number of students who have accessed this quiz using the key
  },
  maxAttempts: {
    type: Number,
    default: null // null means unlimited attempts
  },
  metadata: {
    createdBy: String, // Teacher name
    maxStudents: {
      type: Number,
      default: null // null means unlimited
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
// Note: 'key' index is automatically created by unique: true in field definition
quizKeySchema.index({ quizId: 1 });
quizKeySchema.index({ teacherId: 1 });
quizKeySchema.index({ isActive: 1, expiresAt: 1 });

// Generate a unique key
quizKeySchema.statics.generateUniqueKey = async function() {
  const generateKey = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
    let key = '';
    for (let i = 0; i < 8; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  let key = generateKey();
  let attempts = 0;
  const maxAttempts = 10;

  // Ensure key is unique
  while (attempts < maxAttempts) {
    const existing = await this.findOne({ key });
    if (!existing) {
      return key;
    }
    key = generateKey();
    attempts++;
  }

  throw new Error('Failed to generate unique quiz key');
};

module.exports = mongoose.model('QuizKey', quizKeySchema);

