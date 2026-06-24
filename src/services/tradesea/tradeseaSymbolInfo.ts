import { LibrarySymbolInfo } from '../../types/chart'
import {
  TRADESEA_INTRADAY_MULTIPLIERS,
  TRADESEA_SECONDS_MULTIPLIERS,
  TRADESEA_SUPPORTED_RESOLUTIONS,
} from './tradeseaResolutions'
import { toTradeseaProdTicker } from './tradeseaStreamSymbol'

export interface TradeseaInstrumentRow {
  description: string
  exchange: string
  symbol: string
  ticker: string
  type: string
  pipSize?: number
  pipValue?: number
  minTick?: number
  precision?: number
}

export interface TradeseaSearchRow {
  symbol?: string
  full_name?: string
  description?: string
  exchange?: string
  type?: string
  ticker?: string
}

function normalizeType(type?: string): string {
  const t = String(type || 'Future').toLowerCase()
  if (t === 'future') return 'futures'
  return t || 'futures'
}

export function tradeseaPricescale(row: { minTick?: number; pipSize?: number; precision?: number }): {
  minmov: number
  pricescale: number
} {
  const precision = Number.isFinite(row.precision) ? Number(row.precision) : 2
  const minTick = row.minTick ?? row.pipSize ?? Math.pow(10, -precision)
  const pricescale = Math.pow(10, precision)
  const minmov = Math.max(1, Math.round(minTick * pricescale))
  return { minmov, pricescale }
}

/** Short chart/search label (MNQ) — not CME-Delayed:MNQ. */
export function instrumentDisplaySymbol(row: TradeseaInstrumentRow): string {
  const product = String(row.symbol || '').trim()
  if (product && !product.includes(':')) {
    return product.toUpperCase()
  }
  const root = chartSymbolToProductRoot(row.ticker || row.symbol || '')
  return root || String(row.ticker || row.symbol || '').trim()
}

/** Stream/API ticker (CME-Delayed:MNQ or CME:MNQ). */
export function instrumentStreamTicker(row: TradeseaInstrumentRow): string {
  return String(row.ticker || row.symbol || '').trim()
}

/** Toolbar/search label — prod shows CME:MNQ even when catalog stores CME-Delayed:MNQ. */
export function instrumentUiTicker(row: TradeseaInstrumentRow, delayed = true): string {
  const stream = instrumentStreamTicker(row)
  if (!stream) return instrumentDisplaySymbol(row)
  return delayed ? stream : toTradeseaProdTicker(stream)
}

export function instrumentToLibrarySymbolInfo(
  row: TradeseaInstrumentRow,
  delayed = true
): LibrarySymbolInfo {
  const streamTicker = instrumentStreamTicker(row)
  const display = instrumentDisplaySymbol(row)
  const { minmov, pricescale } = tradeseaPricescale(row)
  const exchangeLabel = delayed && row.exchange ? `${row.exchange} (Delayed)` : row.exchange

  return {
    name: display,
    symbol: display,
    ticker: display,
    broker_symbol: streamTicker,
    description: row.description || display,
    type: normalizeType(row.type),
    exchange: exchangeLabel,
    listed_exchange: row.exchange,
    full_name: display,
    session: '24x7',
    timezone: 'America/Chicago',
    minmov,
    pricescale,
    has_intraday: true,
    has_seconds: true,
    has_ticks: true,
    has_daily: true,
    has_weekly_and_monthly: true,
    supported_resolutions: TRADESEA_SUPPORTED_RESOLUTIONS,
    intraday_multipliers: TRADESEA_INTRADAY_MULTIPLIERS,
    seconds_multipliers: TRADESEA_SECONDS_MULTIPLIERS,
    volume_precision: 0,
    data_status: delayed ? 'delayed_streaming' : 'streaming',
  }
}

/** TradingView symbol search result (minimal shape — not full LibrarySymbolInfo). */
export interface TradeseaSearchSymbolResult {
  symbol: string
  full_name: string
  /** BWC symbol search UI label */
  name: string
  description: string
  exchange: string
  type: string
  ticker?: string
  /** Wire ticker for MDS/UDF (may differ from toolbar `ticker`). */
  streamTicker?: string
}

