/**
 * Moodle Integration Plugin
 * Exports notes and feedback to Moodle courses
 */

const axios = require('axios');

class MoodlePlugin {
  constructor() {
    this.name = 'moodle';
    this.displayName = 'Moodle';
    this.requiredScopes = ['mod/forum:addinstance', 'mod/page:addinstance'];
  }

  /**
   * Get configuration URL (Moodle uses manual token setup)
   * @returns {string} Instructions URL
   */
  getAuthUrl() {
    // Moodle doesn't use OAuth, requires manual token setup
    return null;
  }

  /**
   * Validate Moodle configuration
   * @param {Object} config - Configuration object
   * @returns {Object} Validation result
   */
  validateConfig(config) {
    if (!config.baseUrl) {
      return { valid: false, error: 'Moodle base URL is required' };
    }
    if (!config.token) {
      return { valid: false, error: 'Moodle web service token is required' };
    }
    
    // Validate URL format
    try {
      new URL(config.baseUrl);
    } catch (error) {
      return { valid: false, error: 'Invalid Moodle base URL format' };
    }

    return { valid: true };
  }

  /**
   * Test Moodle connection
   * @param {Object} userConfig - User's Moodle configuration
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection(userConfig) {
    if (!this.validateConfig(userConfig).valid) {
      throw new Error('Invalid Moodle configuration');
    }

    try {
      const { baseUrl, token } = userConfig;
      const wsUrl = `${baseUrl}/webservice/rest/server.php`;

      const response = await axios.get(wsUrl, {
        params: {
          wstoken: token,
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json'
        }
      });

      if (response.data.errorcode) {
        throw new Error(response.data.message || 'Moodle connection failed');
      }

      return {
        success: true,
        siteName: response.data.sitename,
        username: response.data.username,
        userId: response.data.userid
      };
    } catch (error) {
      console.error('Moodle connection test error:', error.response?.data || error.message);
      throw new Error(`Failed to connect to Moodle: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Export notes to Moodle as a Page resource
   * @param {Object} notesData - Notes data to export
   * @param {Object} userConfig - User's Moodle configuration
   * @param {string} courseId - Moodle course ID
   * @returns {Promise<Object>} Export result
   */
  async exportNotes(notesData, userConfig, courseId) {
    if (!this.validateConfig(userConfig).valid) {
      throw new Error('Invalid Moodle configuration');
    }

    if (!courseId) {
      throw new Error('Moodle course ID is required');
    }

    try {
      const { baseUrl, token } = userConfig;
      const wsUrl = `${baseUrl}/webservice/rest/server.php`;

      const { videoTitle, shortNotes, detailedNotes } = notesData;

      // Create a Page resource in Moodle
      const content = `
        <h2>${videoTitle}</h2>
        <h3>Short Notes</h3>
        <p>${shortNotes.replace(/\n/g, '<br>')}</p>
        <h3>Detailed Notes</h3>
        <p>${detailedNotes.replace(/\n/g, '<br>')}</p>
      `;

      const response = await axios.post(wsUrl, null, {
        params: {
          wstoken: token,
          wsfunction: 'mod_page_add_page',
          moodlewsrestformat: 'json',
          pages: JSON.stringify([{
            course: courseId,
            name: `ILA Notes: ${videoTitle}`,
            intro: `Notes generated from ILA for: ${videoTitle}`,
            introformat: 1, // HTML format
            content: content,
            contentformat: 1, // HTML format
            display: 5, // Display on separate page
            displayoptions: 'a:0:{}'
          }])
        }
      });

      if (response.data.warnings && response.data.warnings.length > 0) {
        throw new Error(response.data.warnings[0].message);
      }

      if (response.data.pages && response.data.pages.length > 0) {
        return {
          success: true,
          pageId: response.data.pages[0].id,
          pageUrl: `${baseUrl}/mod/page/view.php?id=${response.data.pages[0].coursemodule}`,
          message: 'Notes exported to Moodle successfully'
        };
      }

      throw new Error('Failed to create Moodle page');
    } catch (error) {
      console.error('Moodle notes export error:', error.response?.data || error.message);
      throw new Error(`Failed to export to Moodle: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Export feedback to Moodle as a Forum post
   * @param {Object} feedbackData - Feedback data to export
   * @param {Object} userConfig - User's Moodle configuration
   * @param {string} courseId - Moodle course ID
   * @param {string} forumId - Moodle forum ID
   * @returns {Promise<Object>} Export result
   */
  async exportFeedback(feedbackData, userConfig, courseId, forumId) {
    if (!this.validateConfig(userConfig).valid) {
      throw new Error('Invalid Moodle configuration');
    }

    if (!courseId) {
      throw new Error('Moodle course ID is required');
    }

    if (!forumId) {
      throw new Error('Moodle forum ID is required');
    }

    try {
      const { baseUrl, token } = userConfig;
      const wsUrl = `${baseUrl}/webservice/rest/server.php`;

      const { summary, strengths, weaknesses, recommendations } = feedbackData;

      const message = `
        <h2>Assessment Feedback</h2>
        <p><strong>Summary:</strong> ${summary}</p>
        
        <h3>Strengths</h3>
        <ul>
          ${strengths.map(s => `<li>${s}</li>`).join('')}
        </ul>
        
        <h3>Areas for Improvement</h3>
        <ul>
          ${weaknesses.map(w => `<li>${w}</li>`).join('')}
        </ul>
        
        <h3>Recommendations</h3>
        <ul>
          ${recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      `;

      const response = await axios.post(wsUrl, null, {
        params: {
          wstoken: token,
          wsfunction: 'mod_forum_add_discussion_post',
          moodlewsrestformat: 'json',
          postid: 0, // New discussion
          subject: `ILA Feedback: Assessment ${feedbackData.assessmentId}`,
          message: message,
          messageformat: 1, // HTML format
          forumid: forumId
        }
      });

      if (response.data.warnings && response.data.warnings.length > 0) {
        throw new Error(response.data.warnings[0].message);
      }

      if (response.data.postid) {
        return {
          success: true,
          postId: response.data.postid,
          postUrl: `${baseUrl}/mod/forum/discuss.php?d=${response.data.discussionid}`,
          message: 'Feedback exported to Moodle successfully'
        };
      }

      throw new Error('Failed to create Moodle forum post');
    } catch (error) {
      console.error('Moodle feedback export error:', error.response?.data || error.message);
      throw new Error(`Failed to export feedback to Moodle: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get user's Moodle courses
   * @param {Object} userConfig - User's Moodle configuration
   * @returns {Promise<Array>} List of courses
   */
  async getUserCourses(userConfig) {
    if (!this.validateConfig(userConfig).valid) {
      throw new Error('Invalid Moodle configuration');
    }

    try {
      const { baseUrl, token } = userConfig;
      const wsUrl = `${baseUrl}/webservice/rest/server.php`;

      const response = await axios.get(wsUrl, {
        params: {
          wstoken: token,
          wsfunction: 'core_enrol_get_users_courses',
          moodlewsrestformat: 'json',
          userid: 0 // Current user
        }
      });

      if (response.data.errorcode) {
        throw new Error(response.data.message || 'Failed to fetch Moodle courses');
      }

      return response.data || [];
    } catch (error) {
      console.error('Moodle courses fetch error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch Moodle courses: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = new MoodlePlugin();


