const { Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');

// Create transcription queue for parallel chunk processing
const transcriptionQueue = new Queue('transcription', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});

// Queue event listeners for monitoring
transcriptionQueue.on('error', (error) => {
  console.error('❌ Transcription queue error:', error);
});

transcriptionQueue.on('waiting', (jobId) => {
  console.log(`⏳ Job ${jobId} is waiting`);
});

transcriptionQueue.on('active', (job) => {
  console.log(`🔄 Processing job ${job.id} - chunk ${job.data.chunkIndex || 'unknown'}`);
});

transcriptionQueue.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

transcriptionQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

module.exports = {
  transcriptionQueue,
};

