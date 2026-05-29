/**
 * Common component props interfaces
 */

export interface ModalProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  isDark?: boolean
}

export interface LogoProps {
  isDark: boolean
  compact?: boolean
  /** Dense header bar (smaller icon + wordmark). */
  size?: 'default' | 'sm'
  onClick?: () => void
}

export interface LoadingProps {
  message?: string
  fullScreen?: boolean
  isDark?: boolean
}

export interface ErrorMessageProps {
  message: string
  isDark: boolean
  className?: string
}

export interface SuccessMessageProps {
  message: string
  isDark: boolean
  className?: string
}

export interface ThemeToggleProps {
  isDark: boolean
  onToggle: () => void
  fixed?: boolean
}

export interface LoginCardProps {
  isDark: boolean
  children: React.ReactNode
}

export interface PageHeaderProps {
  title: string
  subtitle: string
  isDark: boolean
}

export interface AuthLinkProps {
  to: string
  text: string
  linkText: string
  isDark: boolean
}

export interface SubmitButtonProps {
  loading: boolean
  disabled?: boolean
  children: React.ReactNode
  className?: string
}

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  isDark?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  isDark?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export interface ConfigInputProps {
  label: string
  type?: 'text' | 'number' | 'email' | 'password' | 'url'
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  isDark?: boolean
}

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  /** Optional extra content below the message (e.g. rule summary). */
  children?: React.ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'warning' | 'info'
  isDark?: boolean
}

export interface ProtectedRouteProps {
  children: React.ReactNode
}

export interface ProtectedRouteState {
  isAuthenticated: boolean | null
}

export interface ResizablePanelState {
  size: number
  isResizing: boolean
}

export interface NotFoundProps {
  isDark: boolean
}

export interface RoleErrorProps {
  isDark: boolean
}

export interface ServerErrorProps {
  isDark: boolean
}

export interface InputFieldProps {
  id: string
  label: string
  type?: string
  placeholder: string
  icon: React.ComponentType<{ className?: string }>
  register: any
  autoComplete?: string
  isDark: boolean
  error?: { message?: string }
}

export interface ContractQuantityControlProps {
  quantity: number | string
  onQuantityChange: (delta: number) => void
  onQuantityUpdate: (quantity: number) => void
  onQuantityInputChange: (value: string) => void
  onQuantityBlur: () => void
  isDark: boolean
}

export interface TradeButtonsProps {
  onBuy: () => void
  onSell: () => void
  isDark: boolean
}

export interface PositionButtonsProps {
  onClose: () => void
  onReverse: () => void
  onFlatten: () => void
  isDark: boolean
}

export interface AccountInfoBarProps {
  balance: number
  mll?: number
  rpl: number
  upl: number
  isDark: boolean
}

export interface ResizablePanelProps {
  children: [JSX.Element, JSX.Element]
  direction: 'horizontal' | 'vertical'
  initialSize?: number
  minSize?: number
  maxSize?: number
  onResize?: (size: number) => void
  isDark: boolean
  className?: string
}

export interface SelectOption {
  value: string
  label?: string
}

export interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  isDark: boolean
  className?: string
}

export interface EconomicNewsPanelProps {
  isDark: boolean
  showToggle?: boolean
  onToggle?: (show: boolean) => void
  date?: Date | string // Optional date to use instead of current date (for backtester sessions)
}

export interface TradingNavProps {
  isDark: boolean
  navigate: (path: string) => void
  currentPath: string
  onToggleNav?: () => void
  preserveQueryParams?: boolean
  showDesktopNav?: boolean
  showMobileNav?: boolean
  /** Slim icon-only rail (practice trade) */
  compact?: boolean
  /** Practice trade mobile: open full order panel */
  onPracticeOrder?: () => void
  practiceOrderActive?: boolean
}

export interface EquityCurveProps {
  isDark: boolean
  data?: Array<{ date: string; value: number }>
  initialBalance?: number
  /** Hide built-in chart header when the parent already shows a title */
  embed?: boolean
}

export interface TradeDurationAnalysisProps {
  isDark: boolean
  data?: Array<{ label: string; count: number }>
}

export interface WinRateAnalysisProps {
  isDark: boolean
  data?: Array<{ label: string; rate: number }>
}

