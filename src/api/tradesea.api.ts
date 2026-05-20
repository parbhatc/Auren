import api, { getAuthHeaders } from './api'

export interface TradeseaOtpSendResponse {
  success: boolean
  ok?: boolean
  deviceId?: string
  error?: string
}

export interface TradeseaOtpVerifyResponse {
  success: boolean
  ok?: boolean
  accessToken?: string
  refreshToken?: string
  email?: string
  firstName?: string | null
  error?: string
}

export interface TradeseaConnectionResponse {
  success: boolean
  configured?: boolean
  connected?: boolean
  email?: string | null
  name?: string | null
  reason?: string
}

export interface TradeseaAccount {
  id: string
  label: string
  propFirm?: string
  propFirmDisplayName?: string
  name?: string
  accountType?: string
  userId?: string
  externalAccountId?: string
  externalUserId?: string
}

export interface TradeseaAccountsResponse {
  success: boolean
  connected?: boolean
  accounts?: TradeseaAccount[]
  defaultAccountId?: string | null
  message?: string
  sessionExpired?: boolean
}

export interface TradeseaRefreshSessionResponse {
  success: boolean
  connected?: boolean
  message?: string
  sessionExpired?: boolean
}

export interface TradeseaStreamConfig {
  success: boolean
  connected?: boolean
  /** Feed account id — trades / unified user-data WebSocket path */
  accountId?: string
  mode?: 'sandbox' | 'lucid'
  delayed?: boolean
  /** MDS WebSocket path + UDF connection-user-id (may differ from accountId on production feeds) */
  userId?: string
  /** Same as accountId; explicit for trades WS */
  tradesUserId?: string
  accountType?: string
  propFirm?: string
  mdsStreamBase?: string
  udfOrigin?: string
  tradesReadOrigin?: string | null
  tradesWriteOrigin?: string | null
  error?: string
  message?: string
}

export interface TradeseaPlaceOrderRequest {
  accountId: string
  instrument: string
  qty: number
  side: 'buy' | 'sell'
  type?: 'market' | 'limit' | 'stop' | 'stoplimit'
  durationType?: string
  currentAsk?: number
  currentBid?: number
  limitPrice?: number
  stopPrice?: number
  stopLoss?: number
  takeProfit?: number
  locale?: string
}

export interface TradeseaPlaceOrderResponse {
  success: boolean
  s?: string
  d?: { orderId?: string; transactionId?: string }
  requestId?: string
  error?: string
  errmsg?: string
}

export interface TradeseaExecution {
  id: string
  instrument: string
  price: number
  time: number
  qty: number
  side: string
  orderId: string
  isClose?: boolean
  commission?: number
}

export interface TradeseaExecutionsResponse {
  success: boolean
  s?: string
  d?: TradeseaExecution[]
  error?: string
  errmsg?: string
}

export interface TradeseaTradeActionResponse {
  success: boolean
  s?: string
  d?: { orderId?: string; transactionId?: string }
  requestId?: string
  error?: string
  errmsg?: string
}

export interface TradeseaTradelensRequest {
  accountId: string
  from?: string
  to?: string
  timezoneOffset?: number
  tags?: string[]
  instruments?: string[]
  archivedAccountIds?: string[]
}

export interface TradeseaTradelensResponse<T = unknown> {
  success: boolean
  s?: string
  d?: T
  error?: string
  message?: string
}

export interface TradeseaClosePositionRequest {
  accountId: string
  positionId: string
  amount?: number
  locale?: string
}

