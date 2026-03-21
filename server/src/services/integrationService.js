/**
 * Integration Service
 * Handles exporting content to external platforms (Notion, Google Docs, Moodle)
 */

const User = require('../models/User');
const Notes = require('../models/Notes');
const Feedback = require('../models/Feedback');
const pluginManager = require('../plugins/pluginManager');

class IntegrationService {
  /**
   * Connect user to an integration provider
   * @param {string} userId - User ID
   * @param {string} provider - Provider name (notion, googledocs, moodle)
   * @param {Object} config - Provider configuration
   * @returns {Promise<Object>} Connection result
   */
  async connectProvider(userId, provider, config) {
    try {
      const plugin = pluginManager.getPlugin(provider);
      if (!plugin) {
        throw new Error(`Provider ${provider} not supported`);
      }

      // Validate configuration
      const validation = pluginManager.validatePluginConfig(provider, config);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Test connection for Notion to catch issues early
      if (provider === 'notion' && plugin.testConnection) {
        try {
          await plugin.testConnection(config);
        } catch (testError) {
          // Pass through the error message directly for better user feedback
          throw testError;
        }
      }

      // Update user's integration settings
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Store provider-specific configuration
      const integrationData = {
        ...config,
        connectedAt: new Date()
      };

      if (!user.integrations) {
        user.integrations = {};
      }

      user.integrations[provider] = integrationData;
      await user.save();

      return {
        success: true,
        provider,
        message: `Successfully connected to ${plugin.displayName}`
      };
    } catch (error) {
      console.error('Integration connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect user from an integration provider
   * @param {string} userId - User ID
   * @param {string} provider - Provider name
   * @returns {Promise<Object>} Disconnection result
   */
  async disconnectProvider(userId, provider) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Use $unset to properly remove the field from MongoDB
      const result = await User.updateOne(
        { _id: userId },
        { $unset: { [`integrations.${provider}`]: "" } }
      );

      console.log(`Disconnected ${provider} for user ${userId}, result:`, result);

      return {
        success: true,
        provider,
        message: `Successfully disconnected from ${provider}`
      };
    } catch (error) {
      console.error('Integration disconnection error:', error);
      throw error;
    }
  }

  /**
   * Get user's integration status
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Integration status
   */
  async getIntegrationStatus(userId) {
    try {
      const user = await User.findById(userId).select('integrations');
      if (!user) {
        throw new Error('User not found');
      }

      const status = {};
      const availablePlugins = pluginManager.getAvailablePlugins();

      availablePlugins.forEach(pluginName => {
        const plugin = pluginManager.getPlugin(pluginName);
        // Check if integration exists and has required fields
        const integration = user.integrations?.[pluginName];
        const isConnected = integration && 
                           integration !== null && 
                           integration !== undefined &&
                           Object.keys(integration).length > 0 &&
                           (integration.accessToken || integration.token || integration.baseUrl);
        
        status[pluginName] = {
          name: plugin.displayName,
          connected: !!isConnected,
          connectedAt: integration?.connectedAt || null
        };
      });

      return status;
    } catch (error) {
      console.error('Get integration status error:', error);
      throw error;
    }
  }

  /**
   * Export notes to external platform
   * @param {string} userId - User ID
   * @param {string} videoId - Video ID
   * @param {string} provider - Provider name
   * @param {Object} options - Export options (e.g., courseId for Moodle)
   * @returns {Promise<Object>} Export result
   */
  async exportNotes(userId, videoId, provider, options = {}) {
    try {
      // Get user's notes
      const notes = await Notes.findOne({ userId, videoId });
      if (!notes) {
        throw new Error('Notes not found for this video');
      }

      // Get user's integration configuration
      const user = await User.findById(userId).select('integrations');
      if (!user) {
        throw new Error('User not found');
      }
      if (!user.integrations || !user.integrations[provider]) {
        throw new Error(`Not connected to ${provider}. Please go to Settings → Integrations and connect ${provider} first.`);
      }

      // Get plugin
      const plugin = pluginManager.getPlugin(provider);
      if (!plugin) {
        throw new Error(`Provider ${provider} not supported`);
      }

      // Prepare notes data
      const notesData = {
        videoTitle: notes.videoTitle,
        shortNotes: notes.shortNotes,
        detailedNotes: notes.detailedNotes
      };

      // Log for debugging (don't log full token for security)
      const accessToken = user.integrations[provider].accessToken;
      console.log(`Exporting to ${provider} for user ${userId}, config:`, {
        hasAccessToken: !!accessToken,
        accessTokenPrefix: accessToken ? accessToken.substring(0, 10) + '...' : 'missing',
        accessTokenLength: accessToken ? accessToken.length : 0,
        hasWorkspace: !!user.integrations[provider].workspace,
        hasDatabaseId: !!user.integrations[provider].workspace?.databaseId,
        databaseId: user.integrations[provider].workspace?.databaseId?.substring(0, 20) + '...'
      });

      // Export using plugin
      let result;
      if (provider === 'moodle' && options.courseId) {
        result = await plugin.exportNotes(notesData, user.integrations[provider], options.courseId);
      } else {
        result = await plugin.exportNotes(notesData, user.integrations[provider]);
      }

      return {
        success: true,
        provider,
        ...result
      };
    } catch (error) {
      console.error('Export notes error:', error);
      throw error;
    }
  }

  /**
   * Export feedback to external platform
   * @param {string} userId - User ID
   * @param {string} assessmentId - Assessment ID
   * @param {string} provider - Provider name
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportFeedback(userId, assessmentId, provider, options = {}) {
    try {
      // Get feedback
      const feedback = await Feedback.findOne({ assessmentId, userId });
      if (!feedback) {
        throw new Error('Feedback not found for this assessment');
      }

      // Get user's integration configuration
      const user = await User.findById(userId).select('integrations');
      if (!user || !user.integrations || !user.integrations[provider]) {
        throw new Error(`Not connected to ${provider}. Please connect first.`);
      }

      // Get plugin
      const plugin = pluginManager.getPlugin(provider);
      if (!plugin) {
        throw new Error(`Provider ${provider} not supported`);
      }

      // Prepare feedback data
      const feedbackData = {
        assessmentId: assessmentId.toString(),
        summary: feedback.summary,
        strengths: feedback.strengths || [],
        weaknesses: feedback.weaknesses || [],
        recommendations: feedback.recommendations || []
      };

      // Export using plugin
      let result;
      if (provider === 'moodle' && options.courseId && options.forumId) {
        result = await plugin.exportFeedback(
          feedbackData, 
          user.integrations[provider], 
          options.courseId,
          options.forumId
        );
      } else {
        result = await plugin.exportFeedback(feedbackData, user.integrations[provider]);
      }

      return {
        success: true,
        provider,
        ...result
      };
    } catch (error) {
      console.error('Export feedback error:', error);
      throw error;
    }
  }

  /**
   * Get OAuth URL for a provider
   * @param {string} provider - Provider name
   * @returns {string} OAuth URL
   */
  getAuthUrl(provider) {
    const plugin = pluginManager.getPlugin(provider);
    if (!plugin) {
      throw new Error(`Provider ${provider} not supported`);
    }

    if (typeof plugin.getAuthUrl === 'function') {
      return plugin.getAuthUrl();
    }

    return null;
  }

  /**
   * Exchange OAuth code for token (for OAuth providers)
   * @param {string} provider - Provider name
   * @param {string} code - Authorization code
   * @returns {Promise<Object>} Token data
   */
  async exchangeCodeForToken(provider, code) {
    const plugin = pluginManager.getPlugin(provider);
    if (!plugin) {
      throw new Error(`Provider ${provider} not supported`);
    }

    if (typeof plugin.exchangeCodeForToken === 'function') {
      return await plugin.exchangeCodeForToken(code);
    }

    throw new Error(`Provider ${provider} does not support OAuth code exchange`);
  }
}

module.exports = new IntegrationService();

