import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../store/authStore'
import { api, handleApiError } from '../services/api'
import { Eye, EyeOff, BookOpen, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface RegisterForm {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: 'student' | 'instructor'
  college: string
  department: string
}

const RegisterPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [colleges, setColleges] = useState<string[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [isLoadingColleges, setIsLoadingColleges] = useState(false)
  const { register: registerUser, isLoading } = useAuthStore()
  const navigate = useNavigate()
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterForm>({
    defaultValues: {
      role: 'student',
      college: '',
      department: ''
    }
  })

  const password = watch('password')
  const role = watch('role')
  const [collegeInputMode, setCollegeInputMode] = useState<'select' | 'input'>('select')
  const [departmentInputMode, setDepartmentInputMode] = useState<'select' | 'input'>('select')

  useEffect(() => {
    fetchCollegesAndDepartments()
  }, [])

  const fetchCollegesAndDepartments = async () => {
    setIsLoadingColleges(true)
    try {
      const response = await api.get('/auth/colleges-departments')
      setColleges(response.data.data.colleges || [])
      setDepartments(response.data.data.departments || [])
    } catch (error) {
      console.error('Error fetching colleges and departments:', error)
      // Don't show error toast, just continue with empty lists
    } finally {
      setIsLoadingColleges(false)
    }
  }

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser(
        data.name, 
        data.email, 
        data.password, 
        data.role,
        data.role === 'student' ? data.college : '',
        data.role === 'student' ? data.department : ''
      )
      toast.success('Registration successful!')
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <BookOpen className="h-12 w-12 text-primary-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Join the Intelligent Learning Assistant platform
          </p>
        </div>

        {/* Register Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full name
              </label>
              <input
                {...register('name', {
                  required: 'Name is required',
                  minLength: {
                    value: 2,
                    message: 'Name must be at least 2 characters',
                  },
                })}
                type="text"
                className="mt-1 input w-full"
                placeholder="Enter your full name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
                className="mt-1 input w-full"
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                I am a
              </label>
              <select
                {...register('role')}
                className="mt-1 input w-full"
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
              </select>
            </div>

            {/* College - Only for students */}
            {role === 'student' && (
              <div>
                <label htmlFor="college" className="block text-sm font-medium text-gray-700">
                  College Name
                </label>
                {isLoadingColleges ? (
                  <div className="mt-1 input w-full flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading colleges...</span>
                  </div>
                ) : (
                  <>
                    {collegeInputMode === 'select' ? (
                      <>
                        <select
                          {...register('college')}
                          className="mt-1 input w-full"
                          onChange={(e) => {
                            if (e.target.value === '__other__') {
                              setCollegeInputMode('input')
                              setValue('college', '')
                            } else {
                              setValue('college', e.target.value)
                            }
                          }}
                        >
                          <option value="">Select a college</option>
                          {colleges.map((college) => (
                            <option key={college} value={college}>
                              {college}
                            </option>
                          ))}
                          <option value="__other__">+ Add new college</option>
                        </select>
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          {...register('college', { required: role === 'student' ? 'College name is required' : false })}
                          className="mt-1 input w-full"
                          placeholder="Enter college name (e.g., BMSC College of Engineering)"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setCollegeInputMode('select')
                            setValue('college', '')
                          }}
                          className="mt-1 text-sm text-primary-600 hover:text-primary-700"
                        >
                          ← Back to select from list
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Department - Only for students */}
            {role === 'student' && (
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                {isLoadingColleges ? (
                  <div className="mt-1 input w-full flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    {departmentInputMode === 'select' ? (
                      <select
                        {...register('department')}
                        className="mt-1 input w-full"
                        onChange={(e) => {
                          if (e.target.value === '__other__') {
                            setDepartmentInputMode('input')
                            setValue('department', '')
                          } else {
                            setValue('department', e.target.value)
                          }
                        }}
                      >
                        <option value="">Select a department</option>
                        {departments.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                        <option value="__other__">+ Add new department</option>
                      </select>
                    ) : (
                      <>
                        <input
                          type="text"
                          {...register('department')}
                          className="mt-1 input w-full"
                          placeholder="Enter department name (e.g., Computer Science, Electronics, etc.)"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setDepartmentInputMode('select')
                            setValue('department', '')
                          }}
                          className="mt-1 text-sm text-primary-600 hover:text-primary-700"
                        >
                          ← Back to select from list
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className="input w-full pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
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
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) =>
                      value === password || 'Passwords do not match',
                  })}
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input w-full pr-10"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
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
                  <span>Creating account...</span>
                </div>
              ) : (
                'Create account'
              )}
            </button>
          </div>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterPage
