/**
 * Integration Routes
 * Handles external platform integrations (Notion, Google Docs, Moodle)
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../middlewares/errorHandler');
const integrationService = require('../services/integrationService');

/**
 * GET /api/integrations/status
 * Get user's integration connection status
 */
router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
  const status = await integrationService.getIntegrationStatus(req.user.id);
  res.json({
    success: true,
    data: status
  });
}));

/**
 * GET /api/integrations/auth-url/:provider
 * Get OAuth authorization URL for a provider
 */
router.get('/auth-url/:provider', authenticateToken, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const authUrl = integrationService.getAuthUrl(provider);
  
  if (!authUrl) {
    return res.status(400).json({
      success: false,
      message: `${provider} does not support OAuth or requires manual configuration`
    });
  }

  res.json({
    success: true,
    data: { authUrl }
  });
}));

/**
 * POST /api/integrations/connect/:provider
 * Connect user to an integration provider
 */
router.post('/connect/:provider', authenticateToken, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { code, config } = req.body;

  let connectionConfig = config;

  // If OAuth code provided, exchange for token
  if (code && !config) {
    const tokenData = await integrationService.exchangeCodeForToken(provider, code);
    connectionConfig = tokenData;
  }

  if (!connectionConfig) {
    return res.status(400).json({
      success: false,
      message: 'Configuration or OAuth code required'
    });
  }

  const result = await integrationService.connectProvider(req.user.id, provider, connectionConfig);
  
  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/integrations/disconnect/:provider
 * Disconnect user from an integration provider
 */
router.post('/disconnect/:provider', authenticateToken, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const result = await integrationService.disconnectProvider(req.user.id, provider);
  
  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/integrations/export/notes/:videoId
 * Export notes to external platform
 */
router.post('/export/notes/:videoId', authenticateToken, asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { provider, options } = req.body;

  if (!provider) {
    return res.status(400).json({
      success: false,
      message: 'Provider is required'
    });
  }

  const result = await integrationService.exportNotes(
    req.user.id,
    videoId,
    provider,
    options || {}
  );
  
  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/integrations/export/feedback/:assessmentId
 * Export feedback to external platform
 */
router.post('/export/feedback/:assessmentId', authenticateToken, asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;
  const { provider, options } = req.body;

  if (!provider) {
    return res.status(400).json({
      success: false,
      message: 'Provider is required'
    });
  }

  const result = await integrationService.exportFeedback(
    req.user.id,
    assessmentId,
    provider,
    options || {}
  );
  
  res.json({
    success: true,
    data: result
  });
}));

module.exports = router;


