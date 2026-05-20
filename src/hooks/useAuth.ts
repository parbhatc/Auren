import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../api/auth.api'
import { handleApiError } from '../utils/errorHandler'
import { AUTH_MESSAGES, ERROR_MESSAGES } from '../constants/messages'
import { ROUTES } from '../constants/routes'
import { LoginCredentials, RegisterData, ForgotPasswordData } from '../types/auth'

/**
 * Custom hook for authentication operations
 * Provides login, register, and forgot password functionality
 */
interface UseAuthReturn {
  error: string
  success: string
  loading: boolean
  login: (credentials: LoginCredentials) => Promise<boolean>
  register: (data: RegisterData) => Promise<boolean>
  verifyEmail: (email: string, code: string) => Promise<boolean>
  forgotPassword: (data: ForgotPasswordData) => Promise<boolean>
  clearError: () => void
  clearSuccess: () => void
}

export const useAuth = (): UseAuthReturn => {
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const clearError = () => setError('')
  const clearSuccess = () => setSuccess('')

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await authAPI.login(credentials)

      if (response.success && response.token) {
        localStorage.setItem('token', response.token)
        navigate(ROUTES.HOME)
        return true
      } else {
        // Use the server message if available, otherwise use a generic message
        const errorMessage = response.message || ERROR_MESSAGES.LOGIN_FAILED
        setError(errorMessage)
        return false
      }
    } catch (err) {
      const errorMessage = handleApiError(err)
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }

  const register = async (data: RegisterData): Promise<boolean> => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await authAPI.register({
        name: data.name,
        username: data.username,
        email: data.email,
        password: data.password,
      })

      if (response.success) {
        setSuccess(response.message || AUTH_MESSAGES.REGISTER_SUCCESS)
        return true
      } else {
        // Provide context-specific error messages
        const errorMessage = response.message || ERROR_MESSAGES.REGISTER_FAILED
        setError(errorMessage)
        return false
      }
    } catch (err) {
      const errorMessage = handleApiError(err)
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }

  const verifyEmail = async (email: string, code: string): Promise<boolean> => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await authAPI.verifyEmail({ email, code })

      if (response.success && response.token) {
        localStorage.setItem('token', response.token)
        setSuccess(response.message || 'Email verified successfully!')
        // Navigate to dashboard after successful verification
        setTimeout(() => {
          navigate(ROUTES.HOME)
        }, 1500)
        return true
      } else {
        const errorMessage = response.message || 'Verification failed'
        setError(errorMessage)
        return false
      }
    } catch (err) {
      const errorMessage = handleApiError(err)
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }

  const forgotPassword = async (data: ForgotPasswordData): Promise<boolean> => {
    setError('')
    setLoading(true)

    try {
      const response = await authAPI.forgotPassword(data)

      if (response.success) {
        return true
      } else {
        // Provide user-friendly error message
        const errorMessage = response.message || ERROR_MESSAGES.NETWORK_ERROR
        setError(errorMessage)
        return false
      }
    } catch (err) {
      const errorMessage = handleApiError(err)
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    error,
    success,
    loading,
    login,
    register,
    verifyEmail,
    forgotPassword,
    clearError,
    clearSuccess,
  }
}

