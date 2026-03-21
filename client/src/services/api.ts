import axios from 'axios'
import toast from 'react-hot-toast'

// Get API base URL from environment variable, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // Default 10 seconds for most requests
  headers: {
    'Content-Type': 'application/json',
  },
})

// Special API instance for assessment generation with longer timeout
export const assessmentApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes timeout for assessment generation
  headers: {
    'Content-Type': 'application/json',
  },
})

// Special API instance for chat with extended timeout for large prompts
export const chatApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 360000, // 6 minutes timeout for chat (handles large prompts with transcripts)
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for chat API
chatApi.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth-storage')
    if (token) {
      try {
        const authData = JSON.parse(token)
        if (authData.state?.token) {
          config.headers.Authorization = `Bearer ${authData.state.token}`
        }
      } catch (error) {
        console.error('Error parsing auth token:', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for chat API
chatApi.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else if (error.response?.status === 403) {
      if (!error.config?.url?.includes('/auth/login')) {
        toast.error('Access denied')
      }
    } else if (error.code === 'ECONNABORTED') {
      // Timeout errors are handled in chatService
      // Don't show toast here, let chatService handle it
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.')
    }
    return Promise.reject(error)
  }
)

// Special API instance for notes generation with longer timeout
export const notesApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes timeout for notes generation
  headers: {
    'Content-Type': 'application/json',
  },
})

// Special API instance for PDF download with longer timeout
export const pdfApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes timeout for PDF download
  headers: {
    'Content-Type': 'application/json',
  },
})

