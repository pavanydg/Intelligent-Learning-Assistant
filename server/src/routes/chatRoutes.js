/**
 * Chat Routes - Context-Aware Educational Chatbot API
 */

const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * POST /api/chat
 * Send a message to the chatbot
 * 
 * Request body:
 * {
 *   "message": "Explain why loss increases in gradient descent",
 *   "transcript": "optional transcript text...",
 *   "description": "optional video description...",
 *   "topic": "optional topic name",
 *   "videoId": "optional video ID to fetch transcript"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "reply": "Your answer here...",
 *   "hasContext": true,
 *   "contextType": "transcript"
 * }
 */
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const { message, transcript, description, topic, videoId } = req.body;

  // Validate required fields
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message is required and must be a non-empty string'
    });
  }

  // Validate message length
  if (message.length > 2000) {
    return res.status(400).json({
      success: false,
      message: 'Message is too long. Maximum 2000 characters allowed.'
    });
  }

  try {
    // Generate response using chat service
    const result = await chatService.generateResponse({
      message,
      transcript,
      description,
      topic,
      videoId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Return 503 for service unavailable/overloaded errors
    const isServiceUnavailable = error.message && (
      error.message.includes('overloaded') ||
      error.message.includes('503') ||
      error.message.includes('Service Unavailable') ||
      error.message.includes('currently busy') ||
      error.message.includes('try again in a few moments')
    );
    
    const statusCode = isServiceUnavailable ? 503 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate chat response'
    });
  }
}));

/**
 * POST /api/chat/quick
 * Send a quick message without context (for general questions)
 * 
 * Request body:
 * {
 *   "message": "What is machine learning?"
 * }
 */
router.post('/quick', authenticateToken, asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message is required and must be a non-empty string'
    });
  }

  try {
    const result = await chatService.generateQuickResponse(message);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Quick chat API error:', error);
    
    // Return 503 for service unavailable/overloaded errors
    const isServiceUnavailable = error.message && (
      error.message.includes('overloaded') ||
      error.message.includes('503') ||
      error.message.includes('Service Unavailable') ||
      error.message.includes('currently busy') ||
      error.message.includes('try again in a few moments')
    );
    
    const statusCode = isServiceUnavailable ? 503 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate chat response'
    });
  }
}));

module.exports = router;

