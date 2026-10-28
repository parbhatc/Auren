import api, { getAuthHeaders, getAuthToken, clearAuthToken } from './api'
import { createSingleFlight } from '../../shared/singleFlight.js'
import { createAuthSession } from '../services/auth/authSession'
import { subscribeAuthEvents } from '../services/auth/authEvents'
import { traceStartup } from '../services/debug/startupTrace'
import {
  LoginCredentials,
  RegisterData,
  RequestPasswordResetData,
  ResetPasswordData,
  AuthResponse,
} from '../types/auth'

const pendingAuthReads = createSingleFlight()

export type AuthValidationResponse = { success: boolean; user: { id: string; username: string; email: string; name: string; role: string; email_verified: boolean; permissions?: string[]; isAdmin?: boolean } }

export const authSession = createAuthSession<AuthValidationResponse>({
  readToken: getAuthToken,
  clearToken: (token) => { if (getAuthToken() === token) clearAuthToken() },
  validate: async (token) => {
    const response = await api.get<AuthValidationResponse>('/auth/validate', {
      headers: { Authorization: `Bearer ${token}` }, timeout: 10_000,
    })
    return response.data
  },
  isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  trace: traceStartup,
})

const unsubscribeAuthEvents = subscribeAuthEvents((event) => {
  if (event.kind === 'unauthorized') authSession.rejectToken(event.token)
  else if (event.kind === 'verify-current') {
    if (getAuthToken() === event.token) void authSession.ensure(event.token, { force: true }).catch(() => undefined)
  }
  else { authSession.sync(); authSession.returned() }
})

let lifecycleInstalled = false
export function installAuthSessionLifecycle() {
  if (lifecycleInstalled || typeof window === 'undefined') return
  lifecycleInstalled = true
  const storage = (event: StorageEvent) => {
    if (event.key === 'token' || event.key === null) { authSession.sync(); authSession.returned() }
  }
  const returned = () => authSession.returned()
  window.addEventListener('storage', storage)
  window.addEventListener('focus', returned)
  window.addEventListener('online', returned)
  document.addEventListener('visibilitychange', returned)
  authSession.start()
  import.meta.hot?.dispose(() => {
    authSession.stop()
    unsubscribeAuthEvents()
    window.removeEventListener('storage', storage)
    window.removeEventListener('focus', returned)
    window.removeEventListener('online', returned)
    document.removeEventListener('visibilitychange', returned)
    lifecycleInstalled = false
  })
}

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
  forgotPassword: async (data: RequestPasswordResetData): Promise<AuthResponse> => {
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
    return pendingAuthReads('roles', async () => {
      const response = await api.get('/roles/status', { timeout: 10_000 })
      return response.data
    })
  },

  /**
   * Validate token and get user information
   */
  validateToken: (token: string): Promise<AuthValidationResponse> => authSession.ensure(token),

  /**
   * Update user password
   */
  updatePassword: async (data: { currentPassword: string; newPassword: string }): Promise<AuthResponse> => {
    const response = await api.put<AuthResponse>('/auth/profile/password', data, {
      headers: getAuthHeaders(),
    })
    await authSession.ensure(getAuthToken(), { force: true }).catch(() => undefined)
    return response.data
  },

  /**
   * Update user name
   */
  updateName: async (data: { name: string }): Promise<AuthResponse> => {
    const response = await api.put<AuthResponse>('/auth/profile/name', data, {
      headers: getAuthHeaders(),
    })
    await authSession.ensure(getAuthToken(), { force: true }).catch(() => undefined)
    return response.data
  },

  /**
   * Update user email
   */
  updateEmail: async (data: { email: string }): Promise<AuthResponse> => {
    const response = await api.put<AuthResponse>('/auth/profile/email', data, {
      headers: getAuthHeaders(),
    })
    await authSession.ensure(getAuthToken(), { force: true }).catch(() => undefined)
    return response.data
  },
}

