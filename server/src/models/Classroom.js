const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Classroom name is required'],
    trim: true,
    maxlength: [100, 'Classroom name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  joinCode: {
    type: String,
    required: false, // Will be auto-generated in pre-save hook
    unique: true,
    uppercase: true,
    trim: true
  },
  students: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    name: String,
    email: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    allowStudentJoin: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    maxStudents: {
      type: Number,
      default: null // null means unlimited
    }
  },
  metadata: {
    subject: String,
    semester: String,
    academicYear: String
  },
  linkedCourses: [{
    courseId: {
      type: String, // YouTube playlist ID
      required: true
    },
    courseKey: {
      type: String, // Course access key
      required: true
    },
    courseTitle: String,
    courseThumbnail: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  linkedQuizzes: [{
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true
    },
    quizKey: {
      type: String, // Quiz access key
      required: true
    },
    quizTitle: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for performance
// Note: 'joinCode' index is automatically created by unique: true in field definition
classroomSchema.index({ teacherId: 1 });
classroomSchema.index({ 'students.studentId': 1 });

// Generate unique join code before saving
classroomSchema.pre('save', async function(next) {
  // Only generate if this is a new document and joinCode is not already set
  if (!this.isNew || this.joinCode) {
    return next();
  }
  
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars (0, O, I, 1)
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };
  
  let code = generateCode();
  let exists = await this.constructor.findOne({ joinCode: code });
  
  // Regenerate if code exists (unlikely but possible)
  let attempts = 0;
  while (exists && attempts < 10) {
    code = generateCode();
    exists = await this.constructor.findOne({ joinCode: code });
    attempts++;
  }
  
  if (exists) {
    return next(new Error('Failed to generate unique join code. Please try again.'));
  }
  
  // Set the join code
  this.joinCode = code;
  next();
});

module.exports = mongoose.model('Classroom', classroomSchema);