export interface StatsRendererProps {
  selectedAccount?: string
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  showAccountDropdown?: boolean
  accounts?: string[]
  title?: string
  practiceMode?: boolean
  practiceAccountId?: string
}

export interface StatsRendererState {
  selectedAccount: string
  showAccountDropdown: boolean
  showNav: boolean
  activeTab: 'overview' | 'calendar' | 'trades'
  dateRange: {
    startDate: string
    endDate: string
  }
  savedDateRange?: {
    startDate: string
    endDate: string
  } // Store overview's date range when switching to calendar
  overviewPropFirmStats?: any // Cache overview's prop firm stats data
  calendarPropFirmStats?: any // Cache calendar's prop firm stats data
  calendarCacheMonth?: string // Store which month the calendar cache is for (YYYY-MM format)
  currentMonth: Date
  trades: any[]
  loading: boolean
  symbolData?: Record<string, { 
    tickSize: number
    tickValue: number
    description?: string
    exchangeFee?: number
    regulatoryFee?: number
    commissionFee?: number
    totalFees?: number
  }>
  showDayDialog?: boolean
  dayTradesLoading?: boolean
  selectedDayData?: {
    date: string
    day: number
    profit: number
    totalTrades: number
    totalContracts: number
    longTrades: number
    shortTrades: number
    longContracts: number
    shortContracts: number
    wins: number
    losses: number
    totalFees: number
    trades: any[]
  } | null
  selectedTimelinePoint?: {
    trade: any
    netPnl: number
    entryTime: Date
    cumulativePnL: number
  } | null
  showWeekDialog?: boolean
  selectedWeekData?: {
    weekNumber: number
    startDate: string
    endDate: string
    profit: number
    totalTrades: number
    trades: any[]
  } | null
  propFirmStats?: {
    trades: any[]
    equityCurveData: Array<{ date: string; value: number }>
    stats: any
    calculateTradePnL: (trade: any) => number
    parseTradeTimestamp: (timestamp: any) => Date | null
    formatDuration: (seconds: number) => string
    initialBalance?: number
    durationAnalysisData?: Array<{ label: string; rate?: number; count?: number }>
    winRateAnalysisData?: Array<{ label: string; rate: number }>
    tradeseaCalendarDays?: unknown
    tradeseaDashboard?: unknown
    symbolData?: Record<string, unknown>
    practiceAccount?: unknown
    practiceRulesStatus?: unknown
  } | null
}

export interface DayStatsDialogProps {
  isDark: boolean
  tradesLoading?: boolean
  selectedDayData: {
    date: string
    day: number
    profit: number
    totalTrades: number
    totalContracts: number
    longTrades: number
    shortTrades: number
    longContracts: number
    shortContracts: number
    wins: number
    losses: number
    totalFees: number
    trades: any[]
  }
  selectedTimelinePoint: {
    trade: any
    netPnl: number
    entryTime: Date
    cumulativePnL: number
  } | null
  symbolData?: Record<string, { 
    tickSize: number
    tickValue: number
    totalFees?: number
  }>
  onClose: () => void
  onTimelinePointClick: (point: { trade: any; netPnl: number; entryTime: Date; cumulativePnL: number }) => void
  onTimelinePointClose: () => void
  calculateTradePnL: (trade: any) => number
  parseTradeTimestamp: (timestamp: any) => Date | null
  formatCurrency: (value: number, compact?: boolean) => string
}

export interface WeekStatsDialogProps {
  isDark: boolean
  selectedWeekData: {
    weekNumber: number
    startDate: string
    endDate: string
    profit: number
    totalTrades: number
    trades: any[]
  }
  symbolData?: Record<string, { totalFees?: number }>
  selectedTimelinePoint?: {
    trade: any
    netPnl: number
    entryTime: Date
    cumulativePnL: number
  } | null
  onClose: () => void
  onTimelinePointClick?: (point: { trade: any; netPnl: number; entryTime: Date; cumulativePnL: number }) => void
  onTimelinePointClose?: () => void
  calculateTradePnL: (trade: any) => number
  parseTradeTimestamp: (timestamp: any) => Date | null
}

