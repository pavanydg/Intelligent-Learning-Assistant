const { validationResult } = require('express-validator');
const Transcript = require('../models/Transcript');
const assemblyaiService = require('../services/assemblyaiService');
const mergeService = require('../services/mergeService');
const geminiService = require('../services/geminiService');
const { transcriptionQueue } = require('../utils/asyncQueue');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * Get transcript for a video
 */
const getTranscript = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    console.log(`📄 Fetching transcript for video: ${videoId}`);
    
    // Try to get from cache first
    const cachedTranscript = await Transcript.findOne({ videoId });
    
    if (cachedTranscript && cachedTranscript.transcript && cachedTranscript.transcript.length > 50) {
      console.log('✅ Using cached transcript');
      await cachedTranscript.touchLastUsed();
      
      return res.json({
        success: true,
        data: {
          videoId: cachedTranscript.videoId,
          transcript: cachedTranscript.transcript,
          language: cachedTranscript.language,
          wordCount: cachedTranscript.wordCount,
          duration: cachedTranscript.duration,
          source: cachedTranscript.source,
          hasTranscript: true,
          cached: true,
          lastUsed: cachedTranscript.metadata.lastUsedAt
        }
      });
    }

    // If not in cache, generate new transcript
    console.log('🔄 Transcript not in cache, generating new one...');
    const transcriptData = await assemblyaiService.getTranscriptWithFallback(videoId);

    res.json({
      success: true,
      data: {
        videoId: transcriptData.videoId || videoId,
        transcript: transcriptData.transcript,
        language: transcriptData.language,
        wordCount: transcriptData.wordCount,
        duration: transcriptData.duration,
        source: transcriptData.source,
        hasTranscript: transcriptData.hasTranscript,
        cached: false
      }
    });

  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transcript',
      error: error.message
    });
  }
});

/**
 * Get all cached transcripts for a user (optional filtering)
 */
const getCachedTranscripts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, source } = req.query;

  try {
    const skip = (page - 1) * limit;
    const filter = {};
    
    if (source) {
      filter.source = source;
    }

    const transcripts = await Transcript.find(filter)
      .select('videoId language wordCount duration source metadata.lastUsedAt createdAt')
      .sort({ 'metadata.lastUsedAt': -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Transcript.countDocuments(filter);

    res.json({
      success: true,
      data: {
        transcripts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching cached transcripts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cached transcripts',
      error: error.message
    });
  }
});

/**
 * Delete a cached transcript
 */
const deleteTranscript = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    const result = await Transcript.findOneAndDelete({ videoId });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Transcript not found'
      });
    }

    res.json({
      success: true,
      message: 'Transcript deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting transcript:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete transcript',
      error: error.message
    });
  }
});

/**
 * Verify transcript storage for a video
 */
const verifyTranscript = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    const verification = await assemblyaiService.verifyTranscriptStorage(videoId);
    
    res.json({
      success: true,
      data: verification
    });

  } catch (error) {
    console.error('Error verifying transcript:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify transcript',
      error: error.message
    });
  }
});

/**
 * Get transcript statistics
 */
const getTranscriptStats = asyncHandler(async (req, res) => {
  try {
    const stats = await Transcript.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          totalWords: { $sum: '$wordCount' },
          avgWords: { $avg: '$wordCount' }
        }
      }
    ]);

    const totalTranscripts = await Transcript.countDocuments();
    const totalWords = await Transcript.aggregate([
      { $group: { _id: null, total: { $sum: '$wordCount' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalTranscripts,
        totalWords: totalWords[0]?.total || 0,
        bySource: stats,
        recentActivity: await Transcript.find()
          .select('videoId source metadata.lastUsedAt')
          .sort({ 'metadata.lastUsedAt': -1 })
          .limit(10)
      }
    });

  } catch (error) {
    console.error('Error fetching transcript stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transcript statistics',
      error: error.message
    });
  }
});

/**
 * Transcribe video with optional parallel chunking mode
 * POST /api/transcripts/transcribe
 * Body: { videoId: string, mode?: 'sequential' | 'parallel', generateEmbeddings?: boolean }
 */
