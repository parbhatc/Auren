/** The lazy renderer and navigation intent share the same retryable code load. */
export function routeModule<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null
  return () => {
    if (!pending) pending = load().catch((error) => { pending = null; throw error })
    return pending
  }
}

export const routeModules = {
  login: routeModule(() => import('../components/auth/Login')),
  register: routeModule(() => import('../components/auth/Register')),
  verifyEmail: routeModule(() => import('../components/auth/verify_email')),
  forgotPassword: routeModule(() => import('../components/auth/forgot_password')),
  resetPassword: routeModule(() => import('../components/auth/reset_password')),
  settings: routeModule(() => import('../components/settings/account')),
  propsSettings: routeModule(() => import('../components/settings/prop_firms')),
  utilsSettings: routeModule(() => import('../components/settings/utils')),
  keyboardSettings: routeModule(() => import('../components/settings/keyboard_shortcuts')),
  admin: routeModule(() => import('../pages/admin/AdminWorkspacePage')),
  practicePad: routeModule(() => import('../pages/trading/practice/PadPage')),
  practiceStats: routeModule(() => import('../pages/trading/practice/StatsPage')),
  practiceNews: routeModule(() => import('../pages/trading/practice/NewsPage')),
  settingsWorkspace: routeModule(() => import('../pages/settings/SettingsWorkspacePage')),
  practice: routeModule(() => import('../pages/practice/PracticeTerminalPage')),
  practiceAccounts: routeModule(() => import('../pages/practice/PracticeWorkspacePage')),
  dashboard: routeModule(() => import('../pages/workspace/DashboardPage')),
  analytics: routeModule(() => import('../pages/workspace/AnalyticsPage')),
  news: routeModule(() => import('../pages/workspace/NewsWorkspacePage')),
  practiceTrade: routeModule(() => import('../pages/trading/practice/TradePage')),
  liveTrade: routeModule(() => import('../pages/trading/live/TradePage')),
  replayChart: routeModule(() => import('../components/backtester/BacktesterChartView')),
  replay: routeModule(() => import('../components/backtester/BacktesterSessionsList')),
  replayStats: routeModule(() => import('../components/backtester/Stats')),
  replayData: routeModule(() => import('../components/backtester/DataManagement')),
  journal: routeModule(() => import('../pages/journal/JournalPage')),
  journalReviews: routeModule(() => import('../pages/journal/JournalReviewsPage')),
  journalDetail: routeModule(() => import('../pages/journal/JournalTradeDetailPage')),
}

type ModuleLoader = () => Promise<unknown>

/** Fixed imports only: route parameters never become module URLs or API reads. */
export function modulesForRoute(path: string): ModuleLoader[] {
  if (!path.startsWith('/') || path.startsWith('//')) return []
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  const fixed: Record<string, ModuleLoader[]> = {
    '/': [routeModules.dashboard], '/dashboard': [routeModules.dashboard],
    '/analytics': [routeModules.analytics], '/news': [routeModules.news],
    '/journal': [routeModules.journal], '/journal/reviews': [routeModules.journalReviews],
    '/practice': [routeModules.practice], '/trade': [routeModules.liveTrade],
    '/practice/accounts': [routeModules.practiceAccounts],
    '/backtester': [routeModules.replay], '/backtester/chart': [routeModules.replayChart],
    '/backtester/stats': [routeModules.replayStats], '/backtester/data-management': [routeModules.replayData],
    '/settings': [routeModules.settingsWorkspace, routeModules.settings],
    '/settings/props': [routeModules.settingsWorkspace, routeModules.propsSettings],
    '/settings/utils': [routeModules.settingsWorkspace, routeModules.utilsSettings],
    '/settings/keyboard-shortcuts': [routeModules.settingsWorkspace, routeModules.keyboardSettings],
    '/admin/settings': [routeModules.admin], '/admin/permissions': [routeModules.admin], '/admin/users': [routeModules.admin],
    '/login': [routeModules.login], '/register': [routeModules.register],
    '/verify-email': [routeModules.verifyEmail], '/forgot-password': [routeModules.forgotPassword],
    '/reset-password': [routeModules.resetPassword],
  }
  if (fixed[pathname]) return fixed[pathname]
  if (/^\/journal\/[^/]+$/.test(pathname)) return [routeModules.journalDetail]
  if (/^\/practice\/trade\/[^/]+\/stats$/.test(pathname)) return [routeModules.practiceStats]
  if (/^\/practice\/trade\/[^/]+\/news$/.test(pathname)) return [routeModules.practiceNews]
  if (/^\/practice\/trade\/[^/]+\/pad$/.test(pathname)) return [routeModules.practicePad]
  if (/^\/practice\/trade\/[^/]+$/.test(pathname)) return [routeModules.practiceTrade]
  return []
}

/** Loading code on hover/focus/touch does not mount a page or fetch its data. */
export function prefetchRoute(path: string): Promise<unknown[]> {
  return Promise.all(modulesForRoute(path).map((load) => load())).catch(() => [])
}

export function prefetchRouteOnIntent(path: string): void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (!connection?.saveData) void prefetchRoute(path)
}
