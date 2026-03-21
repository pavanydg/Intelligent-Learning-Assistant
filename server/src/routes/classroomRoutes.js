const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');
const {
  createClassroom,
  getTeacherClassrooms,
  getStudentClassrooms,
  getClassroom,
  joinClassroom,
  leaveClassroom,
  updateClassroom,
  deleteClassroom,
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  linkCourse,
  linkQuiz,
  unlinkCourse,
  unlinkQuiz
} = require('../controllers/classroomController');
const {
  upload,
  uploadDocument,
  getDocuments,
  downloadDocument,
  deleteDocument
} = require('../controllers/classroomDocumentController');

// All routes require authentication
router.use(authenticateToken);

// Classroom routes
router.post('/', requireRole('instructor', 'admin'), createClassroom);
router.get('/teacher/my-classrooms', requireRole('instructor', 'admin'), getTeacherClassrooms);
router.get('/student/my-classrooms', requireRole('student'), getStudentClassrooms);
router.get('/:id', getClassroom);
router.post('/join', requireRole('student'), joinClassroom);
router.post('/:id/leave', requireRole('student'), leaveClassroom);
router.put('/:id', requireRole('instructor', 'admin'), updateClassroom);
router.delete('/:id', requireRole('instructor', 'admin'), deleteClassroom);

// Announcement routes
router.post('/:classroomId/announcements', requireRole('instructor', 'admin'), createAnnouncement);
router.get('/:classroomId/announcements', getAnnouncements);
router.put('/announcements/:id', requireRole('instructor', 'admin'), updateAnnouncement);
router.delete('/announcements/:id', requireRole('instructor', 'admin'), deleteAnnouncement);

// Link courses and quizzes
router.post('/:classroomId/link-course', requireRole('instructor', 'admin'), linkCourse);
router.post('/:classroomId/link-quiz', requireRole('instructor', 'admin'), linkQuiz);
router.delete('/:classroomId/unlink-course', requireRole('instructor', 'admin'), unlinkCourse);
router.delete('/:classroomId/unlink-quiz', requireRole('instructor', 'admin'), unlinkQuiz);

// Document routes
router.post('/:classroomId/documents', upload.single('file'), uploadDocument);
router.get('/:classroomId/documents', getDocuments);
router.get('/documents/:documentId/download', downloadDocument);
router.delete('/documents/:documentId', deleteDocument);

module.exports = router;

