import api, { getAuthHeaders } from './api'

export interface EconomicEvent {
  date?: string
  time: string
  currency: string
  impact: 'high' | 'medium' | 'low'
  event: string
  forecast?: string
  previous?: string
  actual?: string
}

export interface GetEventsResponse {
  success: boolean
  events: EconomicEvent[]
  message?: string
}

export const economicNewsAPI = {
  /**
   * Get economic events for a specific month
   */
  getEvents: async (year: number, month: number): Promise<GetEventsResponse> => {
    const response = await api.get(`/economic-news/events?year=${year}&month=${month}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },
}

