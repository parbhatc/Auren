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
  PRACTICE_TRADE: '/trade',
} as const

export type Route = typeof ROUTES[keyof typeof ROUTES]

export function practiceTradePath(practiceAccountId: string): string {
  return `${ROUTES.PRACTICE_TRADE}/${practiceAccountId}`
}

export function practiceTradeStatsPath(practiceAccountId: string): string {
  return `${ROUTES.PRACTICE_TRADE}/${practiceAccountId}/stats`
}

export function practiceTradeNewsPath(practiceAccountId: string): string {
  return `${ROUTES.PRACTICE_TRADE}/${practiceAccountId}/news`
}

export function practiceTradePadPath(practiceAccountId: string): string {
  return `${ROUTES.PRACTICE_TRADE}/${practiceAccountId}/pad`
}
