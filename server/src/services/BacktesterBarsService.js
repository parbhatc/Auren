import BarCache from '../utils/BarCache.js'
import aggregateBars from '../utils/BarAggregator.js'
import { csvFolderForChartResolution } from '../utils/backtesterCsvPaths.js'
import {
  parseBacktesterResolution,
  resolutionToMinutes,
  isSubMinuteResolution,
} from '../utils/backtesterResolution.js'

/**
 * Per-user/session bar cache + getBars logic shared by HTTP API and WebSocket handlers.
 */
class BacktesterBarsService {
  constructor(csvLoader) {
    this.csvLoader = csvLoader
    /** @type {Map<string, { session: object, barCache: BarCache, symbols: Map<string, object>, anchorMs: number }>} */
    this.runtimes = new Map()
  }

  runtimeKey(userId, sessionId) {
    return `${userId}:${sessionId}`
  }

  sessionAnchorDate(session) {
    const [year, month, day] = session.startDate.split('-').map(Number)
    const [hours, minutes] = session.startTime.split(':').map(Number)
    return new Date(year, month - 1, day, hours, minutes, 0, 0)
  }

  /**
   * Create or refresh runtime for a backtest session (called on WS sessionData).
   * @param {string} userId
   * @param {object} session
   * @param {Record<string, object>} [symbols]
   */
  initRuntime(userId, session, symbols = {}) {
    if (!session?.id || !session?.startDate || !session?.startTime) {
      throw new Error('Session missing id, startDate, or startTime')
    }

    const key = this.runtimeKey(userId, session.id)
    const anchor = this.sessionAnchorDate(session)
    const anchorMs = anchor.getTime()

    let runtime = this.runtimes.get(key)
    if (runtime && runtime.anchorMs === anchorMs && runtime.session?.startDate === session.startDate) {
      for (const [sym, info] of Object.entries(symbols)) {
        runtime.symbols.set(sym, info)
      }
      runtime.session = { ...session }
      return runtime
    }

    const barCache = new BarCache({ csvLoader: this.csvLoader }, anchor)
    runtime = {
      session: { ...session },
      barCache,
      symbols: new Map(Object.entries(symbols)),
      anchorMs,
    }
    this.runtimes.set(key, runtime)
    return runtime
  }

  getRuntime(userId, sessionId) {
    return this.runtimes.get(this.runtimeKey(userId, sessionId)) ?? null
  }

  updateSessionAnchor(userId, sessionId, anchorDate, startDate) {
    const runtime = this.getRuntime(userId, sessionId)
    if (!runtime) return null
    runtime.barCache.last = anchorDate instanceof Date ? anchorDate : new Date(anchorDate)
    runtime.anchorMs = runtime.barCache.last.getTime()
    if (startDate) {
      runtime.session = { ...runtime.session, startDate }
    }
    return runtime
  }

  clearSymbolBarCache(userId, sessionId) {
    const runtime = this.getRuntime(userId, sessionId)
    runtime?.barCache?.clearAll?.()
  }

  toEpochMs(value) {
    if (value == null || !Number.isFinite(Number(value))) return null
    const n = Number(value)
    return n > 1e12 ? n : n * 1000
  }

