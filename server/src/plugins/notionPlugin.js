/**
 * Notion Integration Plugin
 * Exports notes and feedback to Notion pages
 */

const axios = require('axios');

// Create axios instance with longer timeout for Notion API calls
// Notion can be slow when creating pages with many blocks
const notionAxios = axios.create({
  timeout: 60000, // 60 seconds timeout
  headers: {
    'Notion-Version': '2022-06-28'
  }
});

class NotionPlugin {
  constructor() {
    this.name = 'notion';
    this.displayName = 'Notion';
    this.requiredScopes = ['read', 'update'];
  }

  /**
   * Get OAuth authorization URL (Notion uses internal integrations, not OAuth)
   * @returns {string|null} Returns null as Notion uses API keys
   */
  getAuthUrl() {
    // Notion doesn't use OAuth - it uses internal integrations with API keys
    // Users need to manually create an integration and provide the API key
    return null;
  }

  /**
   * Exchange authorization code for token (Not supported for Notion)
   * Notion uses internal integrations with API keys, not OAuth
   */
  async exchangeCodeForToken(code) {
    throw new Error('Notion does not support OAuth. Please use an internal integration API key.');
  }

  /**
   * Validate plugin configuration
   * @param {Object} config - Configuration object
   * @returns {Object} Validation result
   */
  validateConfig(config) {
    if (!config || !config.accessToken) {
      return { valid: false, error: 'Notion API key (accessToken) is required. Create an internal integration at https://www.notion.so/my-integrations' };
    }
    // Notion API keys can have different prefixes (secret_, ntn-, etc.)
    // Just check that it's not empty and has reasonable length
    if (typeof config.accessToken !== 'string' || config.accessToken.trim().length < 20) {
      return { valid: false, error: 'Invalid Notion API key format. Please check that you copied the complete API key.' };
    }
    return { valid: true };
  }

