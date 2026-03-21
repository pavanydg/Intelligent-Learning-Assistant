import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import { Eye, EyeOff, BookOpen, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface LoginForm {
  email: string
  password: string
}

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password)
      toast.success('Login successful!')
      // Redirect based on user role
      const { user } = useAuthStore.getState()
      if (user && (user.role === 'instructor' || user.role === 'admin')) {
        navigate('/teacher/dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (error) {
      handleApiError(error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 animate-fade-in-up">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary-600 rounded-2xl blur-xl opacity-20"></div>
              <div className="relative bg-gradient-to-br from-primary-500 to-primary-600 p-4 rounded-2xl shadow-xl">
                <BookOpen className="h-12 w-12 text-white" />
              </div>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-3">
            Welcome back
          </h2>
          <p className="text-lg text-gray-600">
            Sign in to your Intelligent Learning Assistant account
          </p>
        </div>

        {/* Login Form */}
        <div className="card-elevated p-8">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-5">
            {/* Email */}
            <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email address
              </label>
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                type="email"
                  className="input w-full"
                placeholder="Enter your email"
              />
              {errors.email && (
                  <p className="mt-2 text-sm text-error-600 flex items-center gap-1">
                    <span>•</span>
                    {errors.email.message}
                  </p>
              )}
            </div>

            {/* Password */}
            <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
                <div className="relative">
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  type={showPassword ? 'text' : 'password'}
                    className="input w-full pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-primary-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                  <p className="mt-2 text-sm text-error-600 flex items-center gap-1">
                    <span>•</span>
                    {errors.password.message}
                  </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-lg w-full"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          {/* Register Link */}
            <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                  className="font-semibold text-primary-600 hover:text-primary-700 transition-colors"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
