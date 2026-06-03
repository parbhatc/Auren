import type { RithmicSymbolRow } from '../../api/rithmic.api'
import type { LibrarySymbolInfo } from '../../types/chart'
import {
  INTRADAY_MULTIPLIERS,
  pricescaleFromRow,
  SECONDS_MULTIPLIERS,
  SUPPORTED_RESOLUTIONS,
} from './rithmicResolutions'
import { rithmicSessionForExchange, rithmicTimezoneForExchange } from './rithmicSymbolSessions'

export type RithmicSearchSymbolResult = {
  symbol: string
  full_name: string
  description: string
  exchange: string
  type: string
  ticker?: string
}

export function rithmicRowToSearchSymbolResult(row: RithmicSymbolRow): RithmicSearchSymbolResult {
  const ticker = String(row.ticker || `${row.exchange}:${row.symbol}`).trim()
  const display = String(row.symbol || '').trim().toUpperCase()
  return {
    symbol: display,
    full_name: ticker,
    description: row.description || display,
    exchange: row.exchange || 'CME',
    type: 'futures',
    ticker,
  }
}

export function rithmicRowToLibrarySymbolInfo(row: RithmicSymbolRow): LibrarySymbolInfo {
  const ticker = String(row.ticker || `${row.exchange}:${row.symbol}`).trim()
  const display = String(row.symbol || '').trim().toUpperCase()
  const exchange = String(row.exchange || 'CME').trim()
  const { minmov, pricescale } = pricescaleFromRow(row)

  return {
    name: display,
    symbol: display,
    ticker,
    broker_symbol: ticker,
    description: row.description || display,
    type: 'futures',
    exchange,
    listed_exchange: exchange,
    full_name: display,
    session: rithmicSessionForExchange(exchange),
    timezone: rithmicTimezoneForExchange(exchange),
    minmov,
    pricescale,
    has_intraday: true,
    has_seconds: true,
    has_ticks: true,
    has_daily: true,
    has_weekly_and_monthly: true,
    supported_resolutions: SUPPORTED_RESOLUTIONS,
    intraday_multipliers: INTRADAY_MULTIPLIERS,
    seconds_multipliers: SECONDS_MULTIPLIERS,
    volume_precision: 0,
    data_status: 'streaming',
    ...(row.pipSize != null ? { pipSize: row.pipSize } : {}),
    ...(row.pipValue != null ? { pipValue: row.pipValue } : {}),
    ...(row.minTick != null ? { minTick: row.minTick } : {}),
  }
}

export function rithmicTickSize(row: RithmicSymbolRow | null | undefined): number | null {
  if (row?.minTick != null) return row.minTick
  if (row?.pipSize != null) return row.pipSize
  return null
}

export function rithmicTickValue(row: RithmicSymbolRow | null | undefined): number | null {
  if (row?.pipValue != null) return row.pipValue
  return null
}

export function buildRithmicSymbolIndex(rows: RithmicSymbolRow[]): Map<string, RithmicSymbolRow> {
  const index = new Map<string, RithmicSymbolRow>()
  for (const row of rows) {
    const symbol = String(row.symbol || '').trim().toUpperCase()
    const ticker = String(row.ticker || '').trim().toUpperCase()
    if (symbol) index.set(symbol, row)
    if (ticker) index.set(ticker, row)
    if (ticker.includes(':')) {
      index.set(ticker.split(':').pop()!, row)
    }
  }
  return index
}

export function findRithmicSymbolRow(
  index: Map<string, RithmicSymbolRow>,
  chartSymbol: string
): RithmicSymbolRow | null {
  const raw = String(chartSymbol || '').trim()
  if (!raw) return null
  const upper = raw.toUpperCase()

  const direct = index.get(upper)
  if (direct) return direct

  if (upper.includes(':')) {
    const root = upper.split(':').pop()!
    return index.get(root) ?? null
  }

  return null
}

export function searchRithmicSymbolRows(
  rows: RithmicSymbolRow[],
  options: { query?: string; exchange?: string; type?: string; limit?: number } = {}
): RithmicSymbolRow[] {
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

  let filtered = rows

  if (exchange) {
    filtered = filtered.filter((r) => String(r.exchange || '').toUpperCase() === exchange)
  }
  if (type) {
    filtered = filtered.filter((r) => String(r.type || '').toLowerCase() === type)
  }

  if (query) {
    filtered = filtered.filter((row) => {
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

    filtered.sort((a, b) => {
      const score = (row: RithmicSymbolRow) => {
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
  } else {
    filtered.sort((a, b) =>
      String(a.symbol || '').localeCompare(String(b.symbol || ''), undefined, {
        sensitivity: 'base',
      })
    )
  }

  return filtered.slice(0, limit)
}