export function instrumentToSearchSymbolResult(
  row: TradeseaInstrumentRow,
  delayed = true
): TradeseaSearchSymbolResult {
  const streamTicker = instrumentStreamTicker(row)
  const display = instrumentDisplaySymbol(row)
  const label = row.description || display
  return {
    symbol: display,
    full_name: display,
    name: label,
    description: label,
    exchange: row.exchange || 'CME',
    type: 'futures',
    ticker: display,
    streamTicker,
  }
}

export function searchRowToSearchSymbolResult(
  row: TradeseaSearchRow,
  delayed = true
): TradeseaSearchSymbolResult {
  const streamTicker = String(row.ticker || row.full_name || row.symbol || '').trim()
  const display =
    chartSymbolToProductRoot(streamTicker) ||
    String(row.symbol || '').trim() ||
    streamTicker
  const exchange =
    row.exchange || (streamTicker.includes(':') ? streamTicker.split(':')[0].replace(/-Delayed$/i, '') : 'CME')
  const label = row.description || display
  return {
    symbol: display,
    full_name: display,
    name: label,
    description: label,
    exchange,
    type: 'futures',
    ticker: display,
    streamTicker: streamTicker || undefined,
  }
}

export function searchRowToLibrarySymbolInfo(row: TradeseaSearchRow, delayed = true): LibrarySymbolInfo {
  const streamTicker = String(row.ticker || row.full_name || row.symbol || '').trim()
  const display =
    chartSymbolToProductRoot(streamTicker) ||
    String(row.symbol || '').trim() ||
    streamTicker
  const exchange =
    row.exchange || (streamTicker.includes(':') ? streamTicker.split(':')[0].replace(/-Delayed$/i, '') : 'CME')
  const exchangeLabel = delayed ? `${exchange} (Delayed)` : exchange

  return {
    name: display,
    symbol: display,
    ticker: display,
    broker_symbol: streamTicker || undefined,
    description: row.description || display,
    type: normalizeType(row.type),
    exchange: exchangeLabel,
    listed_exchange: exchange,
    full_name: display,
    session: '24x7',
    timezone: 'America/Chicago',
    minmov: 1,
    pricescale: 100,
    has_intraday: true,
    has_seconds: true,
    has_ticks: true,
    has_daily: true,
    has_weekly_and_monthly: true,
    supported_resolutions: TRADESEA_SUPPORTED_RESOLUTIONS,
    intraday_multipliers: TRADESEA_INTRADAY_MULTIPLIERS,
    seconds_multipliers: TRADESEA_SECONDS_MULTIPLIERS,
  }
}

/** Root symbol for chart toolbar / search (MNQ) — not CME-Delayed:MNQ. */
export function librarySymbolDisplayName(info: LibrarySymbolInfo): string {
  const name = String(info.name || info.symbol || '').trim()
  if (name && !name.includes(':') && !/-Delayed:/i.test(name)) return name
  const fromTicker = chartSymbolToProductRoot(String(info.ticker || ''))
  if (fromTicker) return fromTicker
  return name || chartSymbolToProductRoot(String(info.broker_symbol || '')) || ''
}

/** MDS / UDF wire ticker (CME-Delayed:MNQ). */
export function librarySymbolStreamTicker(info: LibrarySymbolInfo): string {
  const broker = String(info.broker_symbol || '').trim()
  if (broker) return broker
  const ticker = String(info.ticker || '').trim()
  if (ticker.includes(':') || /-Delayed:/i.test(ticker)) return ticker
  return ticker
}

export function buildInstrumentIndex(rows: TradeseaInstrumentRow[]): Map<string, TradeseaInstrumentRow> {
  const index = new Map<string, TradeseaInstrumentRow>()
  for (const row of rows) {
    const ticker = String(row.ticker || '').trim()
    const sym = String(row.symbol || '').trim().toUpperCase()
    const display = instrumentDisplaySymbol(row)
    if (ticker) {
      index.set(ticker.toUpperCase(), row)
      index.set(ticker, row)
    }
    if (sym) {
      index.set(sym, row)
      if (ticker.includes(':')) {
        index.set(ticker.split(':').pop()!.toUpperCase(), row)
      }
    }
    if (display) {
      index.set(display, row)
      index.set(display.toUpperCase(), row)
    }
  }
  return index
}

