const mongoose = require('mongoose');

const classroomDocumentSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  fileName: {
    type: String,
    required: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true // e.g., 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  fileSize: {
    type: Number,
    required: true // in bytes
  },
  filePath: {
    type: String,
    required: true // Path where file is stored
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedByName: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  metadata: {
    tags: [String],
    category: String
  }
}, {
  timestamps: true
});

// Indexes for performance
classroomDocumentSchema.index({ classroomId: 1, createdAt: -1 });
classroomDocumentSchema.index({ uploadedBy: 1 });
classroomDocumentSchema.index({ isActive: 1 });

module.exports = mongoose.model('ClassroomDocument', classroomDocumentSchema);

