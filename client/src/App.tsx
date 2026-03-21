import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useEffect, useState } from 'react'

// Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import StudentLoginPage from './pages/StudentLoginPage'
import TeacherLoginPage from './pages/TeacherLoginPage'
import StudentSignupPage from './pages/StudentSignupPage'
import TeacherSignupPage from './pages/TeacherSignupPage'
import SearchPage from './pages/SearchPage'
import PlaylistPage from './pages/PlaylistPage'
import VideoPlayerPage from './pages/VideoPlayerPage'
import AssessmentPage from './pages/AssessmentPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import CompletedPage from './pages/CompletedPage'
import IntegrationsPage from './pages/IntegrationsPage'
import GoogleDocsCallbackPage from './pages/GoogleDocsCallbackPage'
import CoursesPage from './pages/CoursesPage'
import TestScoresPage from './pages/TestScoresPage'
import TeacherDashboardPage from './pages/TeacherDashboardPage'
import CourseAnalyticsPage from './pages/CourseAnalyticsPage'
import CourseKeyAnalyticsPage from './pages/CourseKeyAnalyticsPage'
import QuizPage from './pages/QuizPage'
import CreateQuizPage from './pages/CreateQuizPage'
import TakeQuizPage from './pages/TakeQuizPage'
import QuizAnalyticsPage from './pages/QuizAnalyticsPage'
import QuizHistoryPage from './pages/QuizHistoryPage'
import QuizAttemptDetailsPage from './pages/QuizAttemptDetailsPage'
import QuizTerminatedPage from './pages/QuizTerminatedPage'
import ClassroomPage from './pages/ClassroomPage'
import JoinClassroomPage from './pages/JoinClassroomPage'
import ClassroomViewPage from './pages/ClassroomViewPage'

// Components
import Navbar from './components/Navbar'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const { user, isLoading, checkAuth } = useAuthStore()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initializeAuth = async () => {
      await checkAuth()
      setIsInitialized(true)
    }
    initializeAuth()
  }, []) // Remove checkAuth from dependencies to prevent multiple calls

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937',
              color: '#fff',
              borderRadius: '0.75rem',
              padding: '16px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
        {user && <Navbar />}
        
        <main className={user ? 'pt-16' : ''}>
          <Routes>
            {/* Public routes - Role-specific login/signup */}
            <Route 
              path="/student/login" 
              element={!user ? <StudentLoginPage /> : (user && user.role === 'student') ? <Navigate to="/dashboard" replace /> : <Navigate to="/teacher/dashboard" replace />} 
            />
            <Route 
              path="/student/signup" 
              element={!user ? <StudentSignupPage /> : (user && user.role === 'student') ? <Navigate to="/dashboard" replace /> : <Navigate to="/teacher/dashboard" replace />} 
            />
            <Route 
              path="/teacher/login" 
              element={!user ? <TeacherLoginPage /> : (user && (user.role === 'instructor' || user.role === 'admin')) ? <Navigate to="/teacher/dashboard" replace /> : <Navigate to="/dashboard" replace />} 
            />
            <Route 
              path="/teacher/signup" 
              element={!user ? <TeacherSignupPage /> : (user && (user.role === 'instructor' || user.role === 'admin')) ? <Navigate to="/teacher/dashboard" replace /> : <Navigate to="/dashboard" replace />} 
            />
            
            {/* Legacy routes - redirect to role-specific pages */}
            <Route 
              path="/login" 
              element={!user ? <Navigate to="/student/login" replace /> : (user && (user.role === 'instructor' || user.role === 'admin')) ? <Navigate to="/teacher/dashboard" replace /> : <Navigate to="/dashboard" replace />} 
            />
            <Route 
              path="/register" 
              element={!user ? <Navigate to="/student/signup" replace /> : (user && (user.role === 'instructor' || user.role === 'admin')) ? <Navigate to="/teacher/dashboard" replace /> : <Navigate to="/dashboard" replace />} 
            />
            
            {/* Protected routes */}
            <Route 
              path="/" 
              element={user ? ((user.role === 'instructor' || user.role === 'admin') ? <Navigate to="/teacher/dashboard" replace /> : <Navigate to="/dashboard" replace />) : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/search" 
              element={user ? <SearchPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/playlist/:playlistId" 
              element={user ? <PlaylistPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/video/:videoId" 
              element={user ? <VideoPlayerPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/assessment/:assessmentId" 
              element={user ? <AssessmentPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/dashboard" 
              element={
                user ? (
                  (user.role === 'instructor' || user.role === 'admin') ? (
                    <Navigate to="/teacher/dashboard" replace />
                  ) : (
                    <DashboardPage />
                  )
                ) : (
                  <Navigate to="/student/login" replace />
                )
              } 
            />
            <Route 
              path="/profile" 
              element={user ? <ProfilePage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/profile/completed" 
              element={user ? <CompletedPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/integrations" 
              element={user ? <IntegrationsPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/integrations/googledocs/callback" 
              element={<GoogleDocsCallbackPage />} 
            />
            <Route 
              path="/courses" 
              element={user ? <CoursesPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/test-scores" 
              element={user ? <TestScoresPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/quiz" 
              element={user ? <QuizPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/quiz/create" 
              element={user && (user.role === 'instructor' || user.role === 'admin') ? <CreateQuizPage /> : <Navigate to="/quiz" replace />} 
            />
            <Route 
              path="/quiz/edit/:quizId" 
              element={user && (user.role === 'instructor' || user.role === 'admin') ? <CreateQuizPage /> : <Navigate to="/quiz" replace />} 
            />
            <Route 
              path="/quiz/take/:quizId" 
              element={user ? <TakeQuizPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/quiz/history" 
              element={user ? <QuizHistoryPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/quiz/attempt/:attemptId" 
              element={user ? <QuizAttemptDetailsPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/quiz/terminated" 
              element={<QuizTerminatedPage />} 
            />
            
            {/* Classroom routes */}
            <Route 
              path="/classrooms" 
              element={user && (user.role === 'instructor' || user.role === 'admin') ? <ClassroomPage /> : <Navigate to="/classrooms/join" replace />} 
            />
            <Route 
              path="/classrooms/join" 
              element={user ? <JoinClassroomPage /> : <Navigate to="/student/login" replace />} 
            />
            <Route 
              path="/classrooms/:id" 
              element={user ? <ClassroomViewPage /> : <Navigate to="/student/login" replace />} 
            />
            
            {/* Teacher routes */}
            <Route 
              path="/teacher/dashboard" 
              element={user && (user.role === 'instructor' || user.role === 'admin') ? <TeacherDashboardPage /> : <Navigate to="/dashboard" replace />} 
            />
                  <Route 
                    path="/teacher/courses/:courseId/analytics" 
                    element={user && (user.role === 'instructor' || user.role === 'admin') ? <CourseAnalyticsPage /> : <Navigate to="/dashboard" replace />} 
                  />
                  <Route 
                    path="/teacher/course-keys/:keyId/analytics" 
                    element={user && (user.role === 'instructor' || user.role === 'admin') ? <CourseKeyAnalyticsPage /> : <Navigate to="/dashboard" replace />} 
                  />
                  <Route 
                    path="/quiz/:quizId/analytics" 
                    element={user && (user.role === 'instructor' || user.role === 'admin') ? <QuizAnalyticsPage /> : <Navigate to="/quiz" replace />} 
                  />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
