const Transcript = require('../models/Transcript');

class MergeService {
  /**
   * Merge chunk transcripts into a single transcript
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Merged transcript data
   */
  async mergeChunkTranscripts(videoId) {
    try {
      console.log(`🔗 Merging chunks for video: ${videoId}`);
      
      // Get transcript document with chunks
      const transcriptDoc = await Transcript.findOne({ videoId });
      
      if (!transcriptDoc) {
        throw new Error(`Transcript document not found for video: ${videoId}`);
      }

      if (!transcriptDoc.chunks || transcriptDoc.chunks.length === 0) {
        throw new Error(`No chunks found for video: ${videoId}`);
      }

      // Sort chunks by chunkIndex to ensure correct order
      const sortedChunks = [...transcriptDoc.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Check if all chunks are completed
      const completedChunks = sortedChunks.filter(chunk => chunk.status === 'completed');
      const failedChunks = sortedChunks.filter(chunk => chunk.status === 'failed');

      console.log(`📊 Chunks status: ${completedChunks.length}/${sortedChunks.length} completed, ${failedChunks.length} failed`);

      if (failedChunks.length > 0) {
        console.warn(`⚠️ ${failedChunks.length} chunks failed. Merging available chunks.`);
      }

      if (completedChunks.length === 0) {
        throw new Error('No completed chunks to merge');
      }

      // Merge transcripts in order
      const mergedTranscript = this.mergeTranscriptText(completedChunks);
      const totalDuration = sortedChunks.reduce((sum, chunk) => sum + (chunk.endTime - chunk.startTime), 0);
      const wordCount = mergedTranscript.split(/\s+/).filter(word => word.length > 0).length;
      
      // Detect dominant language from completed chunks
      const languages = completedChunks.map(chunk => chunk.language || 'en').filter(Boolean);
      const dominantLanguage = this.getDominantLanguage(languages);

      console.log(`✅ Merged ${completedChunks.length} chunks:`, {
        totalWords: wordCount,
        totalDuration: totalDuration,
        language: dominantLanguage,
        transcriptLength: mergedTranscript.length
      });

      // Calculate processing duration
      const processingStartTime = transcriptDoc.metadata.processingStartTime?.getTime() || Date.now();
      const processingDuration = Date.now() - processingStartTime;

      // Update transcript document with merged result
      const updatedDoc = await Transcript.findOneAndUpdate(
        { videoId },
        {
          $set: {
            transcript: mergedTranscript,
            language: dominantLanguage,
            wordCount: wordCount,
            duration: totalDuration,
            status: failedChunks.length === 0 ? 'completed' : 'completed', // Mark as completed even with some failures
            'metadata.completedChunks': completedChunks.length,
            'metadata.processingEndTime': new Date(),
            'metadata.processingDuration': processingDuration
          }
        },
        { new: true }
      );

      // Note: Chunk files are cleaned up by workers after processing
      // If needed, chunk files can be cleaned up by reconstructing paths:
      // path.join(tempDir, 'chunks', `${videoId}_chunk_${chunkIndex}.mp3`)
      // For now, temp files will be cleaned up by OS or periodic cleanup job

      if (!updatedDoc) {
        throw new Error('Failed to update transcript document after merge');
      }

      return {
        videoId,
        transcript: mergedTranscript,
        language: dominantLanguage,
        wordCount,
        duration: totalDuration,
        totalChunks: sortedChunks.length,
        completedChunks: completedChunks.length,
        failedChunks: failedChunks.length,
        chunks: sortedChunks.map(chunk => ({
          chunkIndex: chunk.chunkIndex,
          status: chunk.status,
          startTime: chunk.startTime,
          endTime: chunk.endTime
        }))
      };

    } catch (error) {
      console.error(`❌ Error merging chunks for video ${videoId}:`, error);
      throw new Error(`Failed to merge chunk transcripts: ${error.message}`);
    }
  }

  /**
   * Merge transcript text from chunks
   * @param {Array} chunks - Array of chunk objects with transcript text
   * @returns {string} Merged transcript text
   */
  mergeTranscriptText(chunks) {
    const texts = chunks
      .filter(chunk => chunk.transcript && chunk.transcript.trim().length > 0)
      .map(chunk => chunk.transcript.trim());

    if (texts.length === 0) {
      return '';
    }

    // Join with spaces and clean up
    let merged = texts.join(' ');

    // Clean up common issues
    merged = merged
      // Remove multiple consecutive spaces
      .replace(/\s+/g, ' ')
      // Remove spaces before punctuation
      .replace(/\s+([.,!?;:])/g, '$1')
      // Add space after punctuation if missing
      .replace(/([.,!?;:])([A-Za-z])/g, '$1 $2')
      // Remove leading/trailing whitespace
      .trim();

    return merged;
  }

  /**
   * Get dominant language from array of language codes
   * @param {Array} languages - Array of language codes
   * @returns {string} Dominant language code
   */
  getDominantLanguage(languages) {
    if (languages.length === 0) return 'en';

    const counts = {};
    languages.forEach(lang => {
      counts[lang] = (counts[lang] || 0) + 1;
    });

    return Object.entries(counts).reduce((a, b) => 
      counts[a[0]] > counts[b[0]] ? a : b
    )[0];
  }

  /**
   * Check if all chunks are completed and ready to merge
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Status check result
   */
  async checkChunksStatus(videoId) {
    try {
      const transcriptDoc = await Transcript.findOne({ videoId });
      
      if (!transcriptDoc || !transcriptDoc.chunks || transcriptDoc.chunks.length === 0) {
        return {
          ready: false,
          totalChunks: 0,
          completedChunks: 0,
          failedChunks: 0,
          processingChunks: 0,
          pendingChunks: 0
        };
      }

      const totalChunks = transcriptDoc.chunks.length;
      const completedChunks = transcriptDoc.chunks.filter(c => c.status === 'completed').length;
      const failedChunks = transcriptDoc.chunks.filter(c => c.status === 'failed').length;
      const processingChunks = transcriptDoc.chunks.filter(c => c.status === 'processing').length;
      const pendingChunks = transcriptDoc.chunks.filter(c => c.status === 'pending').length;

      // Ready to merge if at least one chunk is completed and no chunks are processing
      const ready = completedChunks > 0 && processingChunks === 0 && 
                    (completedChunks + failedChunks === totalChunks);

      return {
        ready,
        totalChunks,
        completedChunks,
        failedChunks,
        processingChunks,
        pendingChunks,
        completionPercentage: totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0
      };
    } catch (error) {
      console.error(`Error checking chunks status:`, error);
      return {
        ready: false,
        error: error.message
      };
    }
  }
}

module.exports = new MergeService();

