import api, { getAuthHeaders, getAuthToken } from './api'
import { createUserMetadataCache } from '../services/cache/userMetadataCache'

const months = createUserMetadataCache({ getOwner: getAuthToken, ttlMs: 60_000, maxEntries: 6 })

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
  getEvents: async (year: number, month: number, options: { signal?: AbortSignal; force?: boolean } = {}): Promise<GetEventsResponse> => {
    const path = `/economic-news/events?year=${year}&month=${month}`
    return months.read(path, async (signal) => {
      const response = await api.get<GetEventsResponse>(path, { headers: getAuthHeaders(), signal, timeout: 15_000 })
      return response.data
    }, { ...options, cacheable: (value) => value.success === true })
  },
  invalidateEvents: () => months.invalidate(),
}

