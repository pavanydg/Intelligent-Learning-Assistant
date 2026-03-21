const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const config = require('./config/env');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const youtubeRoutes = require('./routes/youtubeRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const progressRoutes = require('./routes/progressRoutes');
const playlistProgressRoutes = require('./routes/playlistProgressRoutes');
const notesRoutes = require('./routes/notesRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const transcriptRoutes = require('./routes/transcriptRoutes');
const completedCourseRoutes = require('./routes/completedCourseRoutes');
const integrationsRoutes = require('./routes/integrationsRoutes');
const proctoringRoutes = require('./routes/proctoringRoutes');
const syncRoutes = require('./routes/syncRoutes');
const chatRoutes = require('./routes/chatRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const quizRoutes = require('./routes/quizRoutes');
const classroomRoutes = require('./routes/classroomRoutes');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Initialize transcription worker for parallel chunk processing
// Worker runs in background and processes transcription jobs from queue
if (process.env.NODE_ENV !== 'test') {
  try {
    require('./workers/transcriptionWorker');
    console.log('✅ Transcription worker initialized');
  } catch (error) {
    console.error('⚠️ Failed to initialize transcription worker:', error.message);
    console.log('⚠️ Running without parallel transcription (sequential mode only)');
  }
}

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false, // Allow OAuth popups to communicate with parent window
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'"],
          connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://www.googleapis.com"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - configurable via environment variables
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs, // Default: 15 minutes (configurable via RATE_LIMIT_WINDOW_MS)
  max: config.rateLimitMax, // Default: 500 requests per window (configurable via RATE_LIMIT_MAX)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Prevent noisy 404s for favicon in dev
app.get('/favicon.ico', (req, res) => {
  // No favicon served by API server; return empty response
  res.status(204).end();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/playlist-progress', playlistProgressRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/transcripts', transcriptRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/completed-courses', completedCourseRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/proctoring', proctoringRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/classrooms', classroomRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Intelligent Learning Assistant API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      youtube: '/api/youtube',
      assessments: '/api/assessments',
      feedback: '/api/feedback',
      progress: '/api/progress',
      playlistProgress: '/api/playlist-progress',
      notes: '/api/notes',
      transcripts: '/api/transcripts',
      certificates: '/api/certificates',
      completedCourses: '/api/completed-courses',
      integrations: '/api/integrations',
      proctoring: '/api/proctoring',
      sync: '/api/sync'
    }
  });
});

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🌐 Client URL: ${config.clientUrl}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err.message);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});

module.exports = app;