/** Root symbol for storage/display (NQ, MNQ, GC) from chart or stream tickers. */
export function chartSymbolToProductRoot(symbol: string): string {
  let s = String(symbol || '').trim()
  if (!s) return ''
  if (s.includes(':')) {
    s = s.split(':').pop()!.trim()
  }
  s = s.replace(/[0-9!]+$/g, '').trim()
  return s.toUpperCase()
}

export function resolveProductSymbol(
  chartSymbol: string,
  instrumentIndex?: Map<string, TradeseaInstrumentRow>
): string {
  const raw = String(chartSymbol || '').trim()
  if (!raw) return ''

  if (instrumentIndex?.size) {
    const row = findInstrument(instrumentIndex, raw)
    const product = String(row?.symbol || '').trim()
    if (product) return product.toUpperCase()
  }

  return chartSymbolToProductRoot(raw)
}

export function findInstrument(
  index: Map<string, TradeseaInstrumentRow>,
  symbolName: string
): TradeseaInstrumentRow | undefined {
  const raw = String(symbolName || '').trim()
  if (!raw) return undefined

  const upper = raw.toUpperCase()
  const direct = index.get(raw) || index.get(upper)
  if (direct) return direct

  if (raw.includes(':')) {
    const tail = raw.split(':').pop()!.toUpperCase()
    return index.get(tail) || index.get(raw.toUpperCase())
  }

  for (const key of [upper, `CME-DELAYED:${upper}`, `CME:${upper}`]) {
    const hit = index.get(key)
    if (hit) return hit
  }

  return undefined
}

export function parseTradeseaJsonArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const obj = data as { s?: string; d?: T[] }
    if (obj.s === 'ok' && Array.isArray(obj.d)) return obj.d
    if (Array.isArray(obj.d)) return obj.d
  }
  return []
}

/** UDF `/symbols` payload (delayed stack). */
export function udfSymbolToLibrarySymbolInfo(
  row: Record<string, unknown>,
  delayed = true
): LibrarySymbolInfo {
  const streamTicker = String(row.ticker || row.name || '').trim()
  const display = chartSymbolToProductRoot(streamTicker) || streamTicker
  const exchange = String(row.exchange || row.listed_exchange || 'CME')
  const exchangeLabel = delayed && exchange ? `${exchange} (Delayed)` : exchange

  const pipSize = typeof row.pipSize === 'number' ? row.pipSize : undefined
  const pipValue = typeof row.pipValue === 'number' ? row.pipValue : undefined
  const minTick = typeof row.minTick === 'number' ? row.minTick : pipSize

  const minmov =
    typeof row.minmov === 'number'
      ? row.minmov
      : tradeseaPricescale({ minTick, pipSize }).minmov
  const pricescale =
    typeof row.pricescale === 'number'
      ? row.pricescale
      : tradeseaPricescale({ minTick, pipSize }).pricescale

  const supported =
    Array.isArray(row.supported_resolutions) && row.supported_resolutions.length
      ? (row.supported_resolutions as string[])
      : TRADESEA_SUPPORTED_RESOLUTIONS

  return {
    name: display,
    symbol: display,
    ticker: display,
    broker_symbol: streamTicker,
    description: String(row.description || display),
    type: normalizeType(String(row.type || 'futures')),
    exchange: exchangeLabel,
    listed_exchange: exchange,
    full_name: display,
    session: String(row.session || '24x7'),
    timezone: String(row.timezone || 'America/Chicago'),
    minmov,
    pricescale,
    has_intraday: row.has_intraday !== false,
    has_seconds: row.has_seconds !== false,
    has_ticks: row.has_ticks !== false,
    has_daily: row.has_daily !== false,
    has_weekly_and_monthly: row.has_weekly_and_monthly !== false,
    supported_resolutions: supported as LibrarySymbolInfo['supported_resolutions'],
    intraday_multipliers:
      (row.intraday_multipliers as string[] | undefined) || TRADESEA_INTRADAY_MULTIPLIERS,
    seconds_multipliers:
      (row.seconds_multipliers as string[] | undefined) || TRADESEA_SECONDS_MULTIPLIERS,
    volume_precision: 0,
    data_status: String(row.data_status || (delayed ? 'delayed_streaming' : 'streaming')),
    ...(pipSize != null ? { pipSize } : {}),
    ...(pipValue != null ? { pipValue } : {}),
    ...(minTick != null ? { minTick } : {}),
  } as LibrarySymbolInfo
}