// Certificates API (PDF downloads, issuance)
export const certificateApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for certificate API
certificateApi.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth-storage')
    console.log('🔐 Certificate API interceptor:', {
      url: config.url,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 50) + '...' : 'none'
    });
    
    if (token) {
      try {
        const authData = JSON.parse(token)
        console.log('🔐 Parsed auth data:', {
          hasState: !!authData.state,
          hasToken: !!authData.state?.token,
          tokenPreview: authData.state?.token ? authData.state.token.substring(0, 20) + '...' : 'none'
        });
        
        if (authData.state?.token) {
          config.headers.Authorization = `Bearer ${authData.state.token}`
          console.log('🔐 Authorization header set:', config.headers.Authorization.substring(0, 20) + '...');
        }
      } catch (error) {
        console.error('Error parsing auth token:', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for certificate API
certificateApi.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else if (error.response?.status === 403) {
      if (!error.config?.url?.includes('/auth/login')) {
        toast.error('Access denied')
      }
    } else if (error.response?.status === 408) {
      toast.error('Certificate operation timed out. Please try again.')
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please try again later.')
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Certificate operation timed out. Please try again.')
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.')
    }
    return Promise.reject(error)
  }
)

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth-storage')
    if (token) {
      try {
        const authData = JSON.parse(token)
        if (authData.state?.token) {
          config.headers.Authorization = `Bearer ${authData.state.token}`
        }
      } catch (error) {
        console.error('Error parsing auth token:', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Request interceptor for assessment API
assessmentApi.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth-storage')
    if (token) {
      try {
        const authData = JSON.parse(token)
        if (authData.state?.token) {
          config.headers.Authorization = `Bearer ${authData.state.token}`
        }
      } catch (error) {
        console.error('Error parsing auth token:', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Request interceptor for notes API
notesApi.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth-storage')
    if (token) {
      try {
        const authData = JSON.parse(token)
        if (authData.state?.token) {
          config.headers.Authorization = `Bearer ${authData.state.token}`
        }
      } catch (error) {
        console.error('Error parsing auth token:', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      localStorage.removeItem('auth-storage')
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else if (error.response?.status === 403) {
      // Only show access denied if it's not a login attempt
      if (!error.config?.url?.includes('/auth/login')) {
        toast.error('Access denied')
      }
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please try again later.')
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timeout. Please check your connection.')
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.')
    }

    return Promise.reject(error)
  }
)

// Response interceptor for assessment API
assessmentApi.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else if (error.response?.status === 403) {
      if (!error.config?.url?.includes('/auth/login')) {
        toast.error('Access denied')
      }
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please try again later.')
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Assessment generation timed out. This usually takes 2-5 minutes. Please try again.')
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.')
    }

    return Promise.reject(error)
  }
)

// Response interceptor for notes API
notesApi.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else if (error.response?.status === 403) {
      if (!error.config?.url?.includes('/auth/login')) {
        toast.error('Access denied')
      }
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please try again later.')
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Notes generation timed out. This usually takes 3-5 minutes. Please try again.')
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.')
    }

    return Promise.reject(error)
  }
)

// Request interceptor for PDF API
pdfApi.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth-storage')
    if (token) {
      try {
        const authData = JSON.parse(token)
        if (authData.state?.token) {
          config.headers.Authorization = `Bearer ${authData.state.token}`
        }
      } catch (error) {
        console.error('Error parsing auth token:', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for PDF API
pdfApi.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else if (error.response?.status === 403) {
      if (!error.config?.url?.includes('/auth/login')) {
        toast.error('Access denied')
      }
    } else if (error.response?.status === 408) {
      toast.error('PDF generation timed out. Please try again.')
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please try again later.')
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    } else if (error.code === 'ECONNABORTED') {
      toast.error('PDF download timed out. Please try again.')
    } else if (!error.response) {
      toast.error('Network error. Please check your connection.')
    }

    return Promise.reject(error)
  }
)

// Auth for certificate API
certificateApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth-storage')
    if (token) {
      try {
        const authData = JSON.parse(token)
        if (authData.state?.token) {
          config.headers.Authorization = `Bearer ${authData.state.token}`
        }
      } catch (error) {
        console.error('Error parsing auth token:', error)
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

certificateApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-storage')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else if (error.response?.status === 403) {
      toast.error('Access denied')
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Certificate request timed out. Please try again.')
    }
    return Promise.reject(error)
  }
)

// API endpoints
export const endpoints = {
  // Auth
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    profile: '/auth/profile',
    logout: '/auth/logout',
  },
  
  // YouTube
  youtube: {
    search: '/youtube/search',
    playlist: (id: string) => `/youtube/playlist/${id}`,
    course: (id: string) => `/youtube/course/${id}`,
    video: (id: string) => `/youtube/video/${id}`,
    transcript: (id: string) => `/youtube/video/${id}/transcript`,
    searchCourses: '/youtube/search-courses',
  },
  
  // Assessments
  assessments: {
    start: '/assessments/start',
    metrics: (id: string) => `/assessments/${id}/metrics`,
    complete: (id: string) => `/assessments/${id}/complete`,
    results: (id: string) => `/assessments/${id}/results`,
    user: (userId: string) => `/assessments/user/${userId}`,
    analytics: (userId: string) => `/assessments/analytics/${userId}`,
  },
  
  // Feedback
  feedback: {
    get: (assessmentId: string) => `/feedback/assessment/${assessmentId}`,
    userHistory: (userId: string) => `/feedback/user/${userId}/history`,
    interaction: (feedbackId: string) => `/feedback/${feedbackId}/interaction`,
    recommendations: (userId: string) => `/feedback/user/${userId}/recommendations`,
    insights: (userId: string) => `/feedback/user/${userId}/insights`,
    suggestedTopics: (userId: string) => `/feedback/user/${userId}/suggested-topics`,
  },
  
  // Certificates
  certificates: {
    issue: (playlistId: string) => `/certificates/issue/${playlistId}`,
    my: '/certificates/my',
    download: (id: string) => `/certificates/${id}/download`,
  },
  
  // Chat
  chat: {
    send: '/chat',
    quick: '/chat/quick',
  },
}

// Helper functions
export const handleApiError = (error: any) => {
  const message = error.response?.data?.message || error.message || 'An error occurred'
  toast.error(message)
  return message
}

export const isApiError = (error: any): error is { response: { data: { message: string } } } => {
  return error?.response?.data?.message
}
