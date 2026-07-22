export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  ANALYTICS: '/analytics',
  JOURNAL: '/journal',
  NEWS: '/news',
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  SETTINGS: '/settings',
  ADMIN_SETTINGS: '/admin/settings',
  PERMISSION_MANAGER: '/admin/permissions',
  USER_MANAGER: '/admin/users',
  PROPS_SETTINGS: '/settings/props',
  UTILS_SETTINGS: '/settings/utils',
  KEYBOARD_SHORTCUTS_SETTINGS: '/settings/keyboard-shortcuts',
  PRACTICE_SETTINGS: '/settings/practice',
  /** Simulated evaluation and funded account workspace */
  PRACTICE: '/practice',
  /** Simulated accounts — `/practice/trade/:accountId` */
  PRACTICE_TRADE: '/practice/trade',
  /** Live prop-firm trading terminal */
  TRADE: '/trade',
  /** Historical CSV backtester hub */
  BACKTESTER: '/backtester',
  /** Backtester chart replay terminal */
  BACKTESTER_CHART: '/backtester/chart',
  BACKTESTER_STATS: '/backtester/stats',
  BACKTESTER_DATA_MANAGEMENT: '/backtester/data-management',
  /** @deprecated use ROUTES.TRADE */
  LIVE_TRADE: '/live/trade',
} as const

export type Route = (typeof ROUTES)[keyof typeof ROUTES]

export function practiceSessionPath(accountId: string): string {
  return `${ROUTES.PRACTICE_TRADE}/${accountId}`
}

/** @deprecated use practiceSessionPath */
export const practiceTradePath = practiceSessionPath

export function practiceSessionStatsPath(accountId: string): string {
  return `${ROUTES.PRACTICE_TRADE}/${accountId}/stats`
}

/** @deprecated use practiceSessionStatsPath */
export const practiceTradeStatsPath = practiceSessionStatsPath

export function practiceSessionNewsPath(accountId: string): string {
  return `${ROUTES.PRACTICE_TRADE}/${accountId}/news`
}

/** @deprecated use practiceSessionNewsPath */
export const practiceTradeNewsPath = practiceSessionNewsPath

export function practiceSessionPadPath(accountId: string): string {
  return `${ROUTES.PRACTICE_TRADE}/${accountId}/pad`
}

/** Live trade terminal — account is chosen in the header dropdown on `/trade`. */
export function liveTradePath(_accountId?: string): string {
  return ROUTES.TRADE
}

/** @deprecated use practiceSessionPadPath */
export const practiceTradePadPath = practiceSessionPadPath
