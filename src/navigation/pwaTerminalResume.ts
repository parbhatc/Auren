import { ROUTES } from '../constants/routes'
import { isPwaStandalone } from '../utils/pwa'

const TERMINAL_ROUTE_KEY = 'auren-pwa-terminal-route'

export function isTerminalRoute(path: unknown): path is string {
  return typeof path === 'string' && (
    path === ROUTES.PRACTICE || path === ROUTES.TRADE ||
    /^\/practice\/trade\/[a-zA-Z0-9_-]+$/.test(path)
  )
}

export function clearPwaTerminalRoute(): void {
  try {
    window.localStorage.removeItem(TERMINAL_ROUTE_KEY)
  } catch {
    // The app can still launch when storage is unavailable.
  }
}

export function rememberPwaTerminalRoute(pathname: string): void {
  if (!isPwaStandalone()) return
  try {
    if (isTerminalRoute(pathname) && window.localStorage.getItem('token')) {
      window.localStorage.setItem(TERMINAL_ROUTE_KEY, pathname)
    } else {
      clearPwaTerminalRoute()
    }
  } catch {
    // The app can still navigate when storage is unavailable.
  }
}

/** An installed app can cold-launch at the manifest URL after iOS closes it. */
export function restorePwaTerminalRoute(): void {
  if (!isPwaStandalone()) return
  const { pathname, search, hash } = window.location
  if (pathname !== ROUTES.HOME || search || hash) return

  try {
    const path = window.localStorage.getItem(TERMINAL_ROUTE_KEY)
    if (isTerminalRoute(path) && window.localStorage.getItem('token')) {
      window.history.replaceState(window.history.state, '', path)
    }
  } catch {
    // Fall back to the manifest URL if storage or history is unavailable.
  }
}
