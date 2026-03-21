const youtubeService = require('./youtubeService');
const geminiService = require('./geminiService');

class TranscriptService {
  /**
   * Get transcript for a video and optionally summarize it
   * @param {string} videoId - YouTube video ID
   * @param {boolean} summarize - Whether to summarize the transcript
   * @returns {Promise<Object>} Transcript data
   */
  async getTranscript(videoId, summarize = false) {
    try {
      console.log(`Fetching transcript for video: ${videoId}`);
      
      // Get transcript with language detection
      const transcriptData = await youtubeService.getVideoTranscript(videoId);
      
      console.log('Transcript data received:', {
        hasTranscript: transcriptData?.hasTranscript,
        wordCount: transcriptData?.wordCount,
        language: transcriptData?.language
      });
      
      if (!transcriptData || !transcriptData.hasTranscript) {
        console.log('No transcript available for video:', videoId);
        throw new Error('No transcript available for this video');
      }

      const result = {
        videoId,
        transcript: transcriptData.transcript,
        language: transcriptData.language,
        wordCount: transcriptData.wordCount,
        duration: transcriptData.duration,
        hasTranscript: true
      };

      console.log('Transcript processed successfully:', {
        wordCount: result.wordCount,
        language: result.language,
        hasTranscript: result.hasTranscript
      });

      // Summarize if requested (always in English)
      if (summarize) {
        try {
          result.summary = await geminiService.summarizeTranscript(transcriptData.transcript, transcriptData.language);
        } catch (error) {
          console.error('Summarization error:', error.message);
          result.summary = transcriptData.transcript.substring(0, 500) + '...';
        }
      }

      return result;

    } catch (error) {
      console.error('Transcript service error for video:', videoId, error.message);
      console.error('Full error:', error);
      
      // Return a fallback transcript instead of throwing error
      return {
        videoId,
        transcript: 'This video does not have a transcript available. Please try another video.',
        language: 'en',
        wordCount: 0,
        duration: 0,
        hasTranscript: false
      };
    }
  }

  /**
   * Extract key concepts from transcript
   * @param {string} transcript - Video transcript
   * @returns {Array} Key concepts
   */
  extractKeyConcepts(transcript) {
    // Simple keyword extraction
    const words = transcript
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4);

    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Get most frequent words
    const concepts = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    return concepts;
  }

  /**
   * Extract timestamps for key concepts
   * @param {string} transcript - Video transcript with timestamps
   * @returns {Array} Timestamped concepts
   */
  extractTimestampedConcepts(transcript) {
    // This would require more sophisticated parsing of timestamped transcripts
    // For now, return basic concept extraction
    const concepts = this.extractKeyConcepts(transcript);
    
    return concepts.map(concept => ({
      concept,
      timestamp: Math.floor(Math.random() * 3600), // Placeholder timestamp
      confidence: Math.random() * 0.5 + 0.5 // Placeholder confidence
    }));
  }

  /**
   * Check if transcript is suitable for question generation
   * @param {string} transcript - Video transcript
   * @returns {Object} Suitability analysis
   */
  analyzeTranscriptQuality(transcript) {
    const wordCount = transcript.split(' ').length;
    const sentenceCount = transcript.split(/[.!?]+/).length;
    const avgWordsPerSentence = wordCount / sentenceCount;

    let quality = 'poor';
    let issues = [];

    if (wordCount < 100) {
      issues.push('Transcript too short');
    } else if (wordCount > 10000) {
      issues.push('Transcript very long');
    }

    if (avgWordsPerSentence < 5) {
      issues.push('Sentences too short');
    } else if (avgWordsPerSentence > 30) {
      issues.push('Sentences too long');
    }

    if (wordCount >= 200 && wordCount <= 5000 && avgWordsPerSentence >= 8 && avgWordsPerSentence <= 20) {
      quality = 'excellent';
    } else if (wordCount >= 100 && wordCount <= 8000 && avgWordsPerSentence >= 6 && avgWordsPerSentence <= 25) {
      quality = 'good';
    } else if (wordCount >= 50 && wordCount <= 10000) {
      quality = 'fair';
    }

    return {
      quality,
      wordCount,
      sentenceCount,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
      issues,
      suitable: quality !== 'poor'
    };
  }

  /**
   * Clean and normalize transcript
   * @param {string} transcript - Raw transcript
   * @returns {string} Cleaned transcript
   */
  cleanTranscript(transcript) {
    return transcript
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/[^\w\s.,!?;:]/g, '') // Remove special characters except basic punctuation
      .trim();
  }

  /**
   * Split transcript into chunks for processing
   * @param {string} transcript - Video transcript
   * @param {number} chunkSize - Maximum chunk size in characters
   * @returns {Array} Transcript chunks
   */
  splitTranscript(transcript, chunkSize = 2000) {
    const chunks = [];
    const sentences = transcript.split(/[.!?]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

module.exports = new TranscriptService();
