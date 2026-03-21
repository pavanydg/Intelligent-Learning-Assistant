const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Announcement content is required'],
    trim: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  metadata: {
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    tags: [String]
  }
}, {
  timestamps: true
});

// Indexes for performance
announcementSchema.index({ classroomId: 1, createdAt: -1 });
announcementSchema.index({ classroomId: 1, isPinned: -1, createdAt: -1 });
announcementSchema.index({ authorId: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);

