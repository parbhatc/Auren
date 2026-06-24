export interface TradingProps {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  colors: any
  accounts?: any[]
  selectedAccount?: string
  /** Practice route: single account from settings, market data only */
  practiceMode?: boolean
  practiceAccountId?: string
  practiceAccountStatus?: 'blown' | 'passed'
  onRefreshPracticeAccount?: () => void
  practiceRefreshing?: boolean
  firm?: {
    accessToken?: string
    sessionId?: string
    sessionIdAuth?: string
  }
}

export interface TradingRendererState {
  selectedSymbol: string
  /** Product root for DOM / order pad; null = same as chart symbol. */
  tradePadSymbol: string | null
  contractQuantity: number | string
  selectedAccount: string
  showAccountDropdown: boolean
  layout: any
  showNews: boolean
  showNav: boolean
  /** Practice trade: mobile slide-up order panel */
  practiceMobileOrderOpen?: boolean
  /** Tradesea MDS connected — gates trading controls when false */
  marketDataLive?: boolean
}
