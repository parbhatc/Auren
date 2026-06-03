import { ChartSession, MarketUpdatePreset, parseResolution } from 'rithmic-api'
import { getRithmicCredentials } from './RithmicCredentialsStore.js'
import { resolveChartConnect, withRithmicUserLock } from './rithmicConnect.js'
import {
  formatBarWire,
  formatLatestCloseWire,
  formatLatestHighLowWire,
  formatQuoteWire,
  formatUpdateWire,
  parseSubscribeMessage,
} from './rithmicMdsWire.js'
import {
  logRithmicBar,
  logRithmicLatestClose,
  logRithmicLatestHighLow,
  logRithmicQuote,
  logRithmicTrade,
} from './rithmicChartDebug.js'

export function resolveRithmicBarSubscription(resolution) {
  const parsed = parseResolution(resolution)
  return { barType: parsed.barType, barPeriod: parsed.barTypePeriod }
}

function safeSend(ws, payload) {
  if (ws.readyState !== 1) return
  try {
    ws.send(JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

/**
 * Browser WebSocket ↔ Rithmic ChartSession (live quote + bars).
 * Wire: { type, symbol: "CME:NQ", resolution } — no nested `data`, no `status`.
 */
export class RithmicMdsBridge {
  constructor(clientWs, userId) {
    this.clientWs = clientWs
    this.userId = userId
    this.session = null
    this.chartSymbol = null
    this.resolution = '1'
    this.symbol = null
    this.exchange = null
    this.closed = false
    this.liveActive = false
    this.subscribeChain = Promise.resolve()
    this.pendingSubscribe = null
    this.handlers = {
      trade: null,
      quote: null,
      bar: null,
      latest_high_low: null,
      latest_close: null,
    }
  }

  async handleMessage(raw) {
    if (this.closed) return
    let msg
    try {
      msg = JSON.parse(String(raw))
    } catch {
      return
    }

    const type = String(msg.type || '').toLowerCase()
    if (type === 'ping') {
      safeSend(this.clientWs, { type: 'pong' })
      return
    }
    if (type === 'unsubscribe') {
      await this.stopLive()
      safeSend(this.clientWs, { type: 'unsubscribed', symbol: this.chartSymbol })
      return
    }
    if (type === 'subscribe') {
      const sub = parseSubscribeMessage(msg)
      if (!sub) {
        safeSend(this.clientWs, { type: 'error', message: 'symbol is required' })
        return
      }
      console.log('[RithmicMds] subscribe', {
        userId: this.userId,
        symbol: sub.chartSymbol,
        resolution: sub.resolution,
      })
      await this.enqueueSubscribe(sub)
      return
    }
  }

  enqueueSubscribe(sub) {
    this.pendingSubscribe = sub
    this.subscribeChain = this.subscribeChain.then(() => this.#drainSubscribeQueue())
    return this.subscribeChain
  }

  async #drainSubscribeQueue() {
    while (this.pendingSubscribe && !this.closed) {
      const next = this.pendingSubscribe
      this.pendingSubscribe = null
      await this.#subscribeImpl(next)
    }
  }

  async #subscribeImpl(sub) {
    if (this.closed) return

    const { chartSymbol, symbol, exchange, resolution } = sub

    const same =
      this.session &&
      this.liveActive &&
      this.chartSymbol === chartSymbol &&
      this.resolution === resolution

    if (same) {
      this.#emitSessionSnapshots()
      safeSend(this.clientWs, { type: 'subscribed', symbol: chartSymbol, resolution })
      return
    }

    try {
      await withRithmicUserLock(this.userId, async () => {
        if (this.closed) return
        await this.stopLive()
        if (this.closed) return

        const credentials = await getRithmicCredentials(this.userId)
        if (!credentials) {
          throw new Error('Rithmic market data is not connected.')
        }
        if (this.closed) return

        const connect = await resolveChartConnect(credentials)
        if (this.closed) return

        this.session = await ChartSession.open({
          ...connect,
          symbol,
          exchange,
        })
        if (this.closed) {
          await this.stopLive()
          return
        }

        this.chartSymbol = chartSymbol
        this.symbol = symbol
        this.exchange = exchange
        this.resolution = resolution

        this.#wireSession(this.session)

        const barSub = resolveRithmicBarSubscription(resolution)
        await this.session.startLive({
          updateBits: MarketUpdatePreset.CHART,
          barType: barSub.barType,
          barPeriod: barSub.barPeriod,
        })
        if (this.closed) {
          await this.stopLive()
          return
        }

        this.liveActive = true
        this.#emitSessionSnapshots()
      })

      if (this.closed || !this.liveActive) return

      safeSend(this.clientWs, { type: 'subscribed', symbol: chartSymbol, resolution })
    } catch (err) {
      this.liveActive = false
      await this.stopLive()
      if (this.closed) return
      console.error('[RithmicMds] subscribe failed', {
        userId: this.userId,
        symbol: chartSymbol,
        resolution,
        message: String(err?.message || err),
      })
      safeSend(this.clientWs, {
        type: 'error',
        message: String(err?.message || err),
      })
    }
  }

  /** Push cached session high/low/close so late WebSocket clients still get a snapshot. */
  #emitSessionSnapshots() {
    if (!this.session) return
    const chartSymbol = this.chartSymbol
    if (!chartSymbol) return

    const st = this.session.status
    const hasHl =
      (st?.latest_high != null && Number.isFinite(Number(st.latest_high))) ||
      (st?.latest_low != null && Number.isFinite(Number(st.latest_low)))
    if (hasHl) {
      const row = {
        high_price: st.latest_high,
        low_price: st.latest_low,
        ssboe: Math.floor(Date.now() / 1000),
      }
      logRithmicLatestHighLow(row, chartSymbol)
      safeSend(this.clientWs, formatLatestHighLowWire(row, chartSymbol))
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
      logRithmicLatestClose(row, chartSymbol)
      safeSend(this.clientWs, formatLatestCloseWire(row, chartSymbol))
    }
  }

  #wireSession(session) {
    this.#detachSession()
    const chartSymbol = this.chartSymbol

    this.handlers.trade = (trade) => {
      logRithmicTrade(trade, chartSymbol)
      safeSend(this.clientWs, formatUpdateWire(trade, chartSymbol))
    }
    this.handlers.quote = (quote) => {
      logRithmicQuote(quote, chartSymbol)
      safeSend(this.clientWs, formatQuoteWire(quote, chartSymbol))
    }
    this.handlers.bar = (bar) => {
      logRithmicBar(bar, chartSymbol)
      safeSend(this.clientWs, formatBarWire(bar, chartSymbol, this.resolution))
    }
    this.handlers.latest_high_low = (row) => {
      logRithmicLatestHighLow(row, chartSymbol)
      safeSend(this.clientWs, formatLatestHighLowWire(row, chartSymbol))
    }
    this.handlers.latest_close = (row) => {
      logRithmicLatestClose(row, chartSymbol)
      safeSend(this.clientWs, formatLatestCloseWire(row, chartSymbol))
    }

    session.on('trade', this.handlers.trade)
    session.on('quote', this.handlers.quote)
    session.on('bar', this.handlers.bar)
    session.on('latest_high_low', this.handlers.latest_high_low)
    session.on('latest_close', this.handlers.latest_close)
  }

  #detachSession() {
    if (!this.session) return
    for (const [event, handler] of Object.entries(this.handlers)) {
      if (handler) this.session.off(event, handler)
    }
    this.handlers = {
      trade: null,
      quote: null,
      bar: null,
      latest_high_low: null,
      latest_close: null,
    }
  }

  async stopLive() {
    this.liveActive = false
    this.#detachSession()
    if (this.session) {
      try {
        await this.session.stopLive()
      } catch {
        /* ignore */
      }
      try {
        this.session.close()
      } catch {
        /* ignore */
      }
      this.session = null
    }
    this.chartSymbol = null
    this.symbol = null
    this.exchange = null
  }

  async close() {
    if (this.closed) return
    this.closed = true
    this.pendingSubscribe = null
    await this.stopLive()
  }
}
