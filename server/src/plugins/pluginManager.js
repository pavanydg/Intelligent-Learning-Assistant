/**
 * Plugin Manager - Dynamically loads and manages integration plugins
 * Supports Notion, Google Docs, and Moodle integrations
 */

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.loadPlugins();
  }

  /**
   * Load all available plugins
   */
  loadPlugins() {
    // Load Notion plugin
    try {
      const notionPlugin = require('./notionPlugin');
      this.plugins.set('notion', notionPlugin);
      console.log('✅ Loaded Notion plugin');
    } catch (error) {
      console.error('❌ Failed to load Notion plugin:', error.message);
    }

    // Load Google Docs plugin
    try {
      const googleDocsPlugin = require('./googleDocsPlugin');
      this.plugins.set('googledocs', googleDocsPlugin);
      console.log('✅ Loaded Google Docs plugin');
    } catch (error) {
      console.error('❌ Failed to load Google Docs plugin:', error.message);
      if (error.message.includes('googleapis')) {
        console.error('   → Install missing dependency: npm install googleapis');
      }
    }

    // Load Moodle plugin
    try {
      const moodlePlugin = require('./moodlePlugin');
      this.plugins.set('moodle', moodlePlugin);
      console.log('✅ Loaded Moodle plugin');
    } catch (error) {
      console.error('❌ Failed to load Moodle plugin:', error.message);
    }

    console.log(`✅ Loaded ${this.plugins.size} integration plugin(s) total`);
  }

  /**
   * Get a plugin by name
   * @param {string} pluginName - Name of the plugin (notion, googledocs, moodle)
   * @returns {Object|null} Plugin instance or null if not found
   */
  getPlugin(pluginName) {
    const normalizedName = pluginName.toLowerCase().replace(/\s+/g, '');
    return this.plugins.get(normalizedName) || null;
  }

  /**
   * Get all available plugins
   * @returns {Array} Array of plugin names
   */
  getAvailablePlugins() {
    return Array.from(this.plugins.keys());
  }

  /**
   * Check if a plugin is available
   * @param {string} pluginName - Name of the plugin
   * @returns {boolean} True if plugin exists
   */
  hasPlugin(pluginName) {
    const normalizedName = pluginName.toLowerCase().replace(/\s+/g, '');
    return this.plugins.has(normalizedName);
  }

  /**
   * Validate plugin configuration
   * @param {string} pluginName - Name of the plugin
   * @param {Object} config - Plugin configuration
   * @returns {Object} Validation result
   */
  validatePluginConfig(pluginName, config) {
    const plugin = this.getPlugin(pluginName);
    if (!plugin) {
      return { valid: false, error: 'Plugin not found' };
    }

    if (plugin.validateConfig && typeof plugin.validateConfig === 'function') {
      return plugin.validateConfig(config);
    }

    return { valid: true };
  }
}

// Export singleton instance
module.exports = new PluginManager();


