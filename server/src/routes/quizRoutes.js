const express = require('express');
const router = express.Router();
const {
  createQuiz,
  updateQuiz,
  getTeacherQuizzes,
  getQuiz,
  generateQuizKey,
  getQuizByKey,
  submitQuizAttempt,
  getQuizAnalytics,
  getTeacherQuizKeys,
  getStudentQuizHistory,
  getQuizAttemptDetails,
  parsePDF,
  generateQuestions,
  upload
} = require('../controllers/quizController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

// Teacher routes (require instructor/admin role)
router.post('/', requireRole('instructor', 'admin'), createQuiz);
router.put('/:quizId', requireRole('instructor', 'admin'), updateQuiz);
router.post('/generate-questions', requireRole('instructor', 'admin'), upload.single('notes'), generateQuestions);
router.post('/parse-pdf', requireRole('instructor', 'admin'), upload.single('pdf'), parsePDF);
router.get('/teacher/quizzes', requireRole('instructor', 'admin'), getTeacherQuizzes);
router.get('/teacher/keys', requireRole('instructor', 'admin'), getTeacherQuizKeys);
router.post('/teacher/generate-key', requireRole('instructor', 'admin'), generateQuizKey);
router.get('/teacher/:quizId/analytics', requireRole('instructor', 'admin'), getQuizAnalytics);

// Student routes (accessible to all authenticated users)
router.get('/student/history', getStudentQuizHistory);
router.get('/student/attempt/:attemptId', getQuizAttemptDetails);
router.get('/key/:key', getQuizByKey);
router.post('/submit', submitQuizAttempt);

// Get quiz by ID (must be after other specific routes)
router.get('/:quizId', getQuiz);

module.exports = router;

