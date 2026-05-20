import { AxiosError } from 'axios'
import { ERROR_MESSAGES } from '../constants/messages'
import { ApiError } from '../types/auth'

/**
 * Maps common error messages to user-friendly messages
 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  'Invalid credentials': ERROR_MESSAGES.INVALID_CREDENTIALS,
  'Username or email already exists': ERROR_MESSAGES.EMAIL_EXISTS,
  'Username already exists': ERROR_MESSAGES.USERNAME_EXISTS,
  'Email already exists': ERROR_MESSAGES.EMAIL_EXISTS,
  'User not found': ERROR_MESSAGES.ACCOUNT_NOT_FOUND,
  'Invalid or expired reset token': ERROR_MESSAGES.RESET_TOKEN_INVALID,
  'Network Error': ERROR_MESSAGES.NETWORK_ERROR,
  'timeout': ERROR_MESSAGES.NETWORK_ERROR,
  'ECONNREFUSED': ERROR_MESSAGES.NETWORK_ERROR,
}

/**
 * Extracts user-friendly error message from API error
 */
export const handleApiError = (error: unknown): string => {
  if (error instanceof Error) {
    // Axios error with response
    if ('response' in error) {
      const axiosError = error as AxiosError<{ message?: string }>
      const status = axiosError.response?.status
      const serverMessage = axiosError.response?.data?.message

      // Map server messages to user-friendly messages
      if (serverMessage) {
        const mappedMessage = ERROR_MESSAGE_MAP[serverMessage]
        if (mappedMessage) {
          return mappedMessage
        }
        return serverMessage
      }

      // Handle HTTP status codes
      if (status === 400) {
        return ERROR_MESSAGES.REGISTER_FAILED
      }
      if (status === 401) {
        return ERROR_MESSAGES.INVALID_CREDENTIALS
      }
      if (status === 404) {
        // 404 without a server message usually means the API route was not found
        // (backend not running, wrong port, or proxy misconfigured) — not a missing user
        if (!serverMessage) {
          return ERROR_MESSAGES.API_NOT_REACHABLE
        }
        return ERROR_MESSAGES.ACCOUNT_NOT_FOUND
      }
      if (status === 500) {
        return ERROR_MESSAGES.SERVER_ERROR
      }
      if (status && status >= 500) {
        return ERROR_MESSAGES.SERVER_ERROR
      }

      return axiosError.message || ERROR_MESSAGES.UNKNOWN_ERROR
    }

    // Network errors
    const errorMessage = error.message.toLowerCase()
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return ERROR_MESSAGES.NETWORK_ERROR
    }
    if (errorMessage.includes('timeout')) {
      return ERROR_MESSAGES.NETWORK_ERROR
    }

    // Map error messages
    const mappedMessage = ERROR_MESSAGE_MAP[error.message]
    if (mappedMessage) {
      return mappedMessage
    }

    return error.message || ERROR_MESSAGES.UNKNOWN_ERROR
  }
  return ERROR_MESSAGES.UNKNOWN_ERROR
}

export const createApiError = (message: string, status?: number): ApiError => {
  return { message, status }
}

