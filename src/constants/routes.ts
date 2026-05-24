export const ROUTES = {
  HOME: '/',
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
  /** Practice hub (same as HOME) */
  PRACTICE: '/',
  /** Simulated accounts — `/practice/trade/:accountId` */
  PRACTICE_TRADE: '/practice/trade',
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

/** @deprecated use practiceSessionPadPath */
export const practiceTradePadPath = practiceSessionPadPath
