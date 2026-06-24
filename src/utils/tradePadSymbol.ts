/** Persist DOM / order-pad trade contract per practice account (independent of chart symbol). */

const symbolKey = (accountId: string) => `practice_trade_pad_symbol_${accountId}`
const autoChangeKey = (accountId: string) => `practice_trade_pad_auto_change_${accountId}`

export const TRADE_PAD_AUTO_CHANGE_EVENT = 'practiceTradePadAutoChangeChanged'

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

/** When true (default), chart symbol changes also update the trade contract. */
export function getTradePadAutoChange(accountId: string): boolean {
  try {
    const raw = localStorage.getItem(autoChangeKey(accountId))
    if (raw === '0' || raw === 'false') return false
    return true
  } catch {
    return true
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
