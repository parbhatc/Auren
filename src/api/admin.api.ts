import api, { getAuthHeaders } from './api'

/**
 * Admin API service
 * Handles admin-only API calls (requires admin permissions)
 */
export const adminAPI = {
  /**
   * Get server configuration (admin only)
   */
  getConfig: async (): Promise<{ success: boolean; config: any }> => {
    const response = await api.get('/admin/config', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Update server configuration (admin only)
   */
  updateConfig: async (config: any): Promise<{ success: boolean; message: string; config: any }> => {
    const response = await api.put('/admin/config', { config }, {
      headers: getAuthHeaders(),
    })
    return response.data
  },
}

