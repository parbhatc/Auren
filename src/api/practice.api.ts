import api, { getAuthHeaders } from './api'
import type { PracticeAccount, PracticeMarketDataSettings } from '../constants/practice'
import type { PracticeAccountRules } from '../services/practice/practicePlans'

export interface PracticeBracketSnapshot {
  barTimeSec: number
  barTimeMs: number
  barTimeLabel?: string
  open: number
  high: number
  low: number
  close: number
  resolution: string
  recordedAtSec: number
  reason: 'ws_disconnect' | 'live_bar' | 'page_hide'
}

export interface PracticePosition {
  id: string
  accountId: string
  symbol: string
  instrument: string
  contracts: number
  entry: number
  stopLoss: number | null
  takeProfit: number | null
  entryTime: number
  type: 'long' | 'short'
  bracketSnapshot?: PracticeBracketSnapshot | null
}

export interface PracticeTradeRecord {
  symbol: string
  direction: 'long' | 'short'
  entryPrice: number
  exitPrice: number
  contracts: number
  pnl: number
  fees?: number
  entryTime: number
  exitTime: number
  stopLoss?: number | null
  takeProfit?: number | null
  /** Liquidation when max drawdown is hit — excluded from win rate */
  forcedExit?: boolean
}

export const practiceAPI = {
  getMarketData: async (): Promise<{ success: boolean; settings: PracticeMarketDataSettings }> => {
    const res = await api.get('/practice/market-data', { headers: getAuthHeaders() })
    return res.data
  },

  saveMarketData: async (
    settings: PracticeMarketDataSettings
  ): Promise<{ success: boolean; settings: PracticeMarketDataSettings }> => {
    const res = await api.put('/practice/market-data', settings, { headers: getAuthHeaders() })
    return res.data
  },

  listAccounts: async (): Promise<{ success: boolean; accounts: PracticeAccount[] }> => {
    const res = await api.get('/practice/accounts', { headers: getAuthHeaders() })
    return res.data
  },

  getAccount: async (id: string): Promise<{ success: boolean; account: PracticeAccount }> => {
    const res = await api.get(`/practice/accounts/${id}`, { headers: getAuthHeaders() })
    return res.data
  },

  createAccount: async (body: {
    mode: string
    size: number
    rules?: Partial<PracticeAccountRules>
  }): Promise<{ success: boolean; account: PracticeAccount }> => {
    const res = await api.post('/practice/accounts', body, { headers: getAuthHeaders() })
    return res.data
  },

  updateAccount: async (
    id: string,
    patch: { rules?: Partial<PracticeAccountRules> }
  ): Promise<{ success: boolean; account: PracticeAccount }> => {
    const res = await api.patch(`/practice/accounts/${id}`, patch, { headers: getAuthHeaders() })
    return res.data
  },

  resetAccount: async (id: string): Promise<{ success: boolean; account: PracticeAccount }> => {
    const res = await api.post(`/practice/accounts/${id}/reset`, {}, { headers: getAuthHeaders() })
    return res.data
  },

  deleteAccount: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/practice/accounts/${id}`, { headers: getAuthHeaders() })
    return res.data
  },

  deleteAllAccounts: async (): Promise<{ success: boolean }> => {
    const res = await api.delete('/practice/accounts', { headers: getAuthHeaders() })
    return res.data
  },

  getPositions: async (accountId: string): Promise<{ success: boolean; positions: PracticePosition[] }> => {
    const res = await api.get(`/practice/accounts/${accountId}/positions`, {
      headers: getAuthHeaders(),
    })
    return res.data
  },

  upsertPosition: async (
    accountId: string,
    position: Omit<PracticePosition, 'accountId'> & { accountId?: string }
  ): Promise<{ success: boolean; position: PracticePosition; account?: PracticeAccount }> => {
    const res = await api.put(`/practice/accounts/${accountId}/positions`, position, {
      headers: getAuthHeaders(),
    })
    return res.data
  },

  deletePosition: async (accountId: string, positionId: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/practice/accounts/${accountId}/positions/${positionId}`, {
      headers: getAuthHeaders(),
    })
    return res.data
  },

  startOfflineBracketWatcher: async (body: {
    practiceAccountId: string
    connectionGroupId: string
    marketAccountId: string
  }): Promise<{ success: boolean; started?: boolean; watching?: number; reason?: string }> => {
    const res = await api.post('/practice/offline-bracket/start', body, {
      headers: getAuthHeaders(),
    })
    return res.data
  },

  stopOfflineBracketWatcher: async (
    reason = 'client_connected'
  ): Promise<{ success: boolean }> => {
    const res = await api.post(
      '/practice/offline-bracket/stop',
      { reason },
      { headers: getAuthHeaders() }
    )
    return res.data
  },

  saveBracketSnapshot: async (
    accountId: string,
    positionId: string,
    snapshot: PracticeBracketSnapshot
  ): Promise<{ success: boolean }> => {
    const res = await api.put(
      `/practice/accounts/${accountId}/positions/${positionId}/bracket-snapshot`,
      { snapshot },
      { headers: getAuthHeaders() }
    )
    return res.data
  },

  clearPositions: async (accountId: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/practice/accounts/${accountId}/positions`, {
      headers: getAuthHeaders(),
    })
    return res.data
  },

  getLockout: async (
    accountId: string
  ): Promise<{ success: boolean; lockout: Record<string, unknown> }> => {
    const res = await api.get(`/practice/accounts/${accountId}/lockout`, {
      headers: getAuthHeaders(),
    })
    return res.data
  },

  setLockout: async (
    accountId: string,
    minutes: number
  ): Promise<{ success: boolean; account: PracticeAccount; lockout: Record<string, unknown> }> => {
    const res = await api.post(
      `/practice/accounts/${accountId}/lockout`,
      { minutes },
      { headers: getAuthHeaders() }
    )
    return res.data
  },

  clearLockout: async (
    accountId: string
  ): Promise<{ success: boolean; account: PracticeAccount; lockout: Record<string, unknown> }> => {
    const res = await api.delete(`/practice/accounts/${accountId}/lockout`, {
      headers: getAuthHeaders(),
    })
    return res.data
  },

  recordTrade: async (
    accountId: string,
    trade: PracticeTradeRecord
  ): Promise<{ success: boolean; account: PracticeAccount }> => {
    const res = await api.post(`/practice/accounts/${accountId}/trades`, trade, {
      headers: getAuthHeaders(),
    })
    return res.data
  },

  getStats: async (accountId: string) => {
    const res = await api.get(`/practice/accounts/${accountId}/stats`, {
      headers: getAuthHeaders(),
    })
    const data = res.data as {
      success?: boolean
      stats?: {
        account?: PracticeAccount
        trades?: (PracticeTradeRecord & { id?: string })[]
        totalTrades?: number
        winRate?: number
        totalPnl?: number
        rulesStatus?: unknown
      }
    }
    return data.stats ?? data
  },
}
