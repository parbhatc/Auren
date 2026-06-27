import api, { getAuthHeaders } from './api'
import { BacktestSession } from '../types/backtester'

/**
 * Backtester API service
 * Handles all backtester-related API calls
 */
export const backtesterAPI = {
  /**
   * Get all backtester sessions for the current user
   */
  getSessions: async (): Promise<{ success: boolean; sessions: BacktestSession[] }> => {
    const response = await api.get('/backtester/sessions', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Create a new backtester session
   */
  createSession: async (session: BacktestSession): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/backtester/sessions', session, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Update an existing backtester session
   */
  updateSession: async (session: BacktestSession): Promise<{ success: boolean; message: string }> => {
    const response = await api.put(`/backtester/sessions/${session.id}`, session, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Delete a backtester session
   */
  deleteSession: async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/backtester/sessions/${sessionId}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Get available symbols
   */
  getAvailableSymbols: async (): Promise<{ success: boolean; symbols: string[]; count: number }> => {
    const response = await api.get('/backtester/symbols', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Get backtester symbol data (tick size and tick value)
   */
  getSymbolData: async (): Promise<{ success: boolean; symbols: Record<string, { tickSize: number; tickValue: number }> }> => {
    const response = await api.get('/backtester/symbol-data', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Search symbols for TradingView chart
   */
  searchSymbols: async (query?: string): Promise<{ success: boolean; symbols: Record<string, { tickSize: number; tickValue: number }> }> => {
    const params = query ? { query } : {}
    const response = await api.get('/backtester/search', {
      headers: getAuthHeaders(),
      params,
    })
    return response.data
  },

  /**
   * Get server time
   */
  getServerTime: async (): Promise<{ success: boolean; timestamp: number; serverTime: string }> => {
    const response = await api.get('/backtester/time', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Save a backtester trade
   */
  saveTrade: async (trade: {
    sessionId: string;
    symbol: string;
    direction: 'long' | 'short';
    entryPrice: number;
    exitPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    contracts: number;
    entryTime: number;
    exitTime: number;
  }): Promise<{ success: boolean; tradeId: string }> => {
    const response = await api.post('/backtester/trades', trade, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Update session balance
   */
  updateSessionBalance: async (sessionId: string, balance: number): Promise<{ success: boolean }> => {
    const response = await api.put(`/backtester/sessions/${sessionId}/balance`, {
      balance,
    }, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Get session balance and P&L
   */
  getSessionStats: async (sessionId: string): Promise<{
    success: boolean;
    balance: number;
    realizedPnL: number;
    unrealizedPnL: number;
    initialBalance: number;
  }> => {
    const response = await api.get(`/backtester/sessions/${sessionId}/stats`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Get all backtester trades
   */
  getTrades: async (params?: {
    sessionId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    trades: Array<{
      id: string;
      session_id: string;
      symbol: string;
      direction: string;
      entry_price: number;
      exit_price: number | null;
      contracts: number;
      entry_time: string;
      exit_time: string | null;
      created_at: string;
    }>;
  }> => {
    const response = await api.get('/backtester/trades', {
      headers: getAuthHeaders(),
      params: params || {},
    })
    return response.data
  },

  /**
   * Get a single backtester trade by ID
   */
  getTrade: async (id: string): Promise<{
    success: boolean;
    trade: {
      id: string;
      session_id: string;
      symbol: string;
      direction: string;
      entry_price: number;
      exit_price: number | null;
      stop_loss: number | null;
      take_profit: number | null;
      contracts: number;
      entry_time: string;
      exit_time: string | null;
      created_at: string;
    };
  }> => {
    const response = await api.get(`/backtester/trades/${id}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Delete a backtester trade
   */
  deleteTrade: async (id: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await api.delete(`/backtester/trades/${id}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Get all symbols from config (admin only)
   */
  getSymbolsConfig: async (): Promise<{
    success: boolean;
    symbols: Record<string, {
      tickSize: number;
      tickValue: number;
      exchangeFee: number;
      regulatoryFee: number;
      commissionFee: number;
      totalFees: number;
      description: string;
    }>;
  }> => {
    const response = await api.get('/backtester/config/symbols', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Save or update a symbol in config (admin only)
   */
  saveSymbolConfig: async (symbolData: {
    symbol: string;
    tickSize: number;
    tickValue: number;
    exchangeFee?: number;
    regulatoryFee?: number;
    commissionFee?: number;
    totalFees?: number;
    description?: string;
    type?: 'topstep' | 'tradingview';
    ticker_type?: string;
  }): Promise<{
    success: boolean;
    message: string;
    symbol: any;
  }> => {
    const response = await api.post('/backtester/config/symbols', symbolData, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Delete a symbol from config (admin only)
   */
  deleteSymbolConfig: async (symbol: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await api.delete(`/backtester/config/symbols/${encodeURIComponent(symbol)}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /**
   * Get CSV files by type (admin only)
   */
  getCSVFilesByType: async (type: 'topstep' | 'tradingview'): Promise<{
    success: boolean;
    files: Array<{
      symbol: string;
      year: number;
      month: string;
      fileName: string;
      filePath: string;
      size: number;
      modified: string;
    }>;
    count: number;
  }> => {
    const response = await api.get('/backtester/config/csv-files', {
      headers: getAuthHeaders(),
      params: { type },
    })
    return response.data
  },

  /**
   * Get unknown CSV files (files not in config.json)
   */
  getUnknownFiles: async (): Promise<{
    success: boolean;
    files: Array<{
      symbol: string;
      year: number;
      month: string;
      fileName: string;
      filePath: string;
      size: number;
      modified: string;
    }>;
    count: number;
  }> => {
    const response = await api.get('/backtester/config/csv-files', {
      headers: getAuthHeaders(),
      params: { type: 'unknown' },
    })
    return response.data
  },

  

  /**
   * Get tokens from config (admin only)
   */
  getTokens: async (): Promise<{
    success: boolean;
    tokens: {
      topstep?: string;
      tradingview?: string;
    };
  }> => {
    const response = await api.get('/backtester/tokens', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

}
