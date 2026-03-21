/**
 * Proctoring Routes
 * Handles proctoring metrics submission and results
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../middlewares/errorHandler');
const Assessment = require('../models/Assessment');
const proctoringService = require('../services/proctoringService');

/**
 * POST /api/proctoring/metrics/:assessmentId
 * Submit proctoring metrics during assessment
 */
router.post('/metrics/:assessmentId', authenticateToken, asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;
  const metrics = req.body;

  // Verify assessment belongs to user
  const assessment = await Assessment.findOne({
    _id: assessmentId,
    userId: req.user.id
  });

  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  // Store proctoring metrics (append to existing if any)
  if (!assessment.proctoring) {
    assessment.proctoring = {
      integrityScore: 100,
      flags: [],
      metrics: {
        offScreenTime: 0,
        noFaceFrames: 0,
        gazeDeviation: 0,
        avgKeyDelay: 0,
        pasteEvents: 0,
        backspaceRate: 0,
        tabSwitches: 0,
        copyEvents: 0
      }
    };
  }

  // Update metrics (accumulate values)
  if (metrics.offScreenTime) {
    assessment.proctoring.metrics.offScreenTime += metrics.offScreenTime;
  }
  if (metrics.noFaceFrames) {
    assessment.proctoring.metrics.noFaceFrames += metrics.noFaceFrames;
  }
  if (metrics.gazeDeviation !== undefined) {
    // Average gaze deviation
    const currentAvg = assessment.proctoring.metrics.gazeDeviation || 0;
    const newValue = metrics.gazeDeviation;
    assessment.proctoring.metrics.gazeDeviation = (currentAvg + newValue) / 2;
  }
  if (metrics.avgKeyDelay) {
    const currentAvg = assessment.proctoring.metrics.avgKeyDelay || 0;
    const newValue = metrics.avgKeyDelay;
    assessment.proctoring.metrics.avgKeyDelay = (currentAvg + newValue) / 2;
  }
  if (metrics.pasteEvents) {
    assessment.proctoring.metrics.pasteEvents += metrics.pasteEvents;
  }
  if (metrics.backspaceRate) {
    const currentAvg = assessment.proctoring.metrics.backspaceRate || 0;
    const newValue = metrics.backspaceRate;
    assessment.proctoring.metrics.backspaceRate = (currentAvg + newValue) / 2;
  }
  if (metrics.tabSwitches) {
    assessment.proctoring.metrics.tabSwitches += metrics.tabSwitches;
  }
  if (metrics.copyEvents) {
    assessment.proctoring.metrics.copyEvents += metrics.copyEvents;
  }

  await assessment.save();

  res.json({
    success: true,
    message: 'Proctoring metrics recorded'
  });
}));

/**
 * GET /api/proctoring/results/:assessmentId
 * Get proctoring analysis results for an assessment
 */
router.get('/results/:assessmentId', authenticateToken, asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;

  // Verify assessment belongs to user or user is instructor/admin
  const assessment = await Assessment.findById(assessmentId)
    .populate('userId', 'name email role');

  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  // Check access permissions
  const isOwner = assessment.userId._id.toString() === req.user.id;
  const isInstructor = req.user.role === 'instructor' || req.user.role === 'admin';

  if (!isOwner && !isInstructor) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Analyze proctoring data if not already analyzed
  if (!assessment.proctoring || !assessment.proctoring.integrityScore) {
    if (assessment.proctoring && assessment.proctoring.metrics) {
      const analysis = proctoringService.analyzeProctoringData(assessment.proctoring.metrics);
      assessment.proctoring.integrityScore = analysis.integrityScore;
      assessment.proctoring.flags = analysis.flags;
      await assessment.save();
    }
  }

  res.json({
    success: true,
    data: {
      assessmentId: assessment._id,
      integrityScore: assessment.proctoring?.integrityScore || 100,
      flags: assessment.proctoring?.flags || [],
      metrics: assessment.proctoring?.metrics || {},
      severity: assessment.proctoring?.integrityScore 
        ? proctoringService.getSeverity(assessment.proctoring.integrityScore)
        : 'low'
    }
  });
}));

module.exports = router;


