const FUTURES_MONTH_CODES = 'FGHJKMNQUVXZ'

function streamRoot(symbol) {
  const upper = String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const match = upper.match(new RegExp(`^([A-Z0-9]+?)[${FUTURES_MONTH_CODES}]\\d{1,4}$`))
  return match?.[1] || upper
}

function venueForProduct(product, fallback = 'CME') {
  if (/^(?:GC|MGC|SI|SIL)$/.test(product)) return 'COMEX'
  if (/^(?:CL|MCL)$/.test(product)) return 'NYMEX'
  if (/^(?:YM|MYM)$/.test(product)) return 'CBOT'
  return fallback.toUpperCase()
}

/**
 * Convert a configured/UI futures ticker to the account's MDS/UDF namespace.
 * Sandbox and RD accounts require the case-sensitive `Venue-Delayed:Product`
 * form, while Lucid production market data requires `Venue:Product`.
 */
export function normalizeTradeseaMarketDataSymbol(symbol, delayed) {
  const trimmed = String(symbol || '').trim()
  if (!trimmed) return delayed ? 'CME-Delayed:NQ' : 'CME:NQ'

  const qualified = trimmed.match(/^([A-Za-z]+)(?:-[Dd][Ee][Ll][Aa][Yy][Ee][Dd])?:(.+)$/)
  if (qualified) {
    const product = streamRoot(qualified[2])
    const venue = venueForProduct(product, qualified[1])
    return `${venue}${delayed ? '-Delayed' : ''}:${product}`
  }

  const product = streamRoot(trimmed)
  const venue = venueForProduct(product)
  return `${venue}${delayed ? '-Delayed' : ''}:${product}`
}