  sanitizeBarsForWire(bars) {
    if (!Array.isArray(bars) || !bars.length) return []
    const byTime = new Map()
    for (const raw of bars) {
      const open = Number(raw?.open)
      const high = Number(raw?.high)
      const low = Number(raw?.low)
      const close = Number(raw?.close)
      const timeRaw = Number(raw?.time)
      if (![open, high, low, close, timeRaw].every(Number.isFinite)) continue
      const timeMs = timeRaw > 1e12 ? Math.floor(timeRaw) : Math.floor(timeRaw * 1000)
      const volumeRaw = raw?.volume != null ? Number(raw.volume) : 0
      byTime.set(timeMs, {
        time: timeMs,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volumeRaw) ? volumeRaw : 0,
      })
    }
    return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
  }

  getResolutionInMinutes(resolution) {
    const numericMatch = resolution.match(/^(\d+)$/)
    if (numericMatch) {
      return parseInt(numericMatch[1], 10)
    }

    const dailyMatch = resolution.match(/^(\d+)D$/)
    if (dailyMatch) {
      const days = parseInt(dailyMatch[1], 10) || 1
      return days * 1440
    }

    const weeklyMatch = resolution.match(/^(\d+)W$/)
    if (weeklyMatch) {
      const weeks = parseInt(weeklyMatch[1], 10) || 1
      return weeks * 10080
    }

    const monthlyMatch = resolution.match(/^(\d+)M$/)
    if (monthlyMatch) {
      const months = parseInt(monthlyMatch[1], 10) || 1
      return months * 43200
    }

    console.warn(`[BacktesterBarsService] Unknown resolution format: ${resolution}, defaulting to 1 minute`)
    return 1
  }

  /**
   * Stateless history load for HTTP — auth token only, no WS session cache.
   * @param {object} data
   */
  getHistoryBars(data) {
    const {
      symbol,
      resolution: wireResolution,
      from,
      to,
      firstDataRequest,
      countBack,
      requestId,
    } = data

    const resolution = parseBacktesterResolution(wireResolution)
    const csvResolution = csvFolderForChartResolution(resolution)
    const nativeSubMinute = isSubMinuteResolution(resolution)
    const loadOpts = { csvResolution }

    const fromMs = this.toEpochMs(from)
    const toMs = this.toEpochMs(to)
    const requestedCount = Number(countBack) || 0
    const resolutionMinutes = resolutionToMinutes(resolution)
    const oneMinCount =
      nativeSubMinute || resolution === '1'
        ? (requestedCount || 300)
        : (requestedCount || 300) * resolutionMinutes

    console.log(
      `[backtester HTTP] history request: ${symbol}@${wireResolution ?? resolution} csv=${csvResolution} from ${from} to ${to} countBack=${countBack} (requestId: ${requestId})`,
    )

    let bars = []

    if (firstDataRequest) {
      const anchorMs = toMs ?? fromMs
      if (fromMs != null && toMs != null && toMs > fromMs) {
        bars = this.csvLoader.loadBars(symbol, fromMs, toMs, loadOpts)
      }
      if (!bars.length && anchorMs != null) {
        const initialOneMin =
          nativeSubMinute || resolution === '1'
            ? Math.min(30000, Math.max(oneMinCount, 20000))
            : oneMinCount
        bars = this.csvLoader.loadCountback(symbol, anchorMs, initialOneMin, true, loadOpts)
      }
    } else if (fromMs != null && toMs != null && toMs > fromMs) {
      bars = this.csvLoader.loadBars(symbol, fromMs, toMs, loadOpts)
      if (!bars.length && toMs != null) {
        bars = this.csvLoader.loadCountback(symbol, toMs, oneMinCount, false, loadOpts)
      }
    } else if (toMs != null) {
      bars = this.csvLoader.loadCountback(symbol, toMs, oneMinCount, false, loadOpts)
    } else if (fromMs != null) {
      bars = this.csvLoader.loadCountback(symbol, fromMs, oneMinCount, true, loadOpts)
    }

    if (!nativeSubMinute && resolution && resolution !== '1' && Array.isArray(bars) && bars.length > 0) {
      bars = aggregateBars(bars, resolution)
    }

    bars = this.sanitizeBarsForWire(bars)

    const atHistoryStart =
      requestedCount > 0 &&
      bars.length > 0 &&
      bars.length < requestedCount &&
      !firstDataRequest

    return {
      requestId,
      bars,
      noData: bars.length === 0,
      meta: atHistoryStart ? { noData: true } : undefined,
    }
  }

  /**
   * @param {string} userId
   * @param {string} sessionId
   * @param {object} data
   */
  getBars(userId, sessionId, data) {
    const runtime = this.getRuntime(userId, sessionId)
    if (!runtime?.barCache) {
      const err = new Error('Session bar cache not ready — connect WebSocket and send sessionData first')
      err.code = 'SESSION_NOT_READY'
      throw err
    }

    const { barCache } = runtime
    let bars
    const {
      symbol,
      resolution,
      from,
      to,
      firstDataRequest,
      countBack,
      requestId,
    } = data

    console.log(
      `[backtester HTTP] getBars request: ${symbol}@${resolution} from ${from} to ${to} countBack=${countBack} (requestId: ${requestId})`,
    )

    let hasData = barCache.hasData(symbol)

    if (hasData && firstDataRequest) {
      hasData = false
      barCache.clear(symbol)
    }

    const resolutionMinutes = this.getResolutionInMinutes(resolution)
    const one_min_countback = resolution === '1' ? countBack : countBack * resolutionMinutes

    if (!hasData) {
      let lastTime = barCache.last.getTime()
      const exactExists = this.csvLoader.hasExactCandle(symbol, lastTime)

      if (!exactExists) {
        const originalTime = lastTime
        const closestBar = this.csvLoader.findClosestCandle(symbol, lastTime)
        if (closestBar) {
          barCache.last = new Date(closestBar.time)
          lastTime = closestBar.time
          const timeDiff = Math.abs(closestBar.time - originalTime)
          const minutesDiff = Math.floor(timeDiff / (1000 * 60))
          console.log(
            `Exact candle not found, using closest: ${barCache.last.toLocaleString()} (${minutesDiff} minutes away)`,
          )
        }
      }

      const initialOneMin =
        resolution === '1'
          ? Math.min(30000, Math.max(one_min_countback, 20000))
          : one_min_countback
      bars = barCache.loadCountback(symbol, lastTime, initialOneMin, true)
    } else {
      const beforeMs = this.toEpochMs(to) ?? barCache.getOldest(symbol)
      const fromMs = this.toEpochMs(from)
      if (fromMs != null && beforeMs != null && beforeMs > fromMs) {
        bars = barCache.loadRange(symbol, fromMs, beforeMs)
        if (!bars.length) {
          bars = barCache.loadCountback(symbol, beforeMs, one_min_countback, false)
        }
      } else {
        bars = barCache.loadCountback(symbol, beforeMs, one_min_countback, false)
      }
    }

    if (resolution && resolution !== '1' && Array.isArray(bars) && bars.length > 0) {
      bars = aggregateBars(bars, resolution)
    }

    bars = this.sanitizeBarsForWire(bars)

    const requestedCount = Number(countBack) || 0
    const atHistoryStart =
      requestedCount > 0 &&
      bars.length > 0 &&
      bars.length < requestedCount &&
      !firstDataRequest

    return {
      requestId,
      bars,
      noData: bars.length === 0,
      meta: atHistoryStart ? { noData: true } : undefined,
    }
  }
}

/** @type {BacktesterBarsService | null} */
let instance = null

export function initBacktesterBarsService(csvLoader) {
  instance = new BacktesterBarsService(csvLoader)
  return instance
}

export function getBacktesterBarsService() {
  if (!instance) {
    throw new Error('BacktesterBarsService not initialized')
  }
  return instance
}

export default BacktesterBarsService
