import {
  ChartSession,
  CandleLayer,
  isCanonicalResolution,
  trimCountbackBars,
  barsToHistoryPayload,
  parseResolution,
} from 'rithmic-api'
import { getRithmicCredentials } from './RithmicCredentialsStore.js'
import { findRithmicSymbol } from './RithmicSymbolsService.js'
import { resolveChartConnect, withRithmicUserLock } from './rithmicConnect.js'
import { replayHistoryBars } from './RithmicHistoryReplay.js'
import { logRithmicHistory } from './rithmicChartDebug.js'

const DEFAULT_COUNTBACK = 300

/** Unix seconds for a normalized replay bar. */
function barTimeSec(bar) {
  if (bar.t != null && Number.isFinite(Number(bar.t))) return Number(bar.t)
  return Number(bar.marker ?? 0)
}

/** TradingView rejects history when any bar falls outside the requested window. */
function filterBarsToRange(bars, from, to) {
  if (from == null && to == null) return bars
  const lo = from != null && Number.isFinite(Number(from)) ? Number(from) : -Infinity
  const hi = to != null && Number.isFinite(Number(to)) ? Number(to) : Infinity
  return bars.filter((b) => {
    const t = barTimeSec(b)
    return t >= lo && t <= hi
  })
}

function resolveCountback(query, periodSeconds) {
  const countback =
    query.countback != null && Number.isFinite(Number(query.countback))
      ? Number(query.countback)
      : DEFAULT_COUNTBACK
  const from =
    query.from != null && Number.isFinite(Number(query.from)) ? Number(query.from) : null
  const to = query.to != null && Number.isFinite(Number(query.to)) ? Number(query.to) : null
  if (from != null && to != null && to > from) {
    const spanBars = Math.ceil((to - from) / periodSeconds) + 2
    return Math.min(5000, Math.max(countback, spanBars))
  }
  return Math.min(5000, countback)
}

/**
 * @param {string} userId
 * @param {{ symbol: string, exchange: string, resolution?: string|number, from?: number, to?: number, countback?: number, include_forming?: boolean }} query
 */
export async function fetchRithmicChartHistory(userId, query) {
  return withRithmicUserLock(userId, async () => {
    const credentials = await getRithmicCredentials(userId)
    if (!credentials) {
      throw new Error('Rithmic market data is not connected.')
    }
    const connect = await resolveChartConnect(credentials)
    const symbol = String(query.symbol || 'NQ').trim().toUpperCase()
    const catalog = findRithmicSymbol(symbol) || findRithmicSymbol(`${query.exchange || 'CME'}:${symbol}`)
    const exchange = String(query.exchange || catalog?.exchange || 'CME')
      .trim()
      .toUpperCase()
    const chartSymbol = catalog?.symbol || symbol
    const chartLabel = `${exchange}:${chartSymbol}`

    const resolution = query.resolution ?? 1
    const include_forming = query.include_forming === true
    const from =
      query.from != null && Number.isFinite(Number(query.from)) ? Number(query.from) : undefined
    const to =
      query.to != null && Number.isFinite(Number(query.to)) ? Number(query.to) : undefined
    const { periodSeconds } = parseResolution(resolution)
    const countback = resolveCountback(query, periodSeconds)

    if (!isCanonicalResolution(resolution)) {
      let bars = await replayHistoryBars({
        connect,
        symbol: chartSymbol,
        exchange,
        resolution,
        from,
        to,
        countback,
        include_forming,
      })
      bars = filterBarsToRange(bars, from, to)
      if (bars.length > countback) {
        bars = trimCountbackBars(bars, countback, 'to')
      }

      logRithmicHistory(chartLabel, bars)
      return barsToHistoryPayload(bars, { timeOffset: 0, compat: true })
    }

    const chart = await ChartSession.open({
      user: connect.user,
      password: connect.password,
      systemName: connect.systemName,
      uri: connect.uri,
      gatewayName: connect.gatewayName,
      symbol: chartSymbol,
      exchange,
    })

    try {
      let series

      if (!include_forming) {
        // Scrollback / incremental: load the exact TV window (closed bars only).
        series = await chart.loadHistory({
          resolution,
          from,
          to,
          countback,
          include_forming: false,
        })
      } else {
        // First load: CandleLayer for correct forming OHLC on the open bucket.
        const layer = new CandleLayer(chart)
        await layer.load1m({
          alsoFor: [resolution],
          countback,
          include_forming: true,
        })
        series = layer.getSeries(resolution)
      }

      series = filterBarsToRange(series, from, to)
      if (series.length > countback) {
        const anchor = from != null && to != null && to - from > countback * periodSeconds ? 'spread' : 'to'
        series = trimCountbackBars(series, countback, anchor)
      }

      logRithmicHistory(chartLabel, series)
      return barsToHistoryPayload(series, { timeOffset: 0, compat: true })
    } finally {
      chart.close()
    }
  })
}