export interface TradingTimelineProps {
  isDark: boolean
  trades: any[]
  profit: number
  date: string
  symbolData?: Record<string, { totalFees?: number }>
  selectedTimelinePoint: {
    trade: any
    netPnl: number
    entryTime: Date
    cumulativePnL: number
  } | null
  onPointClick: (point: { trade: any; netPnl: number; entryTime: Date; cumulativePnL: number }) => void
  onPointClose: () => void
  calculateTradePnL: (trade: any) => number
  parseTradeTimestamp: (timestamp: any) => Date | null
}

export interface OverviewTabProps {
  practiceMode?: boolean
  isDark: boolean
  stats: {
    totalTrades: number | string
    winRate: string
    totalProfit: string
    avgWin: string
    avgLoss: string
    largestWin: string
    largestLoss: string
    profitFactor: string
    avgWinLossFactor: string
    wins?: number
    losses?: number
  }
  dayStats: {
    mostActiveDay: { date: string; count: number }
    mostProfitableDay: { date: string; profit: number }
    leastProfitableDay: { date: string; profit: number }
  }
  durationStats: {
    avgDuration: number
    avgWinDuration: number
    avgLossDuration: number
  }
  bestTrade: any
  worstTrade: any
  equityCurveData: Array<{ date: string; value: number }>
  initialBalance?: number
  durationAnalysisData: Array<{ label: string; count: number }>
  winRateAnalysisData: Array<{ label: string; rate: number }>
  dateRange: { startDate: string; endDate: string }
  symbolData?: Record<string, { totalFees?: number }>
  calculateTradePnL: (trade: any) => number
  parseTradeTimestamp: (timestamp: any) => Date | null
  formatDuration: (seconds: number) => string
  trades?: any[]
}

export interface DateRangeSelectorProps {
  isDark: boolean
  dateRange: { startDate: string; endDate: string }
  referenceDate: Date
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void
  formatDateForInput: (date: Date) => string
}

export interface StatsCalendarProps {
  isDark: boolean
  currentMonth: Date
  trades: any[]
  /** TradeLens calendar API rows — used for day PnL/count when trade list is incomplete. */
  calendarDaySummaries?: Array<{ date: string; pnl: number; tradesCount: number }>
  dateRange: { startDate: string; endDate: string }
  referenceDate: Date
  symbolData?: Record<string, { totalFees?: number }>
  formatDateForInput: (date: Date) => string
  formatCurrency: (value: number, compact?: boolean) => string
  calculateTradePnL: (trade: any) => number
  onDayClick: (dayData: {
    date: string
    day: number
    profit: number
    totalTrades: number
    totalContracts: number
    longTrades: number
    shortTrades: number
    longContracts: number
    shortContracts: number
    wins: number
    losses: number
    totalFees: number
    trades: any[]
  }) => void
  onWeekClick: (weekData: {
    weekNumber: number
    startDate: string
    endDate: string
    profit: number
    totalTrades: number
    trades: any[]
  }) => void
  onMonthChange: (month: Date) => void
}

export interface TradesTableProps {
  isDark: boolean
  loading: boolean
  trades: any[]
  dateRange?: { startDate: string; endDate: string }
  symbolData?: Record<string, { totalFees?: number }>
  calculateTradePnL: (trade: any) => number
  parseTradeTimestamp: (timestamp: any) => Date | null
  calculateTradeDuration: (trade: any) => number | null
  formatDuration: (seconds: number) => string
}

export interface StatsHeaderProps {
  isDark: boolean
  showNav: boolean
  showAccountDropdown: boolean
  showAccountDropdownProp: boolean
  selectedAccount: string
  accounts: string[]
  navigate: (path: string) => void
  toggleTheme: () => void
  onShowNav: () => void
  onAccountChange: (account: string) => void
  onToggleAccountDropdown: () => void
}

export interface StatsTabsProps {
  isDark: boolean
  activeTab: 'overview' | 'calendar' | 'trades'
  onTabChange: (tab: 'overview' | 'calendar' | 'trades') => void
}

export interface TokenExpirationTimerProps {
  expirationTimestamp: number | null
  isDark: boolean
}

export interface TokenExpirationTimerState {
  timeRemaining: number | null
  isExpired: boolean
}

export interface EquityCurveState {
  hoveredIndex: number | null
  tooltipPosition: { x: number; y: number } | null
  selectedIndex: number | null
}
