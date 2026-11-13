/** Persist DOM / order-pad trade contract per practice account (independent of chart symbol). */

const symbolKey = (accountId: string) => `practice_trade_pad_symbol_${accountId}`
const autoChangeKey = (accountId: string) => `practice_trade_pad_auto_change_${accountId}`
const microOnlyKey = (accountId: string) => `auren_trade_pad_micro_only_${accountId}`

export const TRADE_PAD_AUTO_CHANGE_EVENT = 'practiceTradePadAutoChangeChanged'
export const TRADE_PAD_MICRO_ONLY_EVENT = 'tradePadMicroOnlyChanged'

export function getTradePadMicroOnly(accountId: string): boolean {
  try {
    return localStorage.getItem(microOnlyKey(accountId)) === '1'
  } catch {
    return false
  }
}

export function resolveTradePadFollowSymbol(accountId: string, chartRoot: string): string {
  if (!getTradePadMicroOnly(accountId)) return chartRoot
  if (chartRoot === 'NQ') return 'MNQ'
  if (chartRoot === 'ES') return 'MES'
  return chartRoot
}

export function saveTradePadMicroOnly(accountId: string, enabled: boolean): void {
  localStorage.setItem(microOnlyKey(accountId), enabled ? '1' : '0')
  window.dispatchEvent(new Event(TRADE_PAD_MICRO_ONLY_EVENT))
}

export function getTradePadSymbol(accountId: string): string | null {
  try {
    const v = localStorage.getItem(symbolKey(accountId))?.trim().toUpperCase()
    return v || null
  } catch {
    return null
  }
}

export function saveTradePadSymbol(accountId: string, root: string): void {
  try {
    const next = String(root || '').trim().toUpperCase()
    if (!next) return
    localStorage.setItem(symbolKey(accountId), next)
  } catch {
    /* ignore */
  }
}

/** Follow the chart only when Auto is enabled for this account. */
export function getTradePadAutoChange(accountId: string): boolean {
  try {
    const raw = localStorage.getItem(autoChangeKey(accountId))
    return raw === '1' || raw === 'true'
  } catch {
    return false
  }
}

export function saveTradePadAutoChange(accountId: string, enabled: boolean): void {
  try {
    localStorage.setItem(autoChangeKey(accountId), enabled ? '1' : '0')
    window.dispatchEvent(new Event(TRADE_PAD_AUTO_CHANGE_EVENT))
  } catch {
    /* ignore */
  }
}
