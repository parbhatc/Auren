import { ChartSession, MarketUpdatePreset } from 'rithmic-api'
import { resolveChartConnect, withRithmicUserLock } from '../rithmic/rithmicConnect.js'
import { RITHMIC_LIVE_DATA_LOCK_ID } from './liveDataConstants.js'
import { resolveRithmicBarSubscription } from '../rithmic/rithmicBarSubscription.js'
import {
  formatBarWire,
  formatLatestCloseWire,
  formatLatestHighLowWire,
  formatQuoteWire,
  formatUpdateWire,
} from '../rithmic/rithmicMdsWire.js'
import {
  logRithmicBar,
  logRithmicLatestClose,
  logRithmicLatestHighLow,
  logRithmicQuote,
  logRithmicTrade,
} from '../rithmic/rithmicChartDebug.js'
import { logLiveDataDisconnected, logLiveDataInfo } from './liveDataLog.js'

const HUB_LOCK_ID = RITHMIC_LIVE_DATA_LOCK_ID
const PROVIDER = 'Rithmic'

/** @type {import('rithmic-api').ChartSession | null} */
let session = null
let chartSymbol = null
let symbol = null
let exchange = null
let resolution = '1'
let liveActive = false
/** @type {Set<(payload: object) => void>} */
const listeners = new Set()

const handlers = {
  trade: null,
  quote: null,
  bar: null,
  latest_high_low: null,
  latest_close: null,
}

function fanOut(payload) {
  for (const send of listeners) {
    try {
      send(payload)
    } catch {
      /* ignore */
    }
  }
}

function detachSession() {
  if (!session) return
  for (const [event, handler] of Object.entries(handlers)) {
    if (handler) session.off(event, handler)
  }
  handlers.trade = null
  handlers.quote = null
  handlers.bar = null
  handlers.latest_high_low = null
  handlers.latest_close = null
}

function wireSession() {
  detachSession()
  const sym = chartSymbol

  handlers.trade = (trade) => {
    logRithmicTrade(trade, sym)
    fanOut(formatUpdateWire(trade, sym))
  }
  handlers.quote = (quote) => {
    logRithmicQuote(quote, sym)
    fanOut(formatQuoteWire(quote, sym))
  }
  handlers.bar = (bar) => {
    logRithmicBar(bar, sym)
    fanOut(formatBarWire(bar, sym, resolution))
  }
  handlers.latest_high_low = (row) => {
    logRithmicLatestHighLow(row, sym)
    fanOut(formatLatestHighLowWire(row, sym))
  }
  handlers.latest_close = (row) => {
    logRithmicLatestClose(row, sym)
    fanOut(formatLatestCloseWire(row, sym))
  }

  session.on('trade', handlers.trade)
  session.on('quote', handlers.quote)
  session.on('bar', handlers.bar)
  session.on('latest_high_low', handlers.latest_high_low)
  session.on('latest_close', handlers.latest_close)
}

function pushSnapshots(send) {
  if (!session || !chartSymbol) return
  const st = session.status
  const hasHl =
    (st?.latest_high != null && Number.isFinite(Number(st.latest_high))) ||
    (st?.latest_low != null && Number.isFinite(Number(st.latest_low)))
  if (hasHl) {
    const row = {
      high_price: st.latest_high,
      low_price: st.latest_low,
      ssboe: Math.floor(Date.now() / 1000),
    }
    send(formatLatestHighLowWire(row, chartSymbol))
  }
  const hasClose =
    (st?.latest_close != null && Number.isFinite(Number(st.latest_close))) ||
    (st?.latest_settlement != null && Number.isFinite(Number(st.latest_settlement)))
  if (hasClose) {
    const row = {
      close_price: st.latest_close,
      settlement_price: st.latest_settlement,
      ssboe: Math.floor(Date.now() / 1000),
    }
    send(formatLatestCloseWire(row, chartSymbol))
  }
}

export function matchesRithmicLiveTicker(nextChartSymbol, nextResolution) {
  return (
    liveActive &&
    chartSymbol === nextChartSymbol &&
    String(resolution) === String(nextResolution || '1')
  )
}

export function getRithmicLiveTickerMeta() {
  if (!liveActive) return null
  return { chartSymbol, symbol, exchange, resolution }
}

/** @param {(payload: object) => void} send */
export function attachRithmicLiveTickerListener(send) {
  listeners.add(send)
  pushSnapshots(send)
  return () => listeners.delete(send)
}

export async function startRithmicLiveTicker(credentials, sub) {
  if (!credentials || !sub?.symbol) {
    return { ok: false, message: 'ticker subscription missing symbol' }
  }

  if (matchesRithmicLiveTicker(sub.chartSymbol, sub.resolution)) {
    return { ok: true, reused: true }
  }

  await stopRithmicLiveTicker()

  return withRithmicUserLock(HUB_LOCK_ID, async () => {
    const connect = await resolveChartConnect(credentials)
    session = await ChartSession.open({
      ...connect,
      symbol: sub.symbol,
      exchange: sub.exchange,
    })

    chartSymbol = sub.chartSymbol
    symbol = sub.symbol
    exchange = sub.exchange
    resolution = sub.resolution

    wireSession()

    const barSub = resolveRithmicBarSubscription(resolution)
    await session.startLive({
      updateBits: MarketUpdatePreset.CHART,
      barType: barSub.barType,
      barPeriod: barSub.barPeriod,
    })

    liveActive = true
    logLiveDataInfo(
      `${PROVIDER} listening on ${chartSymbol} (${resolution}) for live candles.`
    )

    return { ok: true }
  })
}

export async function stopRithmicLiveTicker() {
  const wasActive = Boolean(session || liveActive)
  liveActive = false
  listeners.clear()
  detachSession()
  if (session) {
    try {
      await session.stopLive()
    } catch {
      /* ignore */
    }
    try {
      session.close()
    } catch {
      /* ignore */
    }
    session = null
  }
  chartSymbol = null
  symbol = null
  exchange = null
  if (wasActive) {
    logLiveDataDisconnected(`${PROVIDER} Ticker`)
  }
}
