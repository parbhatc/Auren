/**
 * Props API service
 * Handles prop firm credential management
 */
import api, { getAuthHeaders } from './api'
import { PropFirm, PropFirmFormData, PropFirmType, PropsSettingsResponse } from '../types/props'

export const propsAPI = {
  /**
   * Get all prop firm credentials for the current user
   */
  getPropFirms: async (): Promise<PropsSettingsResponse> => {
    const response = await api.get<{ success: boolean; propFirms?: PropFirm[] }>('/props', {
      headers: getAuthHeaders()
    })
    return {
      success: response.data.success,
      propFirms: response.data.propFirms || []
    }
  },

  /**
   * Get a specific prop firm by type
   */
  getPropFirm: async (type: string): Promise<PropsSettingsResponse> => {
    const response = await api.get<{ success: boolean; propFirm?: PropFirm }>(`/props/${type}`, {
      headers: getAuthHeaders()
    })
    return {
      success: response.data.success,
      propFirm: response.data.propFirm
    }
  },

  /**
   * Create or update prop firm credentials
   */
  savePropFirm: async (data: PropFirmFormData): Promise<PropsSettingsResponse> => {
    const response = await api.post<{ success: boolean; message?: string }>('/props', data, {
      headers: getAuthHeaders()
    })
    return {
      success: response.data.success,
      message: response.data.message
    }
  },

  /**
   * Update prop firm credentials
   */
  updatePropFirm: async (type: string, data: Partial<PropFirmFormData>): Promise<PropsSettingsResponse> => {
    const response = await api.put<{ success: boolean; message?: string }>(`/props/${type}`, { ...data, type }, {
      headers: getAuthHeaders()
    })
    return {
      success: response.data.success,
      message: response.data.message
    }
  },

  /**
   * Delete prop firm credentials
   */
  deletePropFirm: async (type: string): Promise<PropsSettingsResponse> => {
    const response = await api.delete<{ success: boolean; message?: string }>(`/props/${type}`, {
      headers: getAuthHeaders()
    })
    return {
      success: response.data.success,
      message: response.data.message
    }
  },

  /**
   * Update token for a prop firm
   * @param type - Prop firm type (e.g., 'tradingview')
   * @param token - Token to save
   * @param sessionId - Optional session ID
   * @param expiration - Optional expiration timestamp
   */
  updateToken: async (type: string, token: string, sessionId?: string | null, expiration?: string | null): Promise<PropsSettingsResponse> => {
    const response = await api.post<{ success: boolean; message?: string }>(
      `/props/${type}/token`,
      { token, sessionId: sessionId || null, expiration: expiration || null },
      {
        headers: getAuthHeaders()
      }
    )
    return {
      success: response.data.success,
      message: response.data.message
    }
  },

  /**
   * Test prop firm connection and save token to database
   * @param type - Prop firm type (e.g., 'tradesea')
   * @param credentials - Credentials to test (username, password)
   */
  testConnection: async (type: string, credentials: { username: string; password: string }): Promise<PropsSettingsResponse> => {
    if (type === 'tradesea') {
      try {
        const { tradeseaAPI } = await import('./tradesea.api')
        const status = await tradeseaAPI.getConnectionStatus()
        if (status.connected) {
          const { t } = await import('../utils/translator')
          return {
            success: true,
            message: t('props.connectionSuccessful'),
          }
        }
        return {
          success: false,
          message: 'Market data is not connected. Use email OTP or paste tokens in Market data settings.',
        }
      } catch (error: unknown) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Connection test failed',
        }
      }
    }

    return {
      success: false,
      message: 'Test connection is only supported for the market data provider',
    }
  },
}