export const tradeseaAPI = {
  sendOtp: async (email: string, resend = false, deviceId?: string): Promise<TradeseaOtpSendResponse> => {
    const response = await api.post<TradeseaOtpSendResponse>(
      '/tradesea/otp/send',
      { email, resend, deviceId },
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  verifyOtp: async (
    email: string,
    otp: string,
    deviceId: string
  ): Promise<TradeseaOtpVerifyResponse> => {
    const response = await api.post<TradeseaOtpVerifyResponse>(
      '/tradesea/otp/verify',
      { email, otp, deviceId },
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  getConnectionStatus: async (): Promise<TradeseaConnectionResponse> => {
    const response = await api.get<TradeseaConnectionResponse>('/tradesea/connection', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  refreshSession: async (): Promise<TradeseaRefreshSessionResponse> => {
    const response = await api.post<TradeseaRefreshSessionResponse>(
      '/tradesea/session/refresh',
      {},
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  getAccounts: async (): Promise<TradeseaAccountsResponse> => {
    const response = await api.get<TradeseaAccountsResponse>('/tradesea/accounts', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  getStreamConfig: async (accountId: string): Promise<TradeseaStreamConfig> => {
    const response = await api.get<TradeseaStreamConfig>('/tradesea/stream-config', {
      headers: getAuthHeaders(),
      params: { accountId },
    })
    return response.data
  },

  placeOrder: async (order: TradeseaPlaceOrderRequest): Promise<TradeseaPlaceOrderResponse> => {
    const response = await api.post<TradeseaPlaceOrderResponse>('/tradesea/orders', order, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  getExecutions: async (
    accountId: string,
    instrument: string,
    maxCount = 100
  ): Promise<TradeseaExecutionsResponse> => {
    const response = await api.get<TradeseaExecutionsResponse>('/tradesea/executions', {
      headers: getAuthHeaders(),
      params: { accountId, instrument, maxCount, locale: 'en-US' },
    })
    return response.data
  },

  closePosition: async (body: TradeseaClosePositionRequest): Promise<TradeseaTradeActionResponse> => {
    const response = await api.post<TradeseaTradeActionResponse>('/tradesea/positions/close', body, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  reversePosition: async (body: {
    accountId: string
    positionId: string
    locale?: string
  }): Promise<TradeseaTradeActionResponse> => {
    const response = await api.post<TradeseaTradeActionResponse>('/tradesea/positions/reverse', body, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  cancelAllOrders: async (accountId: string): Promise<TradeseaTradeActionResponse> => {
    const response = await api.post<TradeseaTradeActionResponse>(
      '/tradesea/orders/cancel-all',
      { accountId, locale: 'en-US' },
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  modifyPosition: async (body: {
    accountId: string
    positionId: string
    stopLoss?: number
    takeProfit?: number
    trailingStopPips?: number
    locale?: string
  }): Promise<TradeseaTradeActionResponse> => {
    const response = await api.post<TradeseaTradeActionResponse>('/tradesea/positions/modify', body, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  cancelOrder: async (body: {
    accountId: string
    orderId: string
    locale?: string
  }): Promise<TradeseaTradeActionResponse> => {
    const response = await api.post<TradeseaTradeActionResponse>('/tradesea/orders/cancel', body, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  flattenAll: async (accountId: string): Promise<TradeseaTradeActionResponse> => {
    const response = await api.post<TradeseaTradeActionResponse>(
      '/tradesea/accounts/flatten-all',
      { accountId, locale: 'en-US' },
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  getTradelensDashboard: async (
    body: TradeseaTradelensRequest
  ): Promise<TradeseaTradelensResponse> => {
    const response = await api.post<TradeseaTradelensResponse>(
      '/tradesea/tradelens/dashboard',
      {
        ...body,
        timezoneOffset: body.timezoneOffset ?? new Date().getTimezoneOffset(),
      },
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  getTradelensCalendar: async (
    body: TradeseaTradelensRequest
  ): Promise<
    TradeseaTradelensResponse<{
      pnlAndTradeCountCalendar?: Array<{
        pnl: number
        tradesCount: number
        tradeWinPer: number
        date: string
      }>
    }>
  > => {
    const response = await api.post(
      '/tradesea/tradelens/calendar',
      {
        ...body,
        timezoneOffset: body.timezoneOffset ?? new Date().getTimezoneOffset(),
      },
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  getTradelensTrades: async (
    body: TradeseaTradelensRequest
  ): Promise<TradeseaTradelensResponse<{ tradesList?: unknown[] }>> => {
    const response = await api.post<TradeseaTradelensResponse<{ tradesList?: unknown[] }>>(
      '/tradesea/tradelens/trades',
      {
        ...body,
        timezoneOffset: body.timezoneOffset ?? new Date().getTimezoneOffset(),
      },
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  getTradelensCurrentTradeDay: async (
    accountId: string
  ): Promise<TradeseaTradelensResponse<{ tradesList?: unknown[] }>> => {
    const response = await api.get<TradeseaTradelensResponse<{ tradesList?: unknown[] }>>(
      `/tradesea/tradelens/trades/${encodeURIComponent(accountId)}/current-trade-day`,
      { headers: getAuthHeaders() }
    )
    return response.data
  },
}
