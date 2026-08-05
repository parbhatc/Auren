import { getThemeColors } from '../constants/theme'
import type { HubTab } from './practiceHub'
import type { CsvDataWsSource } from '../components/backtester/DataManagement/csvDataPrefs'

export interface CsvInventoryEntry {
  symbol: string
  resolution: string
  resolutionLabel: string
  fromMs: number
  toMs: number
  fromLabel: string
  toLabel: string
}

export interface SymbolData {
  tickSize: number
  tickValue: number
  exchangeFee: number
  regulatoryFee: number
  commissionFee: number
  totalFees: number
  description: string
  tickers?: {
    tradesea?: string
    tradingview?: string
  }
}

export interface FileData {
  symbol: string
  year: number
  month: string
  fileName: string
  filePath: string
  size: number
  modified: string
}

export interface DeleteConfirm {
  isOpen: boolean
  symbol: string | null
}

export interface BacktesterDataManagementRendererProps {
  isDark: boolean
  toggleTheme: () => void
  user: any
  colors: ReturnType<typeof getThemeColors>
  navigate: (path: string) => void
  symbols: Record<string, SymbolData>
  loading: boolean
  error: string
  success: string
  editingSymbol: string | null
  editingData: Partial<SymbolData & { symbol?: string }> | null
  onEdit: (symbol: string) => void
  onCancelEdit: () => void
  onSave: (symbol: string, data: SymbolData) => void
  onDelete: (symbol: string) => void
  onAdd: () => void
  onUpdateEditingData: (
    field: keyof SymbolData | 'symbol' | 'tradeseaTicker' | 'tradingviewTicker',
    value: string | number
  ) => void
  saving: boolean
  deleteConfirm: DeleteConfirm
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
  onHubTabChange: (tab: HubTab) => void
  onLogout: () => void
  activeTab: 'symbol-info' | 'csv-data'
  onTabChange: (tab: 'symbol-info' | 'csv-data') => void
  csvInventory: CsvInventoryEntry[]
  loadingCsvInventory: boolean
  onCsvUpdate: (symbol: string, source: CsvDataWsSource, resolution?: string) => Promise<void>
  onCsvOverwrite: (symbol: string, source: CsvDataWsSource, resolution?: string) => Promise<void>
  onCsvDownload: (symbol: string, source: CsvDataWsSource, resolution?: string) => Promise<void>
  onCsvTradingViewTokenChange?: (token: string) => void
  onCsvTradingViewTokenBlur?: (token: string) => void
  tradingviewCurrentToken: string
  progressState?: Record<string, {
    symbol: string
    source: CsvDataWsSource
    action: 'download' | 'update' | 'overwrite' | 'reset'
    progress: number
    message: string
    timestamp: number
    completed?: boolean
  }>
}

export interface TokenSelectorProps {
  currentToken: string
  onCurrentTokenChange: (token: string) => void
  savedToken?: string
  onTokenObtained?: (token: string) => void
  onSaveToken?: (token: string, source: 'tradesea' | 'tradingview') => Promise<{ success: boolean; message?: string; error?: string }>
  onUserLogin?: (username: string, password: string, source: 'tradesea' | 'tradingview') => Promise<{ success: boolean; token?: string; error?: string }>
  colorScheme: 'blue' | 'purple'
  isDark: boolean
  source: 'tradesea' | 'tradingview'
}

export interface TradeseaSearchResult {
  symbol?: string
  full_name?: string
  description?: string
  ticker?: string | null
  exchange?: string | null
  type?: string
  [key: string]: any
}

export interface TradingViewSearchResult {
  symbol?: string
  description?: string
  type?: string
  exchange?: string
  currency_code?: string
  country?: string
  source_id?: string
  formattedSymbol?: string
  contracts?: Contract[]
  source2?: {
    id?: string
    name?: string
    description?: string
  }
  [key: string]: any
}

export interface SymbolInfoDialogProps {
  isOpen: boolean
  symbol: string
  type: 'tradesea' | 'tradingview'
  symbolData?: SymbolData
  tradeseaData?: TradeseaSearchResult
  tradingViewData?: TradingViewSearchResult
  tradeseaFiles?: FileData[]
  tradingviewFiles?: FileData[]
  unknownFiles?: FileData[]
  symbols?: Record<string, SymbolData>
  isDark: boolean
  onClose: () => void
  onUpdate?: (symbol: string) => Promise<void>
  onOverwrite?: (symbol: string) => Promise<void>
  onReset?: (symbol: string) => Promise<void>
  onDownload?: (symbol: string, type: 'tradesea' | 'tradingview') => Promise<void>
  progressState?: Record<string, {
    symbol: string
    source: 'tradesea' | 'tradingview'
    action: 'download' | 'update' | 'overwrite' | 'reset'
    progress: number
    message: string
    timestamp: number
    completed?: boolean
  }>
}

