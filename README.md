# 🧠 Intelligent Learning Assistant (ILA)

An AI-powered adaptive learning platform that sources educational videos from YouTube playlists, generates automated assessments from their transcripts, measures cognitive load during assessments using webcam-based attention tracking, and produces personalized feedback and adaptive recommendations.

## 🚀 Features

### Core Functionality
- **YouTube Integration**: Search and fetch educational playlists and videos
- **AI-Powered Question Generation**: Automatically generate questions from video transcripts using Gemini API (OpenAI removed)
- **Cognitive Load Tracking**: Real-time webcam-based attention monitoring using MediaPipe
- **Personalized Feedback**: AI-generated feedback based on performance and cognitive metrics
- **Adaptive Recommendations**: Suggest new learning content based on weak areas
- **Progress Dashboard**: Visualize learning trends and cognitive load patterns

### Technical Features
- **JWT Authentication**: Secure user management with role-based access
- **Real-time Metrics**: Webcam-based cognitive load measurement
- **Responsive Design**: Modern UI with TailwindCSS
- **Chart Visualization**: Interactive charts for performance tracking
- **RESTful API**: Well-structured backend with Express.js
- **MongoDB Integration**: Scalable data storage with Mongoose

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **TailwindCSS** for styling
- **React Router** for navigation
- **Zustand** for state management
- **Chart.js** for data visualization
- **MediaPipe** for webcam tracking
- **React Hook Form** for form handling

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **JWT** for authentication
- **Gemini API** for AI features (notes, assessments, summaries)
- **YouTube Data API** for content fetching
- **youtube-transcript-api** for transcript extraction

### AI/ML
- **Gemini** for question generation and feedback
- **MediaPipe FaceMesh** for cognitive load tracking
- **Custom CLI Algorithm** for cognitive load computation

## 📁 Project Structure

```
intelligent-learning-assistant/
├── client/                      # React Frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/              # App pages
│   │   ├── services/           # API utilities
│   │   ├── store/              # State management
│   │   ├── utils/              # Helper functions
│   │   └── App.tsx
│   └── package.json
├── server/                      # Node.js Backend
│   ├── src/
│   │   ├── config/             # Database and environment config
│   │   ├── controllers/        # Route controllers
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # Express routes
│   │   ├── services/           # Business logic
│   │   ├── middlewares/        # Custom middlewares
│   │   ├── utils/              # Helper functions
│   │   └── server.js
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account
- OpenAI API key
- YouTube Data API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd intelligent-learning-assistant
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install server dependencies
   cd server && npm install
   
   # Install client dependencies
   cd ../client && npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp env.example .env
   
   # Edit .env with your credentials
   nano .env
   ```

4. **Configure Environment Variables**
   ```env
   # Server Configuration
   PORT=4000
   NODE_ENV=development
   
   # Database
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/ila-db
   
   # Authentication
   JWT_SECRET=your-super-secret-jwt-key-here
   
   # External APIs
   OPENAI_API_KEY=sk-your-openai-api-key-here
   YOUTUBE_DATA_API_KEY=your-youtube-data-api-key-here
   
   # CORS
   CLIENT_URL=http://localhost:5173
   ```

5. **Start the development servers**
   ```bash
   # From root directory
   npm run dev
   
   # Or start individually
   npm run server  # Backend on port 4000
   npm run client  # Frontend on port 5173
   ```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile

### YouTube Integration
- `GET /api/youtube/search` - Search playlists
- `GET /api/youtube/playlist/:id` - Get playlist details
- `GET /api/youtube/course/:id` - Get course information
- `GET /api/youtube/video/:id/transcript` - Get video transcript

### Assessments
- `POST /api/assessments/start` - Start new assessment
- `POST /api/assessments/:id/metrics` - Submit cognitive metrics
- `POST /api/assessments/:id/complete` - Complete assessment
- `GET /api/assessments/:id/results` - Get assessment results

### Feedback
- `GET /api/feedback/assessment/:id` - Get assessment feedback
- `GET /api/feedback/user/:userId/history` - Get feedback history
- `GET /api/feedback/user/:userId/recommendations` - Get learning recommendations

## 🧠 Cognitive Load Index (CLI)

The system uses a sophisticated algorithm to compute cognitive load:

```javascript
CLI = 0.35*(100-focusPct) + 0.35*confusionPct + 0.2*blinkNorm + 0.1*timePressure
```

**Ranges:**
- **Low Load (0-35)**: Comfortable learning pace
- **Moderate Load (36-70)**: Optimal challenge level  
- **High Load (71-100)**: Cognitive overload

## 🎯 Key Features Explained

### 1. AI Question Generation
- Extracts transcripts from YouTube videos
- Uses OpenAI GPT-4 to generate contextually relevant questions
- Supports multiple difficulty levels
- Fallback to template-based generation if API unavailable

### 2. Cognitive Load Tracking
- Real-time webcam monitoring during assessments
- Tracks focus percentage, blink rate, head movement
- Computes personalized cognitive load index
- Provides insights for learning optimization

### 3. Personalized Feedback
- Combines test scores with cognitive metrics
- Generates actionable recommendations
- Suggests learning paths based on performance
- Identifies strengths and improvement areas

### 4. Adaptive Recommendations
- Analyzes weak topics and high cognitive load areas
- Suggests new YouTube playlists via keyword matching
- Provides personalized learning strategies
- Tracks progress over time

## 🧪 Testing

```bash
# Run server tests
cd server && npm test

# Run client tests  
cd client && npm test

# Run all tests
npm test
```

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in production mode
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Database Schema

### Users
```javascript
{
  name: String,
  email: String (unique),
  passwordHash: String,
  role: 'student' | 'instructor' | 'admin',
  preferences: {
    learningStyle: String,
    difficultyLevel: String
  }
}
```

### Courses
```javascript
{
  playlistId: String (unique),
  title: String,
  description: String,
  thumbnail: String,
  videos: [VideoSchema],
  tags: [String],
  difficulty: String,
  metadata: Object
}
```

### Assessments
```javascript
{
  userId: ObjectId,
  courseId: ObjectId,
  testScore: Number,
  cli: Number,
  cliClassification: String,
  answers: [AnswerSchema],
  metrics: [MetricSchema],
  feedback: Object
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the future of education**
