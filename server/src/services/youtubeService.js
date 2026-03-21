const axios = require('axios');
const { YoutubeTranscript } = require('youtube-transcript');
const Course = require('../models/Course');

class YouTubeService {
  constructor() {
    this.apiKey = process.env.YOUTUBE_DATA_API_KEY;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  /**
   * Search for playlists by query
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results to return
   * @returns {Promise<Array>} Search results
   */
  async searchPlaylists(query, maxResults = 10) {
    try {
      if (!this.apiKey) {
        throw new Error('YouTube API key not configured');
      }

      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          part: 'snippet',
          type: 'playlist',
          q: query,
          maxResults,
          key: this.apiKey
        }
      });

      return response.data.items.map(item => ({
        playlistId: item.id.playlistId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt
      }));

    } catch (error) {
      console.error('YouTube search error:', error.message);
      throw new Error('Failed to search YouTube playlists');
    }
  }

  /**
   * Get playlist details and videos
   * @param {string} playlistId - YouTube playlist ID
   * @returns {Promise<Object>} Playlist with videos
   */
  async getPlaylistDetails(playlistId) {
    try {
      if (!this.apiKey) {
        throw new Error('YouTube API key not configured');
      }

      console.log(`🔍 Fetching playlist details for: ${playlistId}`);
      console.log(`🔑 Using API key: ${this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'NOT SET'}`);

      // Get playlist info
      const playlistResponse = await axios.get(`${this.baseUrl}/playlists`, {
        params: {
          part: 'snippet,contentDetails',
          id: playlistId,
          key: this.apiKey
        }
      });

      console.log(`📊 Playlist API response status: ${playlistResponse.status}`);
      console.log(`📊 Playlist API response items: ${playlistResponse.data.items?.length || 0}`);

      if (!playlistResponse.data.items.length) {
        throw new Error('Playlist not found');
      }

      const playlist = playlistResponse.data.items[0];

      // Get playlist items (videos)
      const videosResponse = await axios.get(`${this.baseUrl}/playlistItems`, {
        params: {
          part: 'snippet,contentDetails',
          playlistId,
          maxResults: 50,
          key: this.apiKey
        }
      });

      const videos = videosResponse.data.items.map(item => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        duration: item.contentDetails?.duration || 'PT0S',
        description: item.snippet.description
      }));

      return {
        playlistId,
        title: playlist.snippet.title,
        description: playlist.snippet.description,
        thumbnail: playlist.snippet.thumbnails.medium?.url || playlist.snippet.thumbnails.default?.url,
        channelTitle: playlist.snippet.channelTitle,
        videos,
        metadata: {
          totalVideos: videos.length,
          totalDuration: this.calculateTotalDuration(videos)
        }
      };

    } catch (error) {
      console.error('YouTube playlist error:', error.message);
      
      // Provide more specific error messages
      if (error.response?.status === 403) {
        throw new Error('YouTube API quota exceeded or API key invalid');
      } else if (error.response?.status === 404) {
        throw new Error('Playlist not found or is private');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid playlist ID format');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Network error connecting to YouTube API');
      } else {
        throw new Error(`Failed to fetch playlist details: ${error.message}`);
      }
    }
  }

  /**
   * Get video transcript with language detection
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Video transcript with language info
   */
  async getVideoTranscript(videoId) {
    try {
      // Use AssemblyAI for reliable transcript generation
      const assemblyaiService = require('./assemblyaiService');
      return await assemblyaiService.getTranscriptWithFallback(videoId);
    } catch (error) {
      console.error('Transcript fetch error:', error.message);
      throw new Error('Failed to fetch video transcript');
    }
  }

  /**
   * Get transcript from your custom platform
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Custom transcript data
   */
  async getCustomTranscript(videoId) {
    try {
      // TODO: Replace with your actual transcript platform API
      const response = await axios.post('YOUR_TRANSCRIPT_API_ENDPOINT', {
        videoId: videoId,
        // Add any required parameters for your platform
      }, {
        headers: {
          'Authorization': 'Bearer YOUR_API_KEY', // If needed
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.transcript) {
        const transcript = response.data.transcript;
        const detectedLanguage = this.detectLanguage(transcript);
        
        return {
          transcript: transcript,
          language: detectedLanguage,
          wordCount: transcript.split(' ').length,
          duration: transcript.length,
          hasTranscript: true,
          source: 'custom_platform'
        };
      }

      return null;
    } catch (error) {
      console.error('Custom transcript platform error:', error.message);
      return null;
    }
  }

  /**
   * Detect language from transcript text
   * @param {string} text - Transcript text
   * @returns {string} Detected language code
   */
  detectLanguage(text) {
    // Simple language detection based on common patterns
    const languagePatterns = {
      'en': /[a-zA-Z]/g, // English
      'hi': /[\u0900-\u097F]/g, // Hindi
      'zh': /[\u4E00-\u9FFF]/g, // Chinese
      'ja': /[\u3040-\u309F\u30A0-\u30FF]/g, // Japanese
      'ko': /[\uAC00-\uD7AF]/g, // Korean
      'ar': /[\u0600-\u06FF]/g, // Arabic
      'es': /[ñáéíóúü]/gi, // Spanish
      'fr': /[àâäéèêëïîôöùûüÿç]/gi, // French
      'de': /[äöüß]/gi, // German
      'ru': /[\u0400-\u04FF]/g, // Russian
      'pt': /[ãõç]/gi, // Portuguese
      'it': /[àèéìíîòóù]/gi, // Italian
    };

    const scores = {};
    
    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      const matches = text.match(pattern);
      scores[lang] = matches ? matches.length : 0;
    }

    // Find language with highest score
    const detectedLang = Object.entries(scores).reduce((a, b) => 
      scores[a[0]] > scores[b[0]] ? a : b
    )[0];

    return scores[detectedLang] > 0 ? detectedLang : 'en'; // Default to English
  }

  /**
   * Save or update course in database
   * @param {Object} playlistData - Playlist data from YouTube
   * @returns {Promise<Object>} Saved course
   */
  async saveCourse(playlistData) {
    try {
      const existingCourse = await Course.findOne({ playlistId: playlistData.playlistId });
      
      if (existingCourse) {
        // Update existing course
        existingCourse.title = playlistData.title;
        existingCourse.description = playlistData.description;
        existingCourse.thumbnail = playlistData.thumbnail;
        existingCourse.channelTitle = playlistData.channelTitle;
        existingCourse.videos = playlistData.videos;
        existingCourse.metadata = playlistData.metadata;
        
        await existingCourse.save();
        return existingCourse;
      } else {
        // Create new course
        const course = new Course({
          playlistId: playlistData.playlistId,
          title: playlistData.title,
          description: playlistData.description,
          thumbnail: playlistData.thumbnail,
          channelTitle: playlistData.channelTitle,
          videos: playlistData.videos,
          metadata: playlistData.metadata,
          tags: this.extractTags(playlistData.title, playlistData.description)
        });

        await course.save();
        return course;
      }

    } catch (error) {
      console.error('Save course error:', error.message);
      throw new Error('Failed to save course');
    }
  }

  /**
   * Extract tags from title and description
   * @param {string} title - Course title
   * @param {string} description - Course description
   * @returns {Array} Extracted tags
   */
  extractTags(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'];
    
    const words = text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.includes(word))
      .slice(0, 10);

    return [...new Set(words)];
  }

  /**
   * Calculate total duration from video durations
   * @param {Array} videos - Array of video objects
   * @returns {string} Total duration in HH:MM:SS format
   */
  calculateTotalDuration(videos) {
    const totalSeconds = videos.reduce((total, video) => {
      const duration = this.parseDuration(video.duration);
      return total + duration;
    }, 0);

    return this.formatDuration(totalSeconds);
  }

  /**
   * Parse ISO 8601 duration to seconds
   * @param {string} duration - ISO 8601 duration (e.g., PT1H30M15S)
   * @returns {number} Duration in seconds
   */
  parseDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Format seconds to HH:MM:SS
   * @param {number} seconds - Total seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Get video details by video ID
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Video details
   */
  async getVideoDetails(videoId) {
    try {
      if (!this.apiKey) {
        throw new Error('YouTube API key not configured');
      }

      const response = await axios.get(`${this.baseUrl}/videos`, {
        params: {
          part: 'snippet,contentDetails',
          id: videoId,
          key: this.apiKey
        }
      });

      if (response.data.items.length === 0) {
        throw new Error('Video not found');
      }

      const video = response.data.items[0];
      const duration = this.parseDuration(video.contentDetails.duration);

      return {
        id: videoId,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails.maxres?.url || 
                   video.snippet.thumbnails.medium?.url || 
                   video.snippet.thumbnails.default?.url,
        duration: duration,
        channelTitle: video.snippet.channelTitle,
        publishedAt: video.snippet.publishedAt
      };

    } catch (error) {
      console.error('YouTube video details error:', error.message);
      throw new Error('Failed to fetch video details');
    }
  }
}

module.exports = new YouTubeService();
