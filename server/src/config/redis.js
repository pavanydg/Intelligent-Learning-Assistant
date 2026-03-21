const Redis = require('ioredis');
const config = require('./env');

// Create Redis connection for BullMQ
const redisConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisConnection.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

redisConnection.on('close', () => {
  console.log('⚠️  Redis connection closed');
});

module.exports = {
  redisConnection,
};

