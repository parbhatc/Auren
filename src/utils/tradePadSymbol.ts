/** Persist DOM / order-pad trade contract per practice account (independent of chart symbol). */

const key = (accountId: string) => `practice_trade_pad_symbol_${accountId}`

export function getTradePadSymbol(accountId: string): string | null {
  try {
    const v = localStorage.getItem(key(accountId))?.trim().toUpperCase()
    return v || null
  } catch {
    return null
  }
}

export function saveTradePadSymbol(accountId: string, root: string): void {
  try {
    const next = String(root || '').trim().toUpperCase()
    if (!next) return
    localStorage.setItem(key(accountId), next)
  } catch {
    /* ignore */
  }
}
