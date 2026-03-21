import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../services/api'

interface User {
  id: string
  name: string
  email: string
  role: 'student' | 'instructor' | 'admin'
  college?: string
  department?: string
  preferences: {
    learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading'
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced'
  }
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, role?: string, college?: string, department?: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  clearError: () => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      isLoading: false,
      error: null,

      // Actions
      login: async (email: string, password: string) => {
        const { isLoading } = get()
        
        // Prevent multiple simultaneous login attempts
        if (isLoading) {
          return
        }
        
        set({ isLoading: true, error: null })
        
        try {
          const response = await api.post('/auth/login', { email, password })
          const { user, token } = response.data.data
          
          set({ 
            user, 
            token, 
            isLoading: false,
            error: null 
          })
          
          // Set token in API client
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          
          // Wait a bit to ensure state is persisted
          await new Promise(resolve => setTimeout(resolve, 100))
          
        } catch (error: any) {
          set({ 
            error: error.response?.data?.message || 'Login failed',
            isLoading: false 
          })
          throw error
        }
      },

      register: async (name: string, email: string, password: string, role = 'student', college = '', department = '') => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await api.post('/auth/register', { 
            name, 
            email, 
            password, 
            role,
            college,
            department
          })
          const { user, token } = response.data.data
          
          set({ 
            user, 
            token, 
            isLoading: false,
            error: null 
          })
          
          // Set token in API client
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          
        } catch (error: any) {
          set({ 
            error: error.response?.data?.message || 'Registration failed',
            isLoading: false 
          })
          throw error
        }
      },

      logout: () => {
        set({ user: null, token: null, error: null })
        delete api.defaults.headers.common['Authorization']
        localStorage.removeItem('auth-storage')
      },

      checkAuth: async () => {
        const { token, isLoading } = get()
        
        // Prevent multiple simultaneous calls
        if (isLoading) {
          return
        }
        
        if (!token) {
          set({ isLoading: false })
          return
        }

        set({ isLoading: true })
        
        try {
          // Set token in API client immediately
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          
          const response = await api.get('/auth/profile')
          const { user } = response.data.data
          
          set({ user, isLoading: false })
          
          // Ensure token is still set after state update
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          
        } catch (error) {
          // Token is invalid, clear auth state
          set({ 
            user: null, 
            token: null, 
            isLoading: false 
          })
          delete api.defaults.headers.common['Authorization']
        }
      },

      updateProfile: async (data: Partial<User>) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await api.put('/auth/profile', data)
          const { user } = response.data.data
          
          set({ user, isLoading: false })
          
        } catch (error: any) {
          set({ 
            error: error.response?.data?.message || 'Profile update failed',
            isLoading: false 
          })
          throw error
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token 
      }),
    }
  )
)
