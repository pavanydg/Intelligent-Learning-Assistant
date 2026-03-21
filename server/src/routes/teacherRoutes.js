const express = require('express');
const { param, query } = require('express-validator');
const {
  searchCourses,
  getCourseAnalytics,
  getCourseStudents,
  getStudentCourseProgress,
  getCollegesAndDepartments,
  generateCourseKey,
  getTeacherCourseKeys,
  getCourseByKey,
  getCourseKeyAnalytics,
  deactivateCourseKey
} = require('../controllers/teacherController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication and instructor/admin role
router.use(authenticateToken);
router.use(requireRole('instructor', 'admin'));

// Validation rules
const courseIdValidation = [
  param('courseId')
    .notEmpty()
    .withMessage('Course ID is required')
];

const studentIdValidation = [
  param('studentId')
    .notEmpty()
    .withMessage('Student ID is required')
];

const searchValidation = [
  query('query')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search query must be at least 1 character'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Routes
router.get('/courses/search', searchValidation, searchCourses);
router.get('/courses/:courseId/analytics', courseIdValidation, getCourseAnalytics);
router.get('/courses/:courseId/students', courseIdValidation, paginationValidation, getCourseStudents);
router.get('/courses/:courseId/students/:studentId', courseIdValidation, studentIdValidation, getStudentCourseProgress);
router.get('/colleges-departments', getCollegesAndDepartments);

// Course Key Management
router.post('/course-keys/generate', generateCourseKey);
router.get('/course-keys', getTeacherCourseKeys);
router.get('/course-keys/:keyId/analytics', getCourseKeyAnalytics);
router.put('/course-keys/:keyId/deactivate', deactivateCourseKey);

module.exports = router;