const transcribeVideo = asyncHandler(async (req, res) => {
  const { videoId, mode = 'sequential', generateEmbeddings = false } = req.body;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    console.log(`📝 Starting transcription for video: ${videoId} (mode: ${mode})`);

    // Check cache first
    const cachedTranscript = await Transcript.findOne({ videoId });
    if (cachedTranscript && cachedTranscript.transcript && cachedTranscript.transcript.length > 50 && cachedTranscript.status === 'completed') {
      console.log('✅ Using cached transcript');
      await cachedTranscript.touchLastUsed();
      
      return res.json({
        success: true,
        data: {
          videoId,
          transcript: cachedTranscript.transcript,
          language: cachedTranscript.language,
          wordCount: cachedTranscript.wordCount,
          duration: cachedTranscript.duration,
          source: cachedTranscript.source,
          mode: cachedTranscript.processingMode,
          cached: true,
          hasEmbeddings: !!cachedTranscript.embeddings
        }
      });
    }

    // Sequential mode (original behavior)
    if (mode === 'sequential') {
      const transcriptData = await assemblyaiService.getTranscriptWithFallback(videoId);
      
      // Generate embeddings if requested
      let embeddings = null;
      if (generateEmbeddings && transcriptData.transcript) {
        try {
          embeddings = await geminiService.generateEmbeddings(transcriptData.transcript);
          // Update transcript with embeddings
          await Transcript.findOneAndUpdate(
            { videoId },
            { $set: { embeddings } }
          );
        } catch (embedError) {
          console.warn('⚠️ Failed to generate embeddings:', embedError.message);
        }
      }

      return res.json({
        success: true,
        data: {
          videoId,
          transcript: transcriptData.transcript,
          language: transcriptData.language,
          wordCount: transcriptData.wordCount,
          duration: transcriptData.duration,
          source: transcriptData.source,
          mode: 'sequential',
          cached: false,
          hasEmbeddings: !!embeddings
        }
      });
    }

    // Parallel mode (new optimized pipeline)
    if (mode === 'parallel') {
      // Step 1: Extract audio
      console.log('🎵 Step 1: Extracting audio...');
      const audioPath = await assemblyaiService.extractAudioFromYouTube(videoId);

      // Step 2: Get audio duration
      const totalDuration = await assemblyaiService.getAudioDuration(audioPath);
      
      // Step 3: Chunk audio (12 minutes per chunk)
      console.log('✂️ Step 2: Chunking audio...');
      const chunks = await assemblyaiService.chunkAudio(audioPath, 12);

      // Clean up original audio file after chunking (chunks are stored separately)
      try {
        const fs = require('fs');
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
          console.log('🧹 Cleaned up original audio file');
        }
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up original audio file:', cleanupError.message);
      }

      // Step 4: Create transcript document with chunk metadata
      const transcriptDoc = await Transcript.findOneAndUpdate(
        { videoId },
        {
          videoId,
          transcript: '', // Will be filled after merge
          status: 'processing',
          processingMode: 'parallel',
          chunks: chunks.map(chunk => ({
            chunkIndex: chunk.chunkIndex,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            status: 'pending'
          })),
          'metadata.totalChunks': chunks.length,
          'metadata.completedChunks': 0,
          'metadata.processingStartTime': new Date(),
          source: 'assemblyai'
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Step 5: Queue all chunks for parallel processing
      console.log(`📤 Step 3: Queueing ${chunks.length} chunks for parallel processing...`);
      const jobs = [];
      
      for (const chunk of chunks) {
        const job = await transcriptionQueue.add('transcribe-chunk', {
          videoId,
          chunkIndex: chunk.chunkIndex,
          chunkPath: chunk.path,
          startTime: chunk.startTime,
          endTime: chunk.endTime
        }, {
          priority: chunk.chunkIndex, // Process in order
          jobId: `${videoId}_chunk_${chunk.chunkIndex}`, // Unique job ID
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        });
        jobs.push(job.id);
      }

      console.log(`✅ Queued ${jobs.length} jobs for parallel processing`);

      // Return immediately with job status
      return res.json({
        success: true,
        data: {
          videoId,
          mode: 'parallel',
          status: 'processing',
          totalChunks: chunks.length,
          jobsQueued: jobs.length,
          message: 'Transcription started in parallel mode. Poll /api/transcripts/:videoId/status for progress.',
          estimatedCompletion: `~${Math.ceil(chunks.length * 2)} minutes` // Rough estimate
        }
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid mode. Use "sequential" or "parallel"'
    });

  } catch (error) {
    console.error('❌ Error transcribing video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to transcribe video',
      error: error.message
    });
  }
});

/**
 * Get transcription status (for parallel mode)
 * GET /api/transcripts/:videoId/status
 */
const getTranscriptionStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    const transcriptDoc = await Transcript.findOne({ videoId });
    
    if (!transcriptDoc) {
      return res.status(404).json({
        success: false,
        message: 'Transcription not found'
      });
    }

    // Check chunks status
    const chunksStatus = await mergeService.checkChunksStatus(videoId);

    // If all chunks are ready, trigger merge automatically
    if (chunksStatus.ready && transcriptDoc.status !== 'completed') {
      try {
        console.log('🔄 All chunks ready, triggering merge...');
        const mergedResult = await mergeService.mergeChunkTranscripts(videoId);
        
        // Generate embeddings if available
        if (mergedResult.transcript) {
          try {
            const embeddings = await geminiService.generateEmbeddings(mergedResult.transcript);
            await Transcript.findOneAndUpdate(
              { videoId },
              { $set: { embeddings } }
            );
            mergedResult.hasEmbeddings = true;
          } catch (embedError) {
            console.warn('⚠️ Failed to generate embeddings:', embedError.message);
          }
        }

        return res.json({
          success: true,
          data: {
            videoId,
            status: 'completed',
            transcript: mergedResult.transcript,
            language: mergedResult.language,
            wordCount: mergedResult.wordCount,
            duration: mergedResult.duration,
            mode: transcriptDoc.processingMode,
            chunks: chunksStatus,
            hasEmbeddings: !!transcriptDoc.embeddings
          }
        });
      } catch (mergeError) {
        console.error('❌ Error during merge:', mergeError);
        return res.status(500).json({
          success: false,
          message: 'Failed to merge chunks',
          error: mergeError.message
        });
      }
    }

    // Return current status
    res.json({
      success: true,
      data: {
        videoId,
        status: transcriptDoc.status,
        mode: transcriptDoc.processingMode,
        chunks: chunksStatus,
        transcript: transcriptDoc.status === 'completed' ? transcriptDoc.transcript : null,
        hasEmbeddings: !!transcriptDoc.embeddings
      }
    });

  } catch (error) {
    console.error('Error checking transcription status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check transcription status',
      error: error.message
    });
  }
});

module.exports = {
  getTranscript,
  getCachedTranscripts,
  deleteTranscript,
  verifyTranscript,
  getTranscriptStats,
  transcribeVideo,
  getTranscriptionStatus
};
