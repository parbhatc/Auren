export type DashboardAccountSource = 'practice' | 'tradesea'

export interface DashboardAccountSelection {
  source: DashboardAccountSource
  accountId: string
}

export const DASHBOARD_ACCOUNT_STORAGE_KEY = 'aurenDashboardAccount'
export const DASHBOARD_ACCOUNT_CHANGED_EVENT = 'dashboardAccountChanged'

export function dashboardAccountValue(selection: DashboardAccountSelection): string {
  return `${selection.source}:${selection.accountId}`
}

export function parseDashboardAccountValue(value: string | null | undefined): DashboardAccountSelection | null {
  const raw = String(value || '').trim()
  const separator = raw.indexOf(':')
  if (separator <= 0) return null
  const source = raw.slice(0, separator)
  const accountId = raw.slice(separator + 1).trim()
  if ((source !== 'practice' && source !== 'tradesea') || !accountId) return null
  return { source, accountId }
}

export function getDashboardAccountSelection(): DashboardAccountSelection | null {
  try {
    return parseDashboardAccountValue(localStorage.getItem(DASHBOARD_ACCOUNT_STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveDashboardAccountSelection(selection: DashboardAccountSelection): void {
  const saved = getDashboardAccountSelection()
  if (saved?.source === selection.source && saved.accountId === selection.accountId) return
  try {
    localStorage.setItem(DASHBOARD_ACCOUNT_STORAGE_KEY, dashboardAccountValue(selection))
  } catch {
    // Storage is optional.
  }
  window.dispatchEvent(new Event(DASHBOARD_ACCOUNT_CHANGED_EVENT))
}
