const KEY_PREFIX = 'practice_mobile_trade_'

export type PracticeMobileTradePrefs = {
  /** Draggable compact trade pad over the chart (hides bottom quick trade). */
  floatingPad: boolean
  /** Collapsed strip at the bottom instead of the full quick-trade card. */
  quickTradeMinimized: boolean
}

const DEFAULT_PREFS: PracticeMobileTradePrefs = {
  floatingPad: false,
  quickTradeMinimized: false,
}

export const PRACTICE_MOBILE_TRADE_PREFS_EVENT = 'practiceMobileTradePrefsChanged'

function storageKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId}`
}

export function getPracticeMobileTradePrefs(accountId: string): PracticeMobileTradePrefs {
  try {
    const raw = localStorage.getItem(storageKey(accountId))
    if (raw) {
      return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as PracticeMobileTradePrefs) }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREFS }
}

export function savePracticeMobileTradePrefs(
  accountId: string,
  prefs: PracticeMobileTradePrefs
): void {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(prefs))
    window.dispatchEvent(new Event(PRACTICE_MOBILE_TRADE_PREFS_EVENT))
  } catch {
    /* ignore */
  }
}

export function setPracticeMobileFloatingPad(accountId: string, floatingPad: boolean): void {
  const prev = getPracticeMobileTradePrefs(accountId)
  savePracticeMobileTradePrefs(accountId, {
    floatingPad,
    quickTradeMinimized: floatingPad ? false : prev.quickTradeMinimized,
  })
}

export function setPracticeMobileQuickTradeMinimized(
  accountId: string,
  quickTradeMinimized: boolean
): void {
  const prev = getPracticeMobileTradePrefs(accountId)
  savePracticeMobileTradePrefs(accountId, {
    floatingPad: false,
    quickTradeMinimized,
  })
}
