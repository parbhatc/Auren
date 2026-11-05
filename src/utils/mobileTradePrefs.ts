import type { MobileEntryMode, MobileTradePrefs } from '../types/mobileTrade'
import { MOBILE_TRADE_PREFS_EVENT, MOBILE_TRADE_PREFS_KEY_PREFIX } from '../constants/mobileTrade'

export type { MobileTradePrefs, PracticeMobileTradePrefs } from '../types/mobileTrade'

const DEFAULT_PREFS: MobileTradePrefs = {
  entryMode: 'both',
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
      const saved = JSON.parse(raw) as Partial<MobileTradePrefs>
      return { ...DEFAULT_PREFS, ...saved, entryMode: saved.entryMode === 'auto' || saved.entryMode === 'market' ? saved.entryMode : 'both' }
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
    ...prev,
    floatingPad,
    quickTradeMinimized: floatingPad ? false : prev.quickTradeMinimized,
  })
}

export function setMobileQuickTradeMinimized(accountId: string, quickTradeMinimized: boolean): void {
  saveMobileTradePrefs(accountId, {
    ...getMobileTradePrefs(accountId),
    floatingPad: false,
    quickTradeMinimized,
  })
}

export function setMobileEntryMode(accountId: string, entryMode: MobileEntryMode): void {
  saveMobileTradePrefs(accountId, { ...getMobileTradePrefs(accountId), entryMode })
}

export { MOBILE_TRADE_PREFS_EVENT, PRACTICE_MOBILE_TRADE_PREFS_EVENT } from '../constants/mobileTrade'
export const getPracticeMobileTradePrefs = getMobileTradePrefs

/** @deprecated use saveMobileTradePrefs */
export const savePracticeMobileTradePrefs = saveMobileTradePrefs

/** @deprecated use setMobileFloatingPad */
export const setPracticeMobileFloatingPad = setMobileFloatingPad

/** @deprecated use setMobileQuickTradeMinimized */
export const setPracticeMobileQuickTradeMinimized = setMobileQuickTradeMinimized