export interface Contract {
  symbol?: string
  description?: string
  type?: string
  typespecs?: string[]
  prefix?: string
  source_logoid?: string
}

export interface SearchResult {
  symbol?: string
  full_name?: string
  description?: string
  ticker?: string
  exchange?: string
  type?: string
  country?: string
  currency_code?: string
  source_id?: string
  formattedSymbol?: string
  contracts?: Contract[]
  source2?: {
    id?: string
    name?: string
    description?: string
  }
  [key: string]: any
}

export interface DataSourceSectionProps {
  title: string
  searchValue: string
  searchResults: (string | SearchResult)[]
  searchError?: string
  searchLoading?: boolean
  onSearchChange: (value: string) => void
  files: FileData[]
  loadingFiles: boolean
  type: 'tradesea' | 'tradingview'
  colorScheme: 'blue' | 'purple'
  isDark: boolean
  expandedSymbols: Set<string>
  expandedYears: Set<string>
  onToggleSymbol: (symbol: string) => void
  onToggleYear: (yearKey: string) => void
  onSymbolClick?: (symbol: string, type: 'tradesea' | 'tradingview') => void
  progressState?: Record<string, {
    symbol: string
    source: 'tradesea' | 'tradingview'
    action: 'download' | 'update' | 'overwrite' | 'reset'
    progress: number
    message: string
    timestamp: number
    completed?: boolean
  }>
  symbolsConfig?: Record<string, {
    tickSize: number
    tickValue: number
    exchangeFee: number
    regulatoryFee: number
    commissionFee: number
    totalFees: number
    description: string
    type?: 'tradesea' | 'tradingview'
    ticker_type?: string
  }>
}

export interface SymbolConfigDialogProps {
  isOpen: boolean
  symbol: string
  type: 'tradesea' | 'tradingview'
  description?: string
  tickerType?: string // Optional initial ticker type (e.g., 'futures', 'stocks', etc.)
  symbols?: Record<string, {
    tickSize: number
    tickValue: number
    exchangeFee?: number
    regulatoryFee?: number
    commissionFee?: number
    totalFees?: number
    description?: string
    type?: 'tradesea' | 'tradingview'
    ticker_type?: string
  }>
  isDark: boolean
  onClose: () => void
  onSaveAndDownload: (config: {
    symbol: string
    tickSize: number
    tickValue: number
    ticker_type: string
    description: string
    type: 'tradesea' | 'tradingview'
    exchangeFee?: number
    regulatoryFee?: number
    commissionFee?: number
    totalFees?: number
  }) => Promise<void>
}

// WebSocket Client interfaces
import type { WebSocketClientCallbacks } from './websocket'

export interface BacktesterDataClientCallbacks extends WebSocketClientCallbacks {
  onTabChangeResponse?: (data: { type: string; success: boolean; tab: string }) => void
  onSearchResponse?: (data: { type: string; success: boolean; results: string[]; error?: string }) => void
  onInitialData?: (data: {
    type: string
    success: boolean
    data: {
      tokens: { tradesea?: string; tradingview?: string }
      sessions?: { tradingview?: string }
      symbols: Record<string, any>
      csvFiles: {
        tradesea: Array<{
          symbol: string
          year: number
          month: string
          fileName: string
          filePath: string
          size: number
          modified: string
        }>
        tradingview: Array<{
          symbol: string
          year: number
          month: string
          fileName: string
          filePath: string
          size: number
          modified: string
        }>
        unknown: Array<{
          symbol: string
          year: number
          month: string
          fileName: string
          filePath: string
          size: number
          modified: string
        }>
      }
    }
  }) => void
  onSaveTokenResponse?: (data: { type: string; success: boolean; message?: string; error?: string }) => void
  onUserLoginResponse?: (data: { type: string; success: boolean; token?: string; error?: string }) => void
  onDownloadResponse?: (data: { type: string; success: boolean; message?: string; error?: string }) => void
  onUpdateResponse?: (data: { type: string; success: boolean; message?: string; error?: string }) => void
  onOverwriteResponse?: (data: { type: string; success: boolean; message?: string; error?: string }) => void
  onResetResponse?: (data: { type: string; success: boolean; message?: string; error?: string }) => void
  onProgressResponse?: (data: { 
    type: string
    action: 'download' | 'update' | 'overwrite' | 'reset'
    symbol: string
    source: 'tradesea' | 'tradingview'
    progress: number
    message?: string
    completed?: boolean
  }) => void
}

export interface BacktesterDataClientOptions {
  // Add any specific options for data management client
}
