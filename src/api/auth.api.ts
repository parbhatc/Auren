import api, { getAuthHeaders } from './api'
import { LoginCredentials, RegisterData, ForgotPasswordData, ResetPasswordData, AuthResponse } from '../types/auth'

/**
 * Authentication API service
 * Handles all authentication-related API calls
 */
export const authAPI = {
  /**
   * Login user with credentials
   */
  login: async (data: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data)
    return response.data
  },

  /**
   * Register new user
   */
  register: async (data: Omit<RegisterData, 'confirmPassword'>): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data)
    return response.data
  },

  /**
   * Request password reset link
   */
  forgotPassword: async (data: ForgotPasswordData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/forgot-password', data)
    return response.data
  },

  /**
   * Reset password with token
   */
  resetPassword: async (data: ResetPasswordData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/reset-password', data)
    return response.data
  },

  /**
   * Verify email with code
   */
  verifyEmail: async (data: { email: string; code: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/verify-email', data)
    return response.data
  },

  /**
   * Resend email verification code
   */
  resendVerificationEmail: async (data: { email: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/resend-verification', data)
    return response.data
  },

  /**
   * Verify reset code
   */
  verifyResetCode: async (data: { email: string; code: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/verify-reset-code', data)
    return response.data
  },

  /**
   * Get roles status
   */
  getRolesStatus: async (): Promise<{ success: boolean; hasRoles: boolean; rolesCount: number; roles: Array<{ id: string; name: string }> }> => {
    const response = await api.get('/roles/status')
    return response.data
  },

  /**
   * Validate token and get user information
   */
  validateToken: async (_token: string): Promise<{ success: boolean; user: { id: string; username: string; email: string; name: string; role: string; email_verified: boolean; permissions?: string[]; isAdmin?: boolean } }> => {
    const response = await api.get('/auth/validate', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Update user password
   */
  updatePassword: async (data: { currentPassword: string; newPassword: string }): Promise<AuthResponse> => {
    const response = await api.put<AuthResponse>('/auth/profile/password', data, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Update user name
   */
  updateName: async (data: { name: string }): Promise<AuthResponse> => {
    const response = await api.put<AuthResponse>('/auth/profile/name', data, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Update user email
   */
  updateEmail: async (data: { email: string }): Promise<AuthResponse> => {
    const response = await api.put<AuthResponse>('/auth/profile/email', data, {
      headers: getAuthHeaders(),
    })
    return response.data
  },
}

