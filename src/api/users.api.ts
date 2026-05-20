import api, { getAuthHeaders } from './api'

export interface User {
  id: string
  username: string
  email: string
  name: string
  role: string
  email_verified: boolean
  created_at?: string
}

export interface UsersResponse {
  success: boolean
  users: User[]
  count: number
}

export interface UserResponse {
  success: boolean
  user: User
}

export interface UpdateUserData {
  name?: string
  email?: string
  role?: string
}

export interface ResetPasswordData {
  newPassword: string
}

export interface CreateUserData {
  name: string
  username: string
  email: string
  password: string
  role?: string
}

export interface ApiResponse {
  success: boolean
  message: string
  user?: User
}

/**
 * Users API service
 * Handles user management (admin only)
 */
export const usersAPI = {
  /**
   * Get all users
   */
  getAllUsers: async (): Promise<UsersResponse> => {
    const response = await api.get('/admin/users', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Get a specific user
   */
  getUser: async (userId: string): Promise<UserResponse> => {
    const response = await api.get(`/admin/users/${userId}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Update a user
   */
  updateUser: async (userId: string, data: UpdateUserData): Promise<ApiResponse> => {
    const response = await api.put(`/admin/users/${userId}`, data, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Delete a user
   */
  deleteUser: async (userId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/admin/users/${userId}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Reset user password
   */
  resetUserPassword: async (userId: string, data: ResetPasswordData): Promise<ApiResponse> => {
    const response = await api.post(`/admin/users/${userId}/reset-password`, data, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Create a new user
   */
  createUser: async (data: CreateUserData): Promise<ApiResponse> => {
    const response = await api.post('/admin/users', data, {
      headers: getAuthHeaders(),
    })
    return response.data
  },
}

