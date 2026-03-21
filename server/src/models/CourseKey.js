const mongoose = require('mongoose');

const courseKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: String, // YouTube playlist ID
    required: true
  },
  courseTitle: {
    type: String,
    required: true
  },
  courseThumbnail: {
    type: String,
    default: ''
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
    default: 0 // Number of students who have accessed this course using the key
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
courseKeySchema.index({ teacherId: 1 });
courseKeySchema.index({ courseId: 1 });
courseKeySchema.index({ isActive: 1, expiresAt: 1 });

// Generate a unique key
courseKeySchema.statics.generateUniqueKey = async function() {
  const generateKey = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0, O, I, 1
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

  throw new Error('Failed to generate unique course key');
};

module.exports = mongoose.model('CourseKey', courseKeySchema);

