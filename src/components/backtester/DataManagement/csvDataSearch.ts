import { getApiBaseUrl, getAuthHeaders } from '../../../api/api'
import { tradeseaAPI } from '../../../api/tradesea.api'
import { refreshPracticeFromApi, getPracticeMarketDataSettings } from '../../../constants/practice'
import { getTradeseaConnectionGroupId } from '../../../services/tradesea/tradeseaDeviceFingerprint'
import {
  instrumentDisplaySymbol,
  parseTradeseaJsonArray,
  type TradeseaInstrumentRow,
} from '../../../services/tradesea/tradeseaSymbolInfo'
import { getSymbolTicker, type SymbolTickerSource } from './symbolTickers'
import type { SymbolData } from '../../../types/backtesterDataManagement'

export interface CsvSearchResult {
  id: string
  /** Storage symbol in backtester config (e.g. NQ) */
  symbol: string
  /** Contract / instrument code shown in UI (e.g. NQ1! for continuous futures) */
  displaySymbol?: string
  description: string
  exchange?: string
  type?: string
  ticker?: string
  formattedSymbol?: string
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}

function tickerContractCode(ticker: string): string {
  const colon = ticker.indexOf(':')
  return colon >= 0 ? ticker.slice(colon + 1) : ticker
}

/**
 * Search only symbols that have a ticker configured for the active data source.
 */
export function searchConfiguredCsvSymbols(
  query: string,
  symbols: Record<string, SymbolData>,
  source: SymbolTickerSource
): CsvSearchResult[] {
  const q = query.trim().toUpperCase()
  if (!q) return []

  const results: CsvSearchResult[] = []

  for (const [storageSymbol, data] of Object.entries(symbols)) {
    const ticker = getSymbolTicker(data, source)
    if (!ticker) continue

    const contractCode = tickerContractCode(ticker)
    const description = stripHtml(data.description || '')
    const haystack = `${storageSymbol} ${description} ${ticker} ${contractCode}`.toUpperCase()
    if (!haystack.includes(q)) continue

    results.push({
      id: `cfg-${source}-${storageSymbol}`,
      symbol: storageSymbol,
      displaySymbol: contractCode !== storageSymbol ? contractCode : storageSymbol,
      description: description || storageSymbol,
      ticker,
      formattedSymbol: ticker,
    })
  }

  return results.sort((a, b) => a.symbol.localeCompare(b.symbol))
}

export async function ensurePracticeMarketDataLoaded(): Promise<void> {
  await refreshPracticeFromApi()
}

export function getTradeseaMarketDataStatus(): {
  ok: boolean
  accountId: string
  accountLabel: string
  message?: string
} {
  const md = getPracticeMarketDataSettings()
  if (md.propFirmId !== 'tradesea') {
    return {
      ok: false,
      accountId: '',
      accountLabel: '',
      message: 'Practice market data must be set to Tradesea.',
    }
  }
  if (!md.accountId?.trim()) {
    return {
      ok: false,
      accountId: '',
      accountLabel: '',
      message: 'Select a practice account for market data in Settings.',
    }
  }
  return {
    ok: true,
    accountId: md.accountId,
    accountLabel: md.accountLabel || md.accountId,
  }
}

export async function searchTradeseaCsvSymbols(query: string): Promise<CsvSearchResult[]> {
  const status = getTradeseaMarketDataStatus()
  if (!status.ok) {
    throw new Error(status.message || 'Tradesea market data is not configured.')
  }

  const stream = await tradeseaAPI.getStreamConfig(status.accountId)
  if (!stream.success || !stream.userId) {
    throw new Error(stream.error || stream.message || 'Could not load Tradesea stream config.')
  }

  const connectionGroupId = await getTradeseaConnectionGroupId(stream.userId)
  const params = new URLSearchParams({
    'connection-user-id': stream.userId,
    'connection-group-id': connectionGroupId,
    query: query.trim(),
    limit: '30',
    type: '',
    exchange: '',
    accountId: status.accountId,
  })

  const url = `${getApiBaseUrl().replace(/\/$/, '')}/tradesea/proxy/udf/search?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      ...getAuthHeaders(),
      Accept: 'application/json',
    },
  })

  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : []
  } catch {
    throw new Error(res.ok ? 'Invalid Tradesea search response' : `Tradesea search failed (${res.status})`)
  }

  if (!res.ok) {
    const err = data as { message?: string; error?: string }
    throw new Error(err?.message || err?.error || `Tradesea search failed (${res.status})`)
  }

  const rows = parseTradeseaJsonArray<TradeseaInstrumentRow>(data)
  return rows.map((row, index) => {
    const symbol = instrumentDisplaySymbol(row)
    return {
      id: `tradesea-${symbol}-${row.ticker || index}`,
      symbol,
      description: row.description || symbol,
      exchange: row.exchange,
      type: row.type,
      ticker: row.ticker,
      formattedSymbol: row.ticker || symbol,
    }
  })
}

interface TradingViewSearchRow {
  symbol?: string
  description?: string
  exchange?: string
  type?: string
  source_id?: string
  contracts?: Array<{
    symbol?: string
    prefix?: string
  }>
}

function buildTradingViewFormattedSymbol(row: TradingViewSearchRow): {
  symbol: string
  formattedSymbol: string
} {
  const prefix = row.source_id || ''
  const cleanBase = stripHtml(row.symbol || '')

  if (row.type === 'futures' && row.contracts?.length) {
    const first = row.contracts[0]
    const contractSymbol = stripHtml(first.symbol || '')
    const contractPrefix = first.prefix || prefix
    if (contractSymbol && contractPrefix) {
      return {
        symbol: contractSymbol,
        formattedSymbol: `${contractPrefix}:${contractSymbol}`,
      }
    }
  }

  return {
    symbol: cleanBase,
    formattedSymbol: prefix ? `${prefix}:${cleanBase}` : cleanBase,
  }
}

export async function searchTradingViewCsvSymbols(query: string): Promise<CsvSearchResult[]> {
  const params = new URLSearchParams({
    text: query.trim(),
    hl: '1',
    exchange: '',
    lang: 'en',
    search_type: 'undefined',
    domain: 'production',
    enable_grouping: 'true',
    sort_by_country: 'US',
    promo: 'true',
  })

  const url = `${getApiBaseUrl().replace(/\/$/, '')}/tradingview/search?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      ...getAuthHeaders(),
      Accept: 'application/json',
    },
  })

  const payload = (await res.json()) as {
    success?: boolean
    data?: TradingViewSearchRow[] | { symbols?: TradingViewSearchRow[] }
    message?: string
  }

  if (!res.ok || payload.success === false) {
    throw new Error(payload.message || `TradingView search failed (${res.status})`)
  }

  const data = payload.data
  const rows = Array.isArray(data) ? data : data?.symbols || []

  return rows.map((row, index) => {
    const { symbol, formattedSymbol } = buildTradingViewFormattedSymbol(row)
    const description = stripHtml(row.description || symbol)
    return {
      id: `tv-${formattedSymbol}-${index}`,
      symbol,
      displaySymbol: symbol,
      description,
      exchange: row.exchange,
      type: row.type,
      formattedSymbol,
    }
  })
}
