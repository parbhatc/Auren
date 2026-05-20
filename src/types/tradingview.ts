/**
 * TradingView related TypeScript interfaces
 */

import { WebSocketClientCallbacks } from './websocket'
import type { TradingViewClient } from '../services/tradingview/TradingViewClient'

/**
 * TradingView Data WebSocket Callbacks
 */
export interface TradingViewDataWebSocketCallbacks extends WebSocketClientCallbacks {
  onAuthSuccess?: () => void
  onAuthFailed?: (error: any) => void
  onProtocolError?: (error: string) => void
}

/**
 * TradingView Data WebSocket Options
 */
export interface TradingViewDataWebSocketOptions {
  sessionId?: string
  chartId?: string
  token?: string | null
}

/**
 * TradingView Series Callbacks
 */
export interface TradingViewSeriesCallbacks {
  onSymbolResolved?: (data: any) => void
  onSymbolError?: (error: any) => void
  onSeriesLoading?: (data: any) => void
  onSeriesCompleted?: (data: any) => void
  onSeriesError?: (error: any) => void
  onTimescaleUpdate?: (data: any) => void
}

/**
 * TradingView Series Options
 */
export interface TradingViewSeriesOptions {
  session?: string
  adjustment?: string
  currencyId?: string
  metric?: string
}

/**
 * TradingView WebSocket Client Callbacks
 */
export interface TradingViewWebSocketCallbacks extends WebSocketClientCallbacks {
  onSessionInit?: (data: any) => void
  onChartReady?: () => void
  onSymbolResolved?: (symbolData: any, symbolRequestId: string, chartSessionId: string) => void
  onSeriesLoading?: (chartSessionId: string, seriesId: string, subSeriesId: string) => void
  onSeriesCompleted?: (chartSessionId: string, seriesId: string, status: string, subSeriesId: string, options: any) => void
  onTimescaleUpdate?: (chartSessionId: string, seriesData: any, updateData: any) => void
}

/**
 * TradingView WebSocket Client Options
 */
export interface TradingViewWebSocketOptions {
  baseURL?: string
  token?: string | null
  locale?: string
  country?: string
  timezone?: string
  headers?: Record<string, string>
}

/**
 * TradingView Datafeed Options
 */
export interface TradingViewDatafeedOptions {
  client: TradingViewClient
  onError?: (error: Error) => void
}

/**
 * TradingView Handler Options
 */
export interface TradingViewHandlerOptions {
  token?: string | null
  timezone?: string
  locale?: string
  country?: string
  onError?: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

/**
 * TradingView API Interfaces
 */
export interface TradingViewContract {
  symbol: string
  broker_symbol?: string
  source_logoid?: string
  typespecs?: string[]
  prefix?: string
  description?: string
}

export interface TradingViewSearchResult {
  symbol: string
  description: string
  type: string
  exchange: string
  found_by_isin?: boolean
  found_by_cusip?: boolean
  currency_code?: string
  'currency-logoid'?: string
  logoid?: string
  provider_id?: string
  source_logoid?: string
  source2?: {
    id: string
    name: string
    description: string
  }
  source_id?: string
  country?: string
  contracts?: TradingViewContract[]
  isin?: string
}

export interface TradingViewSearchResponse {
  success: boolean
  data?: {
    symbols_remaining?: number
    symbols?: TradingViewSearchResult[]
    [key: string]: any
  }
  message?: string
}
