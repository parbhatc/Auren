/**
 * Backtester-related TypeScript interfaces
 */

export interface BacktestSession {
  id: string
  name: string
  symbol: string
  timeframe: string
  startDate: string
  startTime: string
  testingStrategyId?: string | null
  results?: BacktestResults
  createdAt: string
  initialBalance?: number
  currentBalance?: number
}

export interface BacktestResults {
  totalTrades: number
  winRate: number
  profit: number
  maxDrawdown: number
}

export interface NewSessionData {
  name: string
  date: string
  startTime: string
  balance?: number
}

/**
 * Component Props Interfaces
 */

export interface BacktesterHeaderProps {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
}

export interface SessionCardProps {
  session: BacktestSession
  isActive: boolean
  isDark: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export interface SessionsSidebarProps {
  isDark: boolean
  sessions: BacktestSession[]
  activeSessionId: string | null
  availableSymbols: string[]
  symbolsError: string
  onSelectSession: (sessionId: string) => void
  onDuplicateSession: (session: BacktestSession) => void
  onDeleteSession: (sessionId: string) => void
  onCreateClick: () => void
  onSymbolsError: (error: string) => void
}

export interface CreateSessionModalProps {
  isOpen: boolean
  isDark: boolean
  availableSymbols: string[]
  newSession: NewSessionData
  symbolsError: string
  createError: string
  onClose: () => void
  onSessionChange: (session: NewSessionData) => void
  onCreate: () => void
}

export interface SessionControlsProps {
  isDark: boolean
  session: BacktestSession
  onRun: () => void
  onStop: () => void
}

export interface SessionResultsProps {
  isDark: boolean
  results: BacktestResults
}

// TradingViewChartProps moved to src/types/chart.ts
// Re-export for backward compatibility
export type { TradingViewChartProps } from './chart'

export interface SessionDateNavigationProps {
  isDark: boolean
  session: BacktestSession | null
  tradeHandler: any | null // BacktesterTradeHandler - avoiding circular dependency
}

export interface BacktesterProps {
  isDark: boolean
  toggleTheme: () => void
  user: any
  colors: any
  navigate: (path: string) => void
  sessions: BacktestSession[]
  activeSessionId: string | null
  showNewSessionForm: boolean
  availableSymbols: string[]
  symbolsError: string
  createError: string
  newSession: NewSessionData
  activeSession: BacktestSession | undefined
  onSelectSession: (sessionId: string) => void
  onDuplicateSession: (session: BacktestSession) => void
  onDeleteSession: (sessionId: string) => void
  onCreateClick: () => void
  onCloseNewSessionForm: () => void
  onSessionChange: (session: NewSessionData) => void
  onCreateSession: () => void
  onRunBacktest: (sessionId: string) => void
  onStopBacktest: (sessionId: string) => void
  onSymbolsError: (error: string) => void
}

export interface BacktesterSessionsListProps {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  colors: any
  sessions: BacktestSession[]
  showNewSessionForm: boolean
  availableSymbols: string[]
  symbolsError: string
  createError: string
  newSession: NewSessionData
  onDeleteSession: (sessionId: string) => void
  onResetSession: (sessionId: string) => void
  onPlaySession: (sessionId: string) => void
  onEditSession: (sessionId: string) => void
  onCreateClick: () => void
  onCloseNewSessionForm: () => void
  onSessionChange: (session: NewSessionData) => void
  onCreateSession: () => void
  onSymbolsError: (error: string) => void
}

export interface BacktesterChartViewProps {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  colors: any
  session: BacktestSession | null
  sessions?: BacktestSession[]
  onRunBacktest: (sessionId: string) => void
  onStopBacktest: (sessionId: string) => void
  onSessionUpdate?: (session: BacktestSession) => void
}

export interface ResetSessionModalState {
  name: string
  startDate: string
  startTime: string
  balance: number
}

export interface ResetSessionModalProps {
  isOpen: boolean
  isDark: boolean
  session: BacktestSession | null
  availableSymbols?: string[]
  onClose: () => void
  onReset: (session: BacktestSession) => void
  error?: string | null
}

/**
 * WebSocket Client Interfaces
 */
export interface BacktesterChartClientCallbacks {
  onConnected?: () => void
  onDisconnected?: () => void
  onMessage?: (message: any) => void
  onError?: (error: Event) => void
  // Specific message type handlers
  onServerTime?: (data: { type: string; timestamp?: number; serverTime?: string }) => void
  onClientTime?: (data: any) => void
  onConnectedMessage?: (data: { type: string; message: string; timestamp: string }) => void
  // Chart ready callback - called when WebSocket is connected and chart should be displayed
  onChartReady?: () => void
  // Backtester-specific callbacks
  onReplayResponse?: (data: { type: string; time: string }) => void
  onDateNavigationResponse?: (data: { type: string; date: string; success: boolean; error: string }) => void
  // Add more specific handlers as needed
  // onTradeUpdate?: (data: any) => void
  // onPriceUpdate?: (data: any) => void
}

export interface BacktesterChartClientOptions {
  session: BacktestSession | null
}

