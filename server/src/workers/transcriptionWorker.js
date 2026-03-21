const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const assemblyaiService = require('../services/assemblyaiService');
const Transcript = require('../models/Transcript');

/**
 * BullMQ Worker for processing transcription chunks in parallel
 * Each worker processes one chunk: upload -> create transcript -> poll -> update DB
 */
const transcriptionWorker = new Worker(
  'transcription',
  async (job) => {
    const { videoId, chunkIndex, chunkPath, startTime, endTime } = job.data;
    
    console.log(`🔧 Worker processing chunk ${chunkIndex} for video ${videoId}`);
    const startTimeMs = Date.now();

    try {
      // Update chunk status to processing
      await Transcript.findOneAndUpdate(
        { videoId, 'chunks.chunkIndex': chunkIndex },
        {
          $set: {
            'chunks.$.status': 'processing',
            'chunks.$.uploadedAt': new Date(),
            status: 'processing'
          }
        }
      );

      // Step 1: Upload chunk to AssemblyAI
      console.log(`📤 [Chunk ${chunkIndex}] Uploading to AssemblyAI...`);
      const uploadUrl = await assemblyaiService.uploadChunk(chunkPath);

      // Step 2: Create transcription request
      console.log(`🎙️ [Chunk ${chunkIndex}] Creating transcription request...`);
      const transcriptId = await assemblyaiService.createChunkTranscript(uploadUrl, {
        chunkIndex,
        startTime,
        endTime
      });

      // Step 3: Poll for completion
      console.log(`🔍 [Chunk ${chunkIndex}] Polling for transcription...`);
      const result = await assemblyaiService.pollChunkTranscript(transcriptId);

      // Step 4: Update transcript document with chunk result
      const updateResult = await Transcript.findOneAndUpdate(
        { videoId, 'chunks.chunkIndex': chunkIndex },
        {
          $set: {
            'chunks.$.transcriptId': transcriptId,
            'chunks.$.transcript': result.text,
            'chunks.$.language': result.language,
            'chunks.$.status': 'completed',
            'chunks.$.completedAt': new Date()
          },
          $inc: {
            'metadata.completedChunks': 1
          }
        },
        { new: true }
      );

      if (!updateResult) {
        throw new Error(`Failed to update transcript document for chunk ${chunkIndex}`);
      }

      // Step 5: Clean up chunk file after successful processing
      try {
        const fs = require('fs');
        if (fs.existsSync(chunkPath)) {
          fs.unlinkSync(chunkPath);
          console.log(`🧹 [Chunk ${chunkIndex}] Cleaned up chunk file`);
        }
      } catch (cleanupError) {
        console.warn(`⚠️ [Chunk ${chunkIndex}] Failed to clean up chunk file:`, cleanupError.message);
      }

      const processingTime = Date.now() - startTimeMs;
      console.log(`✅ [Chunk ${chunkIndex}] Completed in ${processingTime}ms`);

      return {
        success: true,
        chunkIndex,
        transcriptId,
        transcript: result.text,
        language: result.language,
        processingTime
      };

    } catch (error) {
      console.error(`❌ [Chunk ${chunkIndex}] Error:`, error.message);

      // Update chunk status to failed
      await Transcript.findOneAndUpdate(
        { videoId, 'chunks.chunkIndex': chunkIndex },
        {
          $set: {
            'chunks.$.status': 'failed',
            'chunks.$.error': error.message,
            'chunks.$.completedAt': new Date()
          }
        }
      );

      throw error; // Re-throw to mark job as failed
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 chunks in parallel
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // per second (rate limiting)
    },
  }
);

// Worker event listeners for monitoring
transcriptionWorker.on('completed', (job) => {
  console.log(`✅ Worker completed job ${job.id} - chunk ${job.data.chunkIndex}`);
});

transcriptionWorker.on('failed', (job, err) => {
  console.error(`❌ Worker failed job ${job?.id} - chunk ${job?.data?.chunkIndex}:`, err.message);
});

transcriptionWorker.on('error', (err) => {
  console.error('❌ Transcription worker error:', err);
});

console.log('✅ Transcription worker started and ready to process jobs');

module.exports = transcriptionWorker;

