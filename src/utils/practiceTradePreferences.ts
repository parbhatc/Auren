/** Persist practice trade UI prefs (nav, order pad) per simulated account. */

const navKey = (accountId: string) => `practice_show_nav_${accountId}`

export function getPracticeShowNav(accountId: string): boolean | null {
  try {
    const v = localStorage.getItem(navKey(accountId))
    if (v === null) return null
    return v === 'true'
  } catch {
    return null
  }
}

export function savePracticeShowNav(accountId: string, show: boolean): void {
  try {
    localStorage.setItem(navKey(accountId), show ? 'true' : 'false')
    localStorage.setItem('trading_show_nav', show ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

export function getInitialPracticeShowNav(accountId?: string): boolean {
  if (accountId) {
    const saved = getPracticeShowNav(accountId)
    if (saved != null) return saved
  }
  try {
    const global = localStorage.getItem('trading_show_nav')
    if (global !== null) return global === 'true'
  } catch {
    /* ignore */
  }
  return true
}
