import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SYMBOLS_PATH = join(__dirname, '../../../data/rithmic_symbols.json')

/** @type {import('./rithmicSymbols.types.js').RithmicSymbolRow[] | null} */
let cachedSymbols = null

function loadSymbols() {
  if (cachedSymbols) return cachedSymbols
  const raw = readFileSync(SYMBOLS_PATH, 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('rithmic_symbols.json must be a JSON array')
  }
  cachedSymbols = parsed
  return cachedSymbols
}

/** Full catalog (same shape as file entries). */
export function getRithmicSymbols() {
  return loadSymbols()
}

/**
 * Search symbols for chart symbol picker.
 * @param {{ query?: string, exchange?: string, type?: string, limit?: number }} options
 */
export function searchRithmicSymbols(options = {}) {
  const query = String(options.query || '')
    .trim()
    .toUpperCase()
  const exchange = String(options.exchange || '')
    .trim()
    .toUpperCase()
  const type = String(options.type || '')
    .trim()
    .toLowerCase()
  const limit = Math.min(Math.max(Number(options.limit) || 30, 1), 200)

  let rows = loadSymbols()

  if (exchange) {
    rows = rows.filter((r) => String(r.exchange || '').toUpperCase() === exchange)
  }
  if (type) {
    rows = rows.filter((r) => String(r.type || '').toLowerCase() === type)
  }

  if (query) {
    rows = rows.filter((row) => {
      const symbol = String(row.symbol || '').toUpperCase()
      const ticker = String(row.ticker || '').toUpperCase()
      const description = String(row.description || '').toUpperCase()
      return (
        symbol.includes(query) ||
        ticker.includes(query) ||
        description.includes(query) ||
        ticker.replace(/^[^:]+:/, '').includes(query)
      )
    })

    rows.sort((a, b) => {
      const score = (row) => {
        const symbol = String(row.symbol || '').toUpperCase()
        const ticker = String(row.ticker || '').toUpperCase()
        if (symbol === query) return 0
        if (symbol.startsWith(query)) return 1
        if (ticker.endsWith(`:${query}`)) return 2
        if (symbol.includes(query)) return 3
        return 4
      }
      return score(a) - score(b)
    })
  }

  return rows.slice(0, limit)
}

/** Lookup by chart ticker (CME:NQ) or root symbol (NQ). */
export function findRithmicSymbol(chartSymbol) {
  const raw = String(chartSymbol || '').trim()
  if (!raw) return null
  const upper = raw.toUpperCase()
  const rows = loadSymbols()

  const exact = rows.find(
    (r) =>
      String(r.ticker || '').toUpperCase() === upper ||
      String(r.symbol || '').toUpperCase() === upper
  )
  if (exact) return exact

  if (upper.includes(':')) {
    const root = upper.split(':').pop()
    return (
      rows.find((r) => String(r.symbol || '').toUpperCase() === root) ??
      rows.find((r) => String(r.ticker || '').toUpperCase().endsWith(`:${root}`)) ??
      null
    )
  }

  return (
    rows.find((r) => String(r.symbol || '').toUpperCase() === upper) ??
    rows.find((r) => String(r.ticker || '').toUpperCase().endsWith(`:${upper}`)) ??
    null
  )
}
