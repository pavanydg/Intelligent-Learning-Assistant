const { asyncHandler } = require('../middlewares/errorHandler');
const ClassroomDocument = require('../models/ClassroomDocument');
const Classroom = require('../models/Classroom');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/classroom-documents');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf', // PDF
    'application/msword', // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.ms-excel', // XLS
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
    'application/vnd.ms-powerpoint', // PPT
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
    'text/plain', // TXT
    'text/markdown', // MD
    'image/jpeg', // JPG
    'image/png', // PNG
    'image/gif' // GIF
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, MD, JPG, PNG, GIF`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: fileFilter
});

/**
 * Upload a document to a classroom
 */
const uploadDocument = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  const { title, description, tags, category } = req.body;
  const userId = req.user._id || req.user.id;
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  if (!title || !title.trim()) {
    // Delete uploaded file if title is missing
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
    return res.status(400).json({
      success: false,
      message: 'Document title is required'
    });
  }

  // Verify classroom exists and user has access
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    // Delete uploaded file if classroom doesn't exist
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  // Verify user is teacher or student in the classroom
  const userIdStr = userId?.toString();
  const isTeacher = classroom.teacherId.toString() === userIdStr;
  const isStudent = classroom.students.some(s => s.studentId.toString() === userIdStr);

  if (!isTeacher && !isStudent) {
    // Delete uploaded file if user doesn't have access
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this classroom'
    });
  }

  // Create document record
  const document = new ClassroomDocument({
    classroomId,
    title: title.trim(),
    description: description?.trim() || '',
    fileName: file.filename,
    originalFileName: file.originalname,
    fileType: file.mimetype,
    fileSize: file.size,
    filePath: file.path,
    uploadedBy: userId,
    uploadedByName: req.user.name || 'Unknown',
    metadata: {
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      category: category || null
    }
  });

  await document.save();

  res.status(201).json({
    success: true,
    message: 'Document uploaded successfully',
    data: {
      document: {
        id: document._id,
        title: document.title,
        description: document.description,
        fileName: document.fileName,
        originalFileName: document.originalFileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        uploadedBy: document.uploadedByName,
        uploadedAt: document.createdAt,
        downloadCount: document.downloadCount
      }
    }
  });
});

/**
 * Get all documents for a classroom
 */
const getDocuments = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  const userId = req.user._id || req.user.id;

  // Verify classroom exists and user has access
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  const userIdStr = userId?.toString();
  const isTeacher = classroom.teacherId.toString() === userIdStr;
  const isStudent = classroom.students.some(s => s.studentId.toString() === userIdStr);

  if (!isTeacher && !isStudent) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this classroom'
    });
  }

  // Get all active documents for the classroom
  const documents = await ClassroomDocument.find({
    classroomId,
    isActive: true
  })
    .sort({ createdAt: -1 })
    .select('-filePath'); // Don't send file path for security

  res.json({
    success: true,
    data: {
      documents: documents.map(doc => ({
        id: doc._id,
        title: doc.title,
        description: doc.description,
        fileName: doc.fileName,
        originalFileName: doc.originalFileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        uploadedBy: doc.uploadedByName,
        uploadedById: doc.uploadedBy,
        uploadedAt: doc.createdAt,
        downloadCount: doc.downloadCount,
        metadata: doc.metadata
      }))
    }
  });
});

/**
 * Download a document
 */
const downloadDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const userId = req.user._id || req.user.id;

  const document = await ClassroomDocument.findById(documentId);
  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  // Verify user has access to the classroom
  const classroom = await Classroom.findById(document.classroomId);
  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  const userIdStr = userId?.toString();
  const isTeacher = classroom.teacherId.toString() === userIdStr;
  const isStudent = classroom.students.some(s => s.studentId.toString() === userIdStr);

  if (!isTeacher && !isStudent) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this document'
    });
  }

  // Check if file exists
  try {
    await fs.access(document.filePath);
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: 'File not found on server'
    });
  }

  // Increment download count
  document.downloadCount += 1;
  await document.save();

  // Send file
  res.download(document.filePath, document.originalFileName, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }
    }
  });
});

/**
 * Delete a document
 */
const deleteDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const userId = req.user._id || req.user.id;

  const document = await ClassroomDocument.findById(documentId);
  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  // Verify user is the teacher or the uploader
  const classroom = await Classroom.findById(document.classroomId);
  if (!classroom) {
    return res.status(404).json({
      success: false,
      message: 'Classroom not found'
    });
  }

  const userIdStr = userId?.toString();
  const isTeacher = classroom.teacherId.toString() === userIdStr;
  const isUploader = document.uploadedBy.toString() === userIdStr;

  if (!isTeacher && !isUploader) {
    return res.status(403).json({
      success: false,
      message: 'Only the teacher or document uploader can delete this document'
    });
  }

  // Delete file from filesystem
  try {
    await fs.unlink(document.filePath);
  } catch (error) {
    console.error('Error deleting file from filesystem:', error);
    // Continue with database deletion even if file deletion fails
  }

  // Delete document record (soft delete by setting isActive to false)
  document.isActive = false;
  await document.save();

  res.json({
    success: true,
    message: 'Document deleted successfully'
  });
});

module.exports = {
  upload,
  uploadDocument,
  getDocuments,
  downloadDocument,
  deleteDocument
};

