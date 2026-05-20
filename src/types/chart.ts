/**
 * TradingView Chart related TypeScript interfaces
 */

/**
 * TradingView DataFeed Interfaces
 * Based on TradingView Charting Library datafeed API
 */

export type ResolutionString = string

export interface LibrarySymbolInfo {
  symbol?: string
  name?: string
  ticker?: string
  description?: string
  type?: string
  session?: string
  timezone?: string
  exchange?: string
  listed_exchange?: string
  format?: string
  minmov?: number
  pricescale?: number
  has_intraday?: boolean
  has_weekly_and_monthly?: boolean
  supported_resolutions?: ResolutionString[]
  volume_precision?: number
  data_status?: string
  [key: string]: any
}

export interface GetBarsResult {
  bars: Bar[]
  meta: {
    noData: boolean
  }
}

export interface Bar {
  time: number
  low: number
  high: number
  open: number
  close: number
  tickVolume: number
  volume: number
}

export type SubscribeBarsCallback = (bar: Bar) => void

/**
 * Subscription interface for realtime bar subscriptions
 * Used by datafeed implementations to track active subscriptions
 */
export interface Subscription {
  symbol: string
  symbolId?: string
  resolution: ResolutionString
  onRealtimeCallback: SubscribeBarsCallback
  lastBar: Bar | null
}

export interface IDatafeedChartApi {
  onReady(callback: (configuration: any) => void): void
  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReadyCallback: (symbols: LibrarySymbolInfo[]) => void
  ): void
  resolveSymbol(
    symbolName: string,
    onSymbolResolvedCallback: (symbolInfo: LibrarySymbolInfo) => void,
    onResolveErrorCallback: (reason: string) => void,
    extension?: any
  ): void
  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: any,
    onHistoryCallback: (bars: Bar[], meta: { noData: boolean, nextTime?: number }) => void,
    onErrorCallback: (reason: string) => void
  ): void
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onRealtimeCallback: SubscribeBarsCallback,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void
  ): void
  unsubscribeBars(subscriberUID: string): void
  getServerTime?(callback: (time: number) => void): void
}

/**
 * TradingView Widget Configuration Options
 * Based on TradingView Charting Library widget options
 * All options are modifiable through widgetConfig prop
 */
export interface TradingViewWidgetConfig {
  // Basic Configuration
  symbol?: string
  interval?: string
  container?: HTMLElement | string
  library_path?: string
  locale?: string
  theme?: 'light' | 'dark'
  timezone?: string
  fullscreen?: boolean
  autosize?: boolean
  width?: number | string
  height?: number | string

  // Features
  disabled_features?: string[]
  enabled_features?: string[]
  
  // Storage Configuration
  charts_storage_url?: string
  charts_storage_api_version?: string
  client_id?: string
  user_id?: string
  load_last_chart?: boolean
  saved_data?: any
  snapshot_url?: string

  // Styling
  toolbar_bg?: string
  custom_css_url?: string
  loading_screen?: {
    backgroundColor?: string
    foregroundColor?: string
  }

  // Data & Overrides
  datafeed?: any
  overrides?: Record<string, any>
  studies_overrides?: Record<string, any>

  // Advanced Features
  debug?: boolean
  
  // Broker Integration
  broker_factory?: (host: string) => any
  
  // Context Menu
  context_menu?: {
    items_processor?: (items: any[], actionsFactory: any, params?: any) => any[] | Promise<any[]>
    renderer_factory?: (params: any) => any
  }
  
  // Custom Indicators
  custom_indicators_getter?: (PineJS: any) => Promise<any[]>
  
  // Additional TradingView options
  [key: string]: any
}

/**
 * Chart Context Menu Callbacks
 * Callbacks for trading actions from the context menu
 */
export interface ChartContextMenuCallbacks {
  onMarketBuy?: (quantity: number, price: number, time?: number) => void
  onMarketSell?: (quantity: number, price: number, time?: number) => void
  onLimitBuy?: (quantity: number, limitPrice: number, price: number, time?: number) => void
  onStopSell?: (quantity: number, stopPrice: number, price: number, time?: number) => void
}

/**
 * TradingView Chart Component Props
 */
export interface TradingViewChartProps {
  /** Symbol to display (e.g., 'AAPL', 'BTCUSD') */
  symbol: string
  /** Timeframe/interval (e.g., '1h', '1D', '1W') */
  timeframe?: string
  /** Dark mode theme */
  isDark?: boolean
  /** Custom widget configuration - will be merged with defaults */
  widgetConfig?: Partial<TradingViewWidgetConfig>
  /** Custom container style */
  style?: React.CSSProperties
  /** Custom container className */
  className?: string
  /** TradingView library path (default: '/charting_library/') */
  libraryPath?: string
  /** Charts storage URL (default: 'https://saveload.tradingview.com') */
  chartsStorageUrl?: string
  /** Charts storage API version (default: '1.1') */
  chartsStorageApiVersion?: string
  /** Client ID for charts storage (default: 'tradingview.com') */
  clientId?: string
  /** User ID for charts storage (default: 'public_user_id') */
  userId?: string
  /** Custom datafeed for chart data (can also be provided via widgetConfig) */
  datafeed?: IDatafeedChartApi
  /** Timezone for the chart (must be a supported TradingView timezone) */
  timezone?: string
  /** Whether to load the last saved chart (default: false) */
  loadLastChart?: boolean
  /** Callback when widget is loaded */
  onWidgetReady?: (widget: any) => void
  /** Callback when widget encounters an error */
  onError?: (error: Error) => void
  /** Callback when auto-save is needed */
  onAutoSaveNeeded?: () => Promise<void>
  /** Callback when chart is ready */
  onChartReady?: () => Promise<void>
  /** Callback when interval/resolution changes */
  onIntervalChange?: (interval: string) => void
  /** Callback when symbol changes */
  onSymbolChange?: (symbol: string) => void
}

export interface PivotInfo {
  candle: any
  price: number
  time: number
}

export interface ChartPositionLineProps {
  /** Symbol of the position */
  symbol: string
  /** Price of the position */
  price: number
  /** Entry price of the position */
  entryPrice: number
  /** Number of contracts */
  contracts: number
  /** Type of line: position, stop_loss, or take_profit */
  lineType: 'position' | 'stop_loss' | 'take_profit'
  /** Chart reference/widget instance */
  chart: any
  /** Datafeed instance */
  datafeed?: any
  /** Callback when line is cancelled */
  onCancel?: () => void
  /** Callback when line is updated */
  onUpdate?: (price: number, type?: 'stop_loss' | 'take_profit' | 'limit_order' | 'stop_profit' | null | undefined) => void
  /** Callback when line is being moved */
  onMoving?: (price: number) => void
}