  /**
   * Test connection to Notion API
   * @param {Object} userConfig - User's Notion configuration
   * @returns {Promise<Object>} Test result
   */
  async testConnection(userConfig) {
    const validation = this.validateConfig(userConfig);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    try {
      const { accessToken, workspace } = userConfig;

      // Verify database access - this tests both API key and database sharing
      if (!workspace?.databaseId) {
        throw new Error('Database ID is required. Please provide a database ID in your Notion integration settings.');
      }

      // Log configuration for debugging (without exposing full token)
      console.log('Testing Notion connection:', {
        hasAccessToken: !!accessToken,
        accessTokenPrefix: accessToken ? accessToken.substring(0, 10) + '...' : 'missing',
        accessTokenLength: accessToken ? accessToken.length : 0,
        hasDatabaseId: !!workspace?.databaseId,
        databaseId: workspace?.databaseId ? workspace.databaseId.substring(0, 20) + '...' : 'missing',
        databaseIdLength: workspace?.databaseId ? workspace.databaseId.length : 0
      });

      // Step 1: Test API key validity by calling /users/me endpoint
      let apiKeyValid = false;
      try {
        console.log('Step 1: Testing API key validity...');
        const userResponse = await notionAxios.get('https://api.notion.com/v1/users/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        apiKeyValid = true;
        console.log('✅ API key is valid. User:', userResponse.data.name || userResponse.data.id);
      } catch (apiKeyError) {
        const apiKeyErrorStatus = apiKeyError.response?.status;
        const apiKeyErrorData = apiKeyError.response?.data;
        
        console.error('❌ API key test failed:', {
          status: apiKeyErrorStatus,
          errorCode: apiKeyErrorData?.code,
          errorMessage: apiKeyErrorData?.message
        });

        if (apiKeyErrorStatus === 401) {
          // API key is definitely invalid
          throw new Error('Invalid Notion API key. Please check:\n' +
            '1. Your API key is correct and complete\n' +
            '2. Your API key is not truncated (should be 20+ characters)\n' +
            '3. Your integration is active at https://www.notion.so/my-integrations\n' +
            '4. If the integration was deleted, create a new one and get a new API key\n' +
            `Current API key length: ${accessToken ? accessToken.length : 0} characters`);
        } else {
          throw new Error(`Failed to verify API key: ${apiKeyErrorData?.message || apiKeyError.message}`);
        }
      }

      // Step 2: Test database access (only if API key is valid)
      if (!apiKeyValid) {
        throw new Error('API key validation failed');
      }

      try {
        console.log('Step 2: Testing database access...');
        const dbResponse = await notionAxios.get(`https://api.notion.com/v1/databases/${workspace.databaseId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        console.log('✅ Database access verified:', dbResponse.data.title?.[0]?.plain_text || workspace.databaseId);
      } catch (dbError) {
        // Enhanced error logging
        const errorStatus = dbError.response?.status;
        const errorData = dbError.response?.data;
        
        console.error('❌ Database access test failed:', {
          status: errorStatus,
          errorCode: errorData?.code,
          errorMessage: errorData?.message,
          databaseId: workspace?.databaseId ? workspace.databaseId.substring(0, 20) + '...' : 'missing',
          databaseIdLength: workspace?.databaseId ? workspace.databaseId.length : 0
        });

        if (errorStatus === 401) {
          // This shouldn't happen if API key test passed, but handle it anyway
          throw new Error('Database not shared with integration. Please:\n' +
            '1. Open your database in Notion\n' +
            '2. Click "..." (three dots) in the top right corner\n' +
            '3. Click "Connections" or "Add connections"\n' +
            '4. Select your integration from the list\n' +
            '5. Make sure it has "Read" and "Update" capabilities\n' +
            '6. If your integration is not in the list, it may be inactive - check https://www.notion.so/my-integrations');
        } else if (errorStatus === 404) {
          // 404 from Notion usually means database not shared, not that it doesn't exist
          const errorMsg = errorData?.message || '';
          if (errorMsg.includes('shared with your integration') || errorMsg.includes('Make sure the relevant')) {
            throw new Error('Database is not shared with your integration. Please:\n' +
              '1. Open your database in Notion\n' +
              '2. Click "..." (three dots) in the top right corner\n' +
              '3. Click "Connections" or "Add connections"\n' +
              '4. Select your integration "ILA TEST" from the list\n' +
              '5. Make sure it has "Read" and "Update" capabilities\n' +
              '6. If your integration is not in the list, check https://www.notion.so/my-integrations to ensure it\'s active\n' +
              `\nDatabase ID being used: ${workspace?.databaseId ? workspace.databaseId.substring(0, 20) + '...' : 'missing'}`);
          } else {
            throw new Error('Database not found. Please check:\n' +
              '1. The Database ID is correct (32 characters, from the database URL)\n' +
              `   Current Database ID: ${workspace?.databaseId || 'missing'}\n` +
              '2. The database exists and you have access to it\n' +
              '3. Copy the Database ID from the URL: https://www.notion.so/workspace/DATABASE_ID_HERE?v=...\n' +
              '   (The ID is the long string between /workspace/ and ?v=)\n' +
              '4. Make sure the database is shared with your integration');
          }
        } else if (errorStatus === 403) {
          throw new Error('Access denied to database. Please make sure:\n' +
            '1. The database is shared with your integration (click "..." → "Connections" → select your integration)\n' +
            '2. The integration has "Read" and "Update" capabilities\n' +
            '3. Your integration is active at https://www.notion.so/my-integrations');
        }
        // Log the actual error for debugging
        throw new Error(`Database access error (${errorStatus || 'unknown'}): ${errorData?.message || dbError.message}`);
      }

      return {
        success: true,
        message: 'Notion connection verified successfully'
      };
    } catch (error) {
      console.error('Notion connection test error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Split text into chunks that fit Notion's 2000 character limit per paragraph
   * @param {string} text - Text to split
   * @param {number} maxLength - Maximum length per chunk (default 2000)
   * @returns {Array<string>} Array of text chunks
   */
  splitTextIntoChunks(text, maxLength = 2000) {
    if (!text || text.length <= maxLength) {
      return [text];
    }

    const chunks = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      let chunk = text.substring(currentIndex, currentIndex + maxLength);
      
      // Try to break at a sentence boundary if possible
      if (currentIndex + maxLength < text.length) {
        const lastPeriod = chunk.lastIndexOf('. ');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > maxLength * 0.7) { // Only break if we're at least 70% through
          chunk = text.substring(currentIndex, currentIndex + breakPoint + 1);
          currentIndex += breakPoint + 1;
        } else {
          currentIndex += maxLength;
        }
      } else {
        currentIndex += maxLength;
      }
      
      chunks.push(chunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Export notes to Notion
   * @param {Object} notesData - Notes data to export
   * @param {Object} userConfig - User's Notion configuration
   * @returns {Promise<Object>} Export result
   */
  async exportNotes(notesData, userConfig) {
    const validation = this.validateConfig(userConfig);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid Notion configuration. Please check your Notion integration settings.');
    }

    try {
      // First, test the connection to provide better error messages
      try {
        await this.testConnection(userConfig);
      } catch (testError) {
        // If test fails, throw the test error which has better messages
        throw testError;
      }

      const { accessToken, workspace } = userConfig;
      const { videoTitle, shortNotes, detailedNotes } = notesData;

      // Create a new Notion page
      // Notion API requires a parent database - if no database ID provided, throw error
      if (!workspace?.databaseId) {
        throw new Error('Database ID is required for Notion export. Please provide a database ID in your Notion integration settings. Create a database in Notion, share it with your integration, and copy its ID.');
      }

      // Build children blocks
      const children = [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: videoTitle } }]
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Short Notes' } }]
          }
        }
      ];

      // Split short notes into chunks if needed (2000 char limit per paragraph)
      const shortNotesChunks = this.splitTextIntoChunks(shortNotes || '');
      shortNotesChunks.forEach(chunk => {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: chunk } }]
          }
        });
      });

      // Add detailed notes heading
      children.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Detailed Notes' } }]
        }
      });

      // Split detailed notes into chunks (2000 char limit per paragraph)
      const detailedNotesChunks = this.splitTextIntoChunks(detailedNotes || '');
      detailedNotesChunks.forEach(chunk => {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: chunk } }]
          }
        });
      });

      const pageData = {
        parent: { database_id: workspace.databaseId },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: `ILA Notes: ${videoTitle}`
                }
              }
            ]
          }
        },
        children: children
      };

      const response = await notionAxios.post('https://api.notion.com/v1/pages', pageData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        pageId: response.data.id,
        pageUrl: response.data.url,
        message: 'Notes exported to Notion successfully'
      };
    } catch (error) {
      console.error('Notion export error:', error.response?.data || error.message);
      
      // Provide more helpful error messages
      const errorData = error.response?.data;
      let errorMessage = 'Failed to export to Notion';
      
      if (errorData) {
        if (errorData.code === 'unauthorized' || errorData.message?.includes('invalid') || errorData.message?.includes('token')) {
          errorMessage = 'Invalid Notion API key. Please check:\n' +
            '1. Your API key is correct and complete\n' +
            '2. The integration is active in Notion\n' +
            '3. The database is shared with your integration (click "..." → "Connections" → select your integration)';
        } else if (errorData.code === 'object_not_found' || errorData.message?.includes('database')) {
          errorMessage = 'Database not found or not accessible. Please check:\n' +
            '1. The Database ID is correct\n' +
            '2. The database is shared with your integration\n' +
            '3. Your integration has "Read" and "Update" capabilities';
        } else if (errorData.code === 'validation_error' || errorData.message?.includes('validation')) {
          // This should be handled by chunking, but provide helpful message
          errorMessage = 'Content validation error. The notes may be too long. Please try again - the system will automatically split long content into multiple blocks.';
        } else if (errorData.message) {
          errorMessage = `Notion API error: ${errorData.message}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Export feedback to Notion
   * @param {Object} feedbackData - Feedback data to export
   * @param {Object} userConfig - User's Notion configuration
   * @returns {Promise<Object>} Export result
   */
  async exportFeedback(feedbackData, userConfig) {
    if (!this.validateConfig(userConfig).valid) {
      throw new Error('Invalid Notion configuration');
    }

    try {
      const { accessToken, workspace } = userConfig;
      const { summary, strengths, weaknesses, recommendations } = feedbackData;

      const pageData = {
        parent: { database_id: workspace.databaseId || null },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: `ILA Feedback: ${feedbackData.assessmentId}`
                }
              }
            ]
          }
        },
        children: [
          {
            object: 'block',
            type: 'heading_1',
            heading_1: {
              rich_text: [{ type: 'text', text: { content: 'Assessment Feedback' } }]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: summary } }]
            }
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Strengths' } }]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: strengths.map(s => ({
                type: 'text',
                text: { content: `• ${s}\n` }
              }))
            }
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Areas for Improvement' } }]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: weaknesses.map(w => ({
                type: 'text',
                text: { content: `• ${w}\n` }
              }))
            }
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Recommendations' } }]
            }
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: recommendations.map(r => ({
                type: 'text',
                text: { content: `• ${r}\n` }
              }))
            }
          }
        ]
      };

      const response = await notionAxios.post('https://api.notion.com/v1/pages', pageData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        pageId: response.data.id,
        pageUrl: response.data.url,
        message: 'Feedback exported to Notion successfully'
      };
    } catch (error) {
      console.error('Notion feedback export error:', error.response?.data || error.message);
      throw new Error(`Failed to export feedback to Notion: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = new NotionPlugin();

