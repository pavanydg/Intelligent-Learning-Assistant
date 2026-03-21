require('dotenv').config();

const config = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY,
  assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY,
  youtubeApiKey: process.env.YOUTUBE_DATA_API_KEY,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Rate limiting configuration
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 500, // 500 requests per window default
};

// Validate required environment variables
const requiredVars = ['MONGO_URI', 'JWT_SECRET'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  process.exit(1);
}

module.exports = config;
