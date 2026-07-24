/** Map UI symbol to production MDS/UDF ticker (e.g. NQ → CME:NQ). */
const FUTURES_MONTH_CODES = 'FGHJKMNQUVXZ'

function toTradeseaStreamRoot(symbol: string): string {
  const upper = String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const match = upper.match(new RegExp(`^([A-Z0-9]+?)[${FUTURES_MONTH_CODES}]\\d{1,4}$`))
  return match?.[1] || upper
}

function normalizeQualifiedTicker(ticker: string, delayed: boolean): string {
  const match = ticker.match(/^([A-Za-z]+)(?:-([Dd][Ee][Ll][Aa][Yy][Ee][Dd]))?:(.+)$/)
  if (!match) return ticker
  const product = toTradeseaStreamRoot(match[3])
  const venue =
    /^(?:GC|MGC|SI|SIL)$/.test(product)
      ? 'COMEX'
      : /^(?:CL|MCL)$/.test(product)
        ? 'NYMEX'
        : /^(?:YM|MYM)$/.test(product)
          ? 'CBOT'
          : match[1].toUpperCase()
  return `${venue}${delayed ? '-Delayed' : ''}:${product}`
}

export function toTradeseaProdTicker(symbol: string): string {
  const trimmed = symbol.trim()
  if (!trimmed) return 'CME:NQ'
  if (trimmed.includes(':')) {
    return normalizeQualifiedTicker(trimmed, false)
  }

  const upper = toTradeseaStreamRoot(trimmed)
  if (/^MNQ/.test(upper)) return 'CME:MNQ'
  if (/^MES/.test(upper)) return 'CME:MES'
  if (/^M2K/.test(upper)) return 'CME:M2K'
  if (/^MYM/.test(upper)) return 'CBOT:MYM'
  if (/^YM/.test(upper)) return 'CBOT:YM'
  if (/^GC/.test(upper) || /^MGC/.test(upper)) return `COMEX:${upper}`
  if (/^SI/.test(upper) || /^SIL/.test(upper)) return `COMEX:${upper}`
  if (/^CL/.test(upper) || /^MCL/.test(upper)) return `NYMEX:${upper}`
  if (/^ES/.test(upper)) return 'CME:ES'
  if (/^NQ/.test(upper)) return 'CME:NQ'
  if (/^RTY/.test(upper)) return 'CME:RTY'
  return `CME:${upper}`
}

/** Map UI symbol to Tradesea delayed MDS/UDF ticker (sandbox-2 — e.g. NQ → CME-Delayed:NQ). */
export function toTradeseaDelayedTicker(symbol: string): string {
  const trimmed = symbol.trim()
  if (!trimmed) return 'CME-Delayed:NQ'
  if (trimmed.includes(':')) {
    return normalizeQualifiedTicker(trimmed, true)
  }

  const upper = toTradeseaStreamRoot(trimmed)
  if (/^MNQ/.test(upper)) return 'CME-Delayed:MNQ'
  if (/^MES/.test(upper)) return 'CME-Delayed:MES'
  if (/^M2K/.test(upper)) return 'CME-Delayed:M2K'
  if (/^MYM/.test(upper)) return 'CBOT-Delayed:MYM'
  if (/^YM/.test(upper)) return 'CBOT-Delayed:YM'
  if (/^GC/.test(upper) || /^MGC/.test(upper)) return `COMEX-Delayed:${upper}`
  if (/^SI/.test(upper) || /^SIL/.test(upper)) return `COMEX-Delayed:${upper}`
  if (/^CL/.test(upper) || /^MCL/.test(upper)) return `NYMEX-Delayed:${upper}`
  if (/^ES/.test(upper)) return 'CME-Delayed:ES'
  if (/^NQ/.test(upper)) return 'CME-Delayed:NQ'
  if (/^RTY/.test(upper)) return 'CME-Delayed:RTY'
  return `CME-Delayed:${upper}`
}
