import type { MobileTradePrefs } from '../types/mobileTrade'
import { MOBILE_TRADE_PREFS_EVENT, MOBILE_TRADE_PREFS_KEY_PREFIX } from '../constants/mobileTrade'

export type { MobileTradePrefs, PracticeMobileTradePrefs } from '../types/mobileTrade'

const DEFAULT_PREFS: MobileTradePrefs = {
  floatingPad: false,
  quickTradeMinimized: true,
}

function storageKey(accountId: string): string {
  return `${MOBILE_TRADE_PREFS_KEY_PREFIX}${accountId}`
}

export function getMobileTradePrefs(accountId: string): MobileTradePrefs {
  try {
    const raw = localStorage.getItem(storageKey(accountId))
    if (raw) {
      return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as MobileTradePrefs) }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREFS }
}

export function saveMobileTradePrefs(accountId: string, prefs: MobileTradePrefs): void {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(prefs))
    window.dispatchEvent(new Event(MOBILE_TRADE_PREFS_EVENT))
  } catch {
    /* ignore */
  }
}

export function setMobileFloatingPad(accountId: string, floatingPad: boolean): void {
  const prev = getMobileTradePrefs(accountId)
  saveMobileTradePrefs(accountId, {
    floatingPad,
    quickTradeMinimized: floatingPad ? false : prev.quickTradeMinimized,
  })
}

export function setMobileQuickTradeMinimized(accountId: string, quickTradeMinimized: boolean): void {
  saveMobileTradePrefs(accountId, {
    floatingPad: false,
    quickTradeMinimized,
  })
}

export { MOBILE_TRADE_PREFS_EVENT, PRACTICE_MOBILE_TRADE_PREFS_EVENT } from '../constants/mobileTrade'
export const getPracticeMobileTradePrefs = getMobileTradePrefs

/** @deprecated use saveMobileTradePrefs */
export const savePracticeMobileTradePrefs = saveMobileTradePrefs

/** @deprecated use setMobileFloatingPad */
export const setPracticeMobileFloatingPad = setMobileFloatingPad

/** @deprecated use setMobileQuickTradeMinimized */
export const setPracticeMobileQuickTradeMinimized = setMobileQuickTradeMinimized
