import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { 
  Search, 
  User, 
  LogOut, 
  Menu, 
  X,
  BookOpen,
  BarChart3,
  GraduationCap,
  Target,
  Users,
  TrendingUp,
  FileQuestion
} from 'lucide-react'

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isTeacher = user?.role === 'instructor' || user?.role === 'admin'
  
  const studentNavItems = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Courses', href: '/courses', icon: GraduationCap },
    { name: 'Test Scores', href: '/test-scores', icon: Target },
    { name: 'Quiz', href: '/quiz', icon: FileQuestion },
    { name: 'Classroom', href: '/classrooms/join', icon: Users },
    { name: 'Search', href: '/search', icon: Search },
  ]

  const teacherNavItems = [
    { name: 'Teacher Dashboard', href: '/teacher/dashboard', icon: TrendingUp },
    { name: 'Quiz', href: '/quiz', icon: FileQuestion },
    { name: 'Classroom', href: '/classrooms', icon: Users },
    { name: 'Search', href: '/search', icon: Search },
  ]

  const navItems = isTeacher ? teacherNavItems : studentNavItems

  return (
    <nav className="bg-white/95 backdrop-blur-md shadow-md border-b border-gray-200/50 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link 
            to="/dashboard" 
            className="flex items-center space-x-2.5 group transition-transform duration-200 hover:scale-105"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary-600 rounded-lg blur-sm opacity-0 group-hover:opacity-50 transition-opacity duration-200"></div>
              <BookOpen className="h-8 w-8 text-primary-600 relative z-10" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
              ILA
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 group relative"
                >
                  <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-3">
            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2.5 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-primary-600 transition-all duration-200 group"
              >
                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-200">
                  <User className="h-5 w-5 text-white" />
                </div>
                <span className="hidden sm:block text-sm font-medium">
                  {user?.name}
                </span>
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl py-2 z-50 border border-gray-200 animate-fade-in-up">
                  <Link
                    to="/profile"
                    className="flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:text-primary-600 hover:bg-gray-100 transition-all duration-200"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 animate-slide-down">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all duration-200 font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Overlay for mobile menu */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </nav>
  )
}

export default Navbar
