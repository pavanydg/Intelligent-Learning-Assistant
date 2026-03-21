/**
 * Google Docs Integration Plugin
 * Exports notes and feedback to Google Docs
 */

const axios = require('axios');

// Lazy load googleapis only when needed (for document creation)
let google = null;
function getGoogleApis() {
  if (!google) {
    try {
      google = require('googleapis').google;
    } catch (error) {
      throw new Error('googleapis package is required. Install it with: npm install googleapis');
    }
  }
  return google;
}

class GoogleDocsPlugin {
  constructor() {
    this.name = 'googledocs';
    this.displayName = 'Google Docs';
    this.requiredScopes = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive.file'];
  }

  /**
   * Get OAuth authorization URL
   * @returns {string} Authorization URL
   */
  getAuthUrl() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.CLIENT_URL}/integrations/googledocs/callback`;
    
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID not configured');
    }

    const state = require('crypto').randomBytes(16).toString('hex');
    const scopes = this.requiredScopes.join(' ');
    
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code
   * @returns {Promise<Object>} Token data
   */
  async exchangeCodeForToken(code) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.CLIENT_URL}/integrations/googledocs/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: Date.now() + (response.data.expires_in * 1000)
      };
    } catch (error) {
      console.error('Google token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange Google authorization code');
    }
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token data
   */
  async refreshAccessToken(refreshToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
      });

      return {
        accessToken: response.data.access_token,
        expiresAt: Date.now() + (response.data.expires_in * 1000)
      };
    } catch (error) {
      console.error('Google token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh Google access token');
    }
  }

  /**
   * Get authenticated OAuth2 client
   * @param {Object} userConfig - User's Google configuration
   * @returns {Promise<Object>} OAuth2 client
   */
  async getAuthClient(userConfig) {
    const google = getGoogleApis();
    const { accessToken, refreshToken } = userConfig;
    
    // Check if token needs refresh
    if (userConfig.expiresAt && Date.now() >= userConfig.expiresAt - 60000) {
      const newTokens = await this.refreshAccessToken(refreshToken);
      userConfig.accessToken = newTokens.accessToken;
      userConfig.expiresAt = newTokens.expiresAt;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.CLIENT_URL}/integrations/googledocs/callback`
    );

    oauth2Client.setCredentials({
      access_token: userConfig.accessToken,
      refresh_token: userConfig.refreshToken
    });

    return oauth2Client;
  }

  /**
   * Validate plugin configuration
   * @param {Object} config - Configuration object
   * @returns {Object} Validation result
   */
  validateConfig(config) {
    if (!config.accessToken) {
      return { valid: false, error: 'Google access token is required' };
    }
    return { valid: true };
  }

  /**
   * Export notes to Google Docs
   * @param {Object} notesData - Notes data to export
   * @param {Object} userConfig - User's Google configuration
   * @returns {Promise<Object>} Export result
   */
  async exportNotes(notesData, userConfig) {
    if (!this.validateConfig(userConfig).valid) {
      throw new Error('Invalid Google Docs configuration');
    }

    try {
      const google = getGoogleApis();
      const auth = await this.getAuthClient(userConfig);
      const docs = google.docs({ version: 'v1', auth });

      const { videoTitle, shortNotes, detailedNotes } = notesData;

      // Create a new Google Doc
      const createResponse = await docs.documents.create({
        requestBody: {
          title: `ILA Notes: ${videoTitle}`
        }
      });

      const documentId = createResponse.data.documentId;

      // Build the complete content string
      const fullContent = `${videoTitle}\n\nShort Notes\n\n${shortNotes}\n\nDetailed Notes\n\n${detailedNotes}`;
      
      // Calculate positions for formatting (after all text is inserted)
      // Document starts at index 1
      const titleStart = 1;
      const titleEnd = 1 + videoTitle.length;
      
      // After title: titleEnd + 2 (\n\n) + 1 (start of next text)
      const shortNotesHeaderStart = titleEnd + 2 + 1;
      const shortNotesHeaderEnd = shortNotesHeaderStart + 'Short Notes'.length;
      
      // After "Short Notes": shortNotesHeaderEnd + 2 (\n\n) + shortNotes.length + 2 (\n\n) + 1
      const detailedNotesHeaderStart = shortNotesHeaderEnd + 2 + shortNotes.length + 2 + 1;
      const detailedNotesHeaderEnd = detailedNotesHeaderStart + 'Detailed Notes'.length;

      // Step 1: Insert all text at once
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: fullContent
              }
            }
          ]
        }
      });

      // Step 2: Apply formatting to specific ranges
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              updateTextStyle: {
                range: { startIndex: titleStart, endIndex: titleEnd },
                textStyle: {
                  bold: true,
                  fontSize: { magnitude: 18, unit: 'PT' }
                },
                fields: 'bold,fontSize'
              }
            },
            {
              updateTextStyle: {
                range: { startIndex: shortNotesHeaderStart, endIndex: shortNotesHeaderEnd },
                textStyle: {
                  bold: true,
                  fontSize: { magnitude: 14, unit: 'PT' }
                },
                fields: 'bold,fontSize'
              }
            },
            {
              updateTextStyle: {
                range: { startIndex: detailedNotesHeaderStart, endIndex: detailedNotesHeaderEnd },
                textStyle: {
                  bold: true,
                  fontSize: { magnitude: 14, unit: 'PT' }
                },
                fields: 'bold,fontSize'
              }
            }
          ]
        }
      });

      return {
        success: true,
        documentId,
        documentUrl: `https://docs.google.com/document/d/${documentId}`,
        message: 'Notes exported to Google Docs successfully'
      };
    } catch (error) {
      console.error('Google Docs export error:', error.response?.data || error.message);
      throw new Error(`Failed to export to Google Docs: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Export feedback to Google Docs
   * @param {Object} feedbackData - Feedback data to export
   * @param {Object} userConfig - User's Google configuration
   * @returns {Promise<Object>} Export result
   */
  async exportFeedback(feedbackData, userConfig) {
    if (!this.validateConfig(userConfig).valid) {
      throw new Error('Invalid Google Docs configuration');
    }

    try {
      const google = getGoogleApis();
      const auth = await this.getAuthClient(userConfig);
      const docs = google.docs({ version: 'v1', auth });

      const { summary, strengths, weaknesses, recommendations } = feedbackData;

      // Create a new Google Doc
      const createResponse = await docs.documents.create({
        requestBody: {
          title: `ILA Feedback: Assessment ${feedbackData.assessmentId}`
        }
      });

      const documentId = createResponse.data.documentId;

      // Build content
      let content = 'Assessment Feedback\n\n';
      content += `${summary}\n\n`;
      content += 'Strengths\n';
      strengths.forEach(s => content += `• ${s}\n`);
      content += '\nAreas for Improvement\n';
      weaknesses.forEach(w => content += `• ${w}\n`);
      content += '\nRecommendations\n';
      recommendations.forEach(r => content += `• ${r}\n`);

      // Insert content
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content
              }
            }
          ]
        }
      });

      return {
        success: true,
        documentId,
        documentUrl: `https://docs.google.com/document/d/${documentId}`,
        message: 'Feedback exported to Google Docs successfully'
      };
    } catch (error) {
      console.error('Google Docs feedback export error:', error.response?.data || error.message);
      throw new Error(`Failed to export feedback to Google Docs: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

module.exports = new GoogleDocsPlugin();


