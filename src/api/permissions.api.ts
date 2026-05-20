import api, { getAuthHeaders } from './api'

export interface Role {
  id: string
  name: string
  permissions: string[]
}

export interface RoleResponse {
  success: boolean
  role: Role
}

export interface RolesResponse {
  success: boolean
  roles: Role[]
}

export interface PermissionsResponse {
  success: boolean
  permissions: string[]
}

export interface UsersByRoleResponse {
  success: boolean
  users: Array<{
    id: string
    username: string
    email: string
    name: string
    role: string
  }>
  count: number
}

export interface CreateRoleData {
  id: string
  name: string
  permissions: string[]
}

export interface UpdateRoleData {
  name?: string
  permissions?: string[]
}

export interface ApiResponse {
  success: boolean
  message: string
  role?: Role
}

/**
 * Permission API service
 * Handles role and permission management (admin only)
 */
export const permissionAPI = {
  /**
   * Get all roles
   */
  getRoles: async (): Promise<RolesResponse> => {
    const response = await api.get('/admin/permissions/roles', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Get a specific role
   */
  getRole: async (roleId: string): Promise<RoleResponse> => {
    const response = await api.get(`/admin/permissions/roles/${roleId}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Create a new role
   */
  createRole: async (data: CreateRoleData): Promise<ApiResponse> => {
    const response = await api.post('/admin/permissions/roles', data, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Update a role
   */
  updateRole: async (roleId: string, data: UpdateRoleData): Promise<ApiResponse> => {
    const response = await api.put(`/admin/permissions/roles/${roleId}`, data, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Delete a role
   */
  deleteRole: async (roleId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/admin/permissions/roles/${roleId}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Get available permissions
   */
  getAvailablePermissions: async (): Promise<PermissionsResponse> => {
    const response = await api.get('/admin/permissions/permissions', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Get users by role
   */
  getUsersByRole: async (roleId: string): Promise<UsersByRoleResponse> => {
    const response = await api.get(`/admin/permissions/roles/${roleId}/users`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },
}

