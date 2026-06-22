import {
  ChartSession,
  HistoryQuery,
  FormingBarManager,
  wrapChartSession,
} from 'rithmic-api'
import {
  isCanonicalResolution,
  mergeBarIntoSeries,
} from './rithmicResolution.js'
import { getRithmicCredentials } from './RithmicCredentialsStore.js'
import { findRithmicSymbol } from './RithmicSymbolsService.js'
import { resolveChartConnect, withRithmicUserLock } from './rithmicConnect.js'
import {
  ensureLiveDataRithmicReady,
  usesLiveDataRithmicSession,
} from '../liveData/rithmicLiveDataSession.js'
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
  const credentials = await getRithmicCredentials(userId)
  if (!credentials) {
    throw new Error('Rithmic market data is not connected.')
  }

  const useLiveData = usesLiveDataRithmicSession(credentials)
  let connectCredentials = credentials
  if (useLiveData) {
    const bootstrapCreds = await ensureLiveDataRithmicReady()
    if (bootstrapCreds) connectCredentials = bootstrapCreds
  }

  const run = async () => {
    const connect = await resolveChartConnect(connectCredentials)
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
    const { periodSeconds } = HistoryQuery.parseResolution(resolution)
    const countback = resolveCountback(query, periodSeconds)

    // History plant replay does not open a ticker ChartSession — safe alongside live_data hub.
    if (useLiveData || !isCanonicalResolution(resolution)) {
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
        bars = HistoryQuery.trimCountbackBars(bars, countback, 'to')
      }

      logRithmicHistory(chartLabel, bars)
      return HistoryQuery.barsToHistoryPayload(bars, { timeOffset: 0, compat: true })
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
        series = await chart.planets.history.load({
          resolution,
          from,
          to,
          countback,
        })
      } else {
        const nowSec = to ?? Math.floor(Date.now() / 1000)
        const mgr = new FormingBarManager(wrapChartSession(chart))
        await mgr.bootstrap({
          resolutions: [String(resolution)],
          nowSec,
        })
        series = await chart.planets.history.load({
          resolution,
          from,
          to,
          countback,
        })
        const forming = mgr.getForming(resolution)
        if (forming) {
          series = mergeBarIntoSeries(series, forming)
        }
      }

      series = filterBarsToRange(series, from, to)
      if (series.length > countback) {
        const anchor = from != null && to != null && to - from > countback * periodSeconds ? 'spread' : 'to'
        series = HistoryQuery.trimCountbackBars(series, countback, anchor)
      }

      logRithmicHistory(chartLabel, series)
      return HistoryQuery.barsToHistoryPayload(series, { timeOffset: 0, compat: true })
    } finally {
      chart.close()
    }
  }

  if (useLiveData) {
    return run()
  }

  return withRithmicUserLock(userId, run)
}
