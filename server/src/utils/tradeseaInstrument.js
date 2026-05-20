/**
 * Canonical instrument ticker for Tradesea trades REST (case-sensitive).
 * @param {string} symbol
 * @returns {string}
 */
export function normalizeTradeseaTradeInstrument(symbol) {
  const trimmed = String(symbol || '').trim()
  if (!trimmed) return trimmed

  if (!trimmed.includes(':')) {
    const upper = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (/^MNQ/.test(upper)) return 'CME-Delayed:MNQ'
    if (/^MES/.test(upper)) return 'CME-Delayed:MES'
    if (/^NQ/.test(upper)) return 'CME-Delayed:NQ'
    if (/^ES/.test(upper)) return 'CME-Delayed:ES'
    return `CME-Delayed:${upper}`
  }

  const colon = trimmed.indexOf(':')
  const venuePart = trimmed.slice(0, colon)
  const symbolPart = trimmed.slice(colon + 1).trim()
  const match = venuePart.match(/^([A-Za-z]+)-([Dd][Ee][Ll][Aa][Yy][Ee][Dd])$/)

  if (match) {
    return `${match[1].toUpperCase()}-Delayed:${symbolPart.toUpperCase()}`
  }

  return trimmed
}
