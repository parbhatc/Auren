import { getThemeColors } from '../constants/theme'

export interface SymbolData {
  tickSize: number
  tickValue: number
  exchangeFee: number
  regulatoryFee: number
  commissionFee: number
  totalFees: number
  description: string
  type?: 'topstep' | 'tradingview'
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
  onUpdateEditingData: (field: keyof SymbolData, value: string | number) => void
  saving: boolean
  deleteConfirm: DeleteConfirm
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
  activeTab: 'symbol-info' | 'topstep' | 'tradingview'
  onTabChange: (tab: 'symbol-info' | 'topstep' | 'tradingview') => void
  topstepFiles: FileData[]
  tradingviewFiles: FileData[]
  unknownFiles?: FileData[]
  loadingFiles: boolean
  expandedSymbols: Set<string>
  expandedYears: Set<string>
  onToggleSymbol: (symbol: string) => void
  onToggleYear: (yearKey: string) => void
  topstepSearch: string
  tradingviewSearch: string
  topstepSearchResults: string[]
  tradingviewSearchResults: string[]
  topstepSearchError?: string
  tradingviewSearchError?: string
  topstepSearchLoading?: boolean
  tradingviewSearchLoading?: boolean
  onTopstepSearchChange: (value: string) => void
  onTradingviewSearchChange: (value: string) => void
  topstepCurrentToken: string
  tradingviewCurrentToken: string
  topstepSavedToken?: string
  tradingviewSavedToken?: string
  onTopstepCurrentTokenChange: (token: string) => void
  onTradingviewCurrentTokenChange: (token: string) => void
  onTopstepTokenObtained?: (token: string) => void
  onTradingviewTokenObtained?: (token: string) => void
  onTopstepSaveToken?: (token: string, source: 'topstep' | 'tradingview') => Promise<{ success: boolean; message?: string; error?: string }>
  onTradingviewSaveToken?: (token: string, source: 'topstep' | 'tradingview') => Promise<{ success: boolean; message?: string; error?: string }>
  onTopstepUserLogin?: (username: string, password: string, source: 'topstep' | 'tradingview') => Promise<{ success: boolean; token?: string; error?: string }>
  onTradingviewUserLogin?: (username: string, password: string, source: 'topstep' | 'tradingview') => Promise<{ success: boolean; token?: string; error?: string }>
  selectedSymbol: { 
    symbol: string
    type: 'topstep' | 'tradingview'
    topstepData?: TopstepSearchResult
    tradingViewData?: TradingViewSearchResult
  } | null
  onSymbolClick: (symbol: string, type: 'topstep' | 'tradingview') => void
  onSymbolDialogClose: () => void
  onSymbolUpdate: (symbol: string) => Promise<void>
  onSymbolOverwrite: (symbol: string) => Promise<void>
  onSymbolReset: (symbol: string) => Promise<void>
  onSymbolDownload: (symbol: string, type: 'topstep' | 'tradingview') => Promise<void>
  progressState?: Record<string, {
    symbol: string
    source: 'topstep' | 'tradingview'
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
  onSaveToken?: (token: string, source: 'topstep' | 'tradingview') => Promise<{ success: boolean; message?: string; error?: string }>
  onUserLogin?: (username: string, password: string, source: 'topstep' | 'tradingview') => Promise<{ success: boolean; token?: string; error?: string }>
  colorScheme: 'blue' | 'purple'
  isDark: boolean
  source: 'topstep' | 'tradingview'
}

export interface TopstepSearchResult {
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
  type: 'topstep' | 'tradingview'
  symbolData?: SymbolData
  topstepData?: TopstepSearchResult
  tradingViewData?: TradingViewSearchResult
  topstepFiles?: FileData[]
  tradingviewFiles?: FileData[]
  unknownFiles?: FileData[]
  symbols?: Record<string, SymbolData>
  isDark: boolean
  onClose: () => void
  onUpdate?: (symbol: string) => Promise<void>
  onOverwrite?: (symbol: string) => Promise<void>
  onReset?: (symbol: string) => Promise<void>
  onDownload?: (symbol: string, type: 'topstep' | 'tradingview') => Promise<void>
  progressState?: Record<string, {
    symbol: string
    source: 'topstep' | 'tradingview'
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
  type: 'topstep' | 'tradingview'
  colorScheme: 'blue' | 'purple'
  isDark: boolean
  expandedSymbols: Set<string>
  expandedYears: Set<string>
  onToggleSymbol: (symbol: string) => void
  onToggleYear: (yearKey: string) => void
  onSymbolClick?: (symbol: string, type: 'topstep' | 'tradingview') => void
  progressState?: Record<string, {
    symbol: string
    source: 'topstep' | 'tradingview'
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
    type?: 'topstep' | 'tradingview'
    ticker_type?: string
  }>
}

export interface SymbolConfigDialogProps {
  isOpen: boolean
  symbol: string
  type: 'topstep' | 'tradingview'
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
    type?: 'topstep' | 'tradingview'
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
    type: 'topstep' | 'tradingview'
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
      tokens: { topstep?: string; tradingview?: string }
      symbols: Record<string, any>
      csvFiles: {
        topstep: Array<{
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
    source: 'topstep' | 'tradingview'
    progress: number
    message?: string
    completed?: boolean
  }) => void
}

export interface BacktesterDataClientOptions {
  // Add any specific options for data management client
}
