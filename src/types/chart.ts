/**
 * Chart types for Auren (BetterweightChartPro + practice datafeeds).
 */

import type { CSSProperties } from 'react'
import type { BacktestSession } from './backtester'

export type ResolutionString = string

export type Bar = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
  tickVolume?: number
}

export type SubscribeBarsCallback = (bar: Bar) => void

export type Subscription = {
  symbol: string
  resolution: ResolutionString
  onRealtimeCallback: SubscribeBarsCallback
  lastBar: Bar | null
}

export type LibrarySymbolInfo = {
  name: string
  ticker?: string
  symbol?: string
  description?: string
  type?: string
  session?: string
  timezone?: string
  exchange?: string
  listed_exchange?: string
  format?: string
  pricescale?: number
  minmov?: number
  minmove2?: number
  fractional?: boolean
  has_intraday?: boolean
  has_seconds?: boolean
  has_ticks?: boolean
  supported_resolutions?: ResolutionString[]
  seconds_multipliers?: string[]
  intraday_multipliers?: string[]
  data_status?: string
  [key: string]: unknown
}

export interface IDatafeedChartApi {
  onReady(callback: (configuration: unknown) => void): void
  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: (symbols: unknown[]) => void
  ): void
  resolveSymbol(
    symbolName: string,
    onResolve: (info: LibrarySymbolInfo) => void,
    onError: (reason: string) => void
  ): void
  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: {
      from: number
      to: number
      firstDataRequest?: boolean
      countBack?: number
    },
    onResult: (bars: Bar[], meta: { noData: boolean }) => void,
    onError: (reason: string) => void
  ): void
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string
  ): void
  unsubscribeBars(listenerGuid: string): void
  /** Optional — enables BetterweightChartPro bid/ask price lines. */
  getQuotes?(
    symbolInfos: LibrarySymbolInfo | LibrarySymbolInfo[]
  ): Promise<Array<{ s: string; n: string; v: { bid: number; ask: number; lp?: number } }>>
  subscribeQuotes?(
    symbolInfos: LibrarySymbolInfo | LibrarySymbolInfo[],
    onQuotes: (quotes: unknown[]) => void,
    listenerGuid: string
  ): void
  unsubscribeQuotes?(listenerGuid: string): void
  supportsQuotes?: boolean
}

export type ChartPositionLineProps = {
  symbol: string
  chart: any
  datafeed?: any
  entryPrice: number
  price: number
  contracts: number
  lineType: 'position' | 'stop_loss' | 'take_profit'
  side?: string
  orderId?: number | string | null
  onMove?: (price: number) => void
  onCancel?: () => void
  onUpdate?: (...args: unknown[]) => void
  onMoving?: (...args: unknown[]) => void
}

export type AurenChartProps = {
  symbol?: string
  timeframe?: string
  isDark?: boolean
  containerId?: string
  className?: string
  style?: import('react').CSSProperties
  chrome?: boolean
  drawings?: boolean
  persistDrawings?: boolean
  compact?: boolean
  accountId?: string
  practiceAccountId?: string
  tradeseaServices?: Record<string, unknown> | null
  tradeseaTradeHandler?: {
    handleSymbolChange(symbol: string): void
    onReady(widget: unknown, datafeed?: unknown): void
    logButtonPress?(label: string, details?: Record<string, unknown>): void | Promise<void>
    placeLimitOrder?(side: string, quantity: number, price: number): void | Promise<void>
  }
  onSymbolChange?: (symbol: string) => void
  onChartReady?: () => void | Promise<void>
  onWidgetReady?: (widget: unknown) => void | Promise<void>
  onAutoSaveNeeded?: () => void | Promise<void>
}

/** @deprecated Use AurenChartProps */
export type TradingViewChartProps = AurenChartProps

export interface BacktesterChartProps {
  symbol?: string
  timeframe?: string
  isDark?: boolean
  style?: CSSProperties
  className?: string
  containerId?: string
  datafeed?: import('../backtester/components/chart/BacktesterChartDataFeed').BacktesterChartDataFeed
  session?: BacktestSession | null
  tradeHandler?: import('../backtester/services/BacktesterTradeHandler').BacktesterTradeHandler | null
  clientId?: string
  userId?: string
  onReady?: (widget: unknown) => void
  onWidgetReady?: (widget: unknown) => void
  onChartReady?: () => void | Promise<void>
  onSymbolChange?: (symbol: string) => void
  onIntervalChange?: (interval: string) => void
  onReplayHostAction?: (action: string, payload: Record<string, unknown>) => void
  tradeToolbarProps?: Pick<
    import('./tradePanel').TradePanelProps,
    | 'chartSymbol'
    | 'chartProductRoot'
    | 'chartSymbolHint'
    | 'tradeProductRoot'
    | 'searchSymbols'
    | 'onChartSymbolChange'
    | 'autoChangeTradeContract'
    | 'onAutoChangeTradeContract'
  >
}
