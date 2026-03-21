const express = require('express');
const router = express.Router();
const notesController = require('../controllers/notesController');
const { asyncHandler } = require('../middlewares/errorHandler');
const { authenticateToken } = require('../middlewares/authMiddleware');

/**
 * Generate notes for a video
 * POST /api/notes/generate/:videoId
 */
router.post('/generate/:videoId', authenticateToken, asyncHandler(async (req, res) => {
  await notesController.generateNotes(req, res);
}));

/**
 * Get notes for a video
 * GET /api/notes/:videoId
 */
router.get('/:videoId', authenticateToken, asyncHandler(async (req, res) => {
  await notesController.getNotes(req, res);
}));

/**
 * Get all user notes
 * GET /api/notes
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  await notesController.getUserNotes(req, res);
}));

/**
 * Download notes as PDF
 * GET /api/notes/:videoId/download
 */
router.get('/:videoId/download', authenticateToken, asyncHandler(async (req, res) => {
  await notesController.downloadPDF(req, res);
}));

/**
 * Delete notes for a video
 * DELETE /api/notes/:videoId
 */
router.delete('/:videoId', authenticateToken, asyncHandler(async (req, res) => {
  await notesController.deleteNotes(req, res);
}));

module.exports = router;
