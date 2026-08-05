import TokenService from '../services/TokenService.js'
import providerRegistry from '../services/practiceMarketData/PracticeMarketDataProviderRegistry.js'
import WebSocketBase from './WebSocketBase.js'
import Database from '../config/Database.js'

export const PRACTICE_MARKET_DATA_PATH = providerRegistry.descriptor?.transport?.clientGatewayPath || '/practice-market-data-ws'

function normalizeSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase()
  if (!symbol || symbol.length > 100) throw new TypeError('A valid symbol is required')
  return symbol
}

function normalizeResolution(value, supported) {
  const requested = String(value || '1').trim().toUpperCase()
  const resolution = requested === 'D' ? '1D' : requested === 'W' ? '1W' : requested
  if (!supported.includes(resolution)) throw new TypeError(`Unsupported resolution: ${resolution}`)
  return resolution
}

function normalizeBars(value, maximum) {
  const bars = Number(value ?? 500)
  if (!Number.isInteger(bars) || bars < 1 || bars > maximum) {
    throw new TypeError(`bars must be an integer between 1 and ${maximum}`)
  }
  return bars
}

function errorPayload(error, id) {
  return {
    type: 'error',
    ...(id == null ? {} : { id }),
    error: { code: error?.code || 'REQUEST_FAILED', message: error?.message || 'Request failed' },
  }
}

export default class PracticeMarketDataWebSocket extends WebSocketBase {
  constructor(server, options = {}) {
    super({ serverName: 'practice-market-data', path: PRACTICE_MARKET_DATA_PATH, enableHeartbeat: false })
    this.server = server
    this.marketData = options.marketData || providerRegistry
    this.verifyToken = options.verifyToken || ((token) => TokenService.verifyAuthToken(token))
    this.getUserSessionId = options.getUserSessionId || options.getUserToken || (async (userId) => {
      try {
        await Database.initialize()
        const row = await Database.get(
          'SELECT session_id FROM prop_firms WHERE user_id = ? AND type = ?',
          [userId, 'tradingview']
        )
        return String(row?.session_id || '').trim() || null
      } catch (error) {
        console.warn('[practice-market-data] Could not load the user TradingView session ID; using the server session', error?.message || error)
        return null
      }
    })
    this.resolutions = options.resolutions || this.marketData.supportedResolutions
    this.maxBars = Math.max(500, Number(options.maxBars || process.env.TRADINGVIEW_MAX_BARS) || 5_000)
    this.pollMs = Math.max(1_000, Number(options.pollMs || process.env.TRADINGVIEW_LIVE_POLL_MS) || 5_000)
    this.subscriptions = new Map()
    this.userIds = new Map()
  }

  handleConnection(ws, req, clientInfo, serverInfo) {
    const decoded = clientInfo.token ? this.verifyToken(clientInfo.token) : null
    if (!decoded?.userId) {
      ws.close(1008, 'Unauthorized')
      return
    }
    this.userIds.set(ws, decoded.userId)
    this.subscriptions.set(ws, new Map())
    super.handleConnection(ws, req, clientInfo, serverInfo)
  }

  sendWelcomeMessage(ws) {
    this.send(ws, {
      type: 'connected',
      protocol: 'auren-practice-market-data.v1',
      usage: 'practice-only',
      supported_resolutions: this.resolutions,
    })
  }

  onMessage(ws, message) {
    void this.dispatch(ws, message).catch((error) => this.send(ws, errorPayload(error, message?.id)))
  }

  async dispatch(ws, message) {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      throw new TypeError('Message type is required')
    }
    let result
    switch (message.type) {
      case 'ping':
        result = { now: Date.now() }
        break
      case 'history':
        {
        const sessionId = await this.getUserSessionId(this.userIds.get(ws))
        result = await this.marketData.history(normalizeSymbol(message.symbol), {
          interval: normalizeResolution(message.resolution, this.resolutions),
          bars: normalizeBars(message.bars, this.maxBars),
          ...(message.to == null ? {} : { to: message.to }),
          ...(sessionId ? { sessionId } : {}),
        })
        }
        break
      case 'subscribe':
        result = this.subscribe(ws, message, await this.getUserSessionId(this.userIds.get(ws)))
        break
      case 'quote_subscribe':
        result = this.subscribeQuote(ws, message, await this.getUserSessionId(this.userIds.get(ws)))
        break
      case 'unsubscribe':
        result = this.unsubscribe(ws, String(message.subscriptionId || ''))
        break
      default:
        throw new TypeError(`Unsupported message type: ${message.type}`)
    }
    this.send(ws, { type: 'response', id: message.id, request: message.type, data: result })
  }

  subscribe(ws, message, sessionId = null) {
    const symbol = normalizeSymbol(message.symbol)
    const resolution = normalizeResolution(message.resolution, this.resolutions)
    const expectedId = `${symbol}#${resolution}`
    const subscriptionId = String(message.subscriptionId || expectedId)
    if (subscriptionId !== expectedId) throw new TypeError(`subscriptionId must be ${expectedId}`)
    const subscriptions = this.subscriptions.get(ws)
    if (!subscriptions) throw new Error('Connection is not initialized')
    this.unsubscribe(ws, subscriptionId)
    const subscription = {
      symbol, resolution, timer: null, quoteStop: null, running: false, current: null, fingerprint: null, closedTime: null,
    }
    subscriptions.set(subscriptionId, subscription)

    const poll = async () => {
      if (subscription.running || !subscriptions.has(subscriptionId)) return
      subscription.running = true
      try {
        const history = await this.marketData.history(symbol, {
          interval: resolution,
          bars: 2,
          ...(sessionId ? { sessionId } : {}),
        })
        const current = history.bars.at(-1)
        const fingerprint = current
          ? `${current.time}:${current.open}:${current.high}:${current.low}:${current.close}:${current.volume}`
          : null
        if (current && subscription.current && current.time > subscription.current.time) {
          const closed = history.bars.find((bar) => bar.time === subscription.current.time) || subscription.current
          if (closed.time !== subscription.closedTime) {
            subscription.closedTime = closed.time
            this.send(ws, { type: 'bar', subscriptionId, symbol, resolution, bar: closed })
          }
        }
        if (current && fingerprint !== subscription.fingerprint) {
          subscription.current = current
          subscription.fingerprint = fingerprint
          this.send(ws, { type: 'update', subscriptionId, symbol, resolution, bar: current })
        }
      } catch (error) {
        this.send(ws, { ...errorPayload(error), subscriptionId })
      } finally {
        subscription.running = false
      }
    }
    void poll()
    subscription.timer = setInterval(poll, this.pollMs)
    if (typeof this.marketData.subscribeQuotes === 'function') {
      subscription.quoteStop = this.marketData.subscribeQuotes([symbol], {
        ...(sessionId ? { sessionId } : {}),
        onQuote: (quote) => {
          if (!subscriptions.has(subscriptionId)) return
          this.send(ws, { type: 'quote', subscriptionId, symbol, resolution, quote })
        },
      })
    }
    return { subscriptionId, symbol, resolution }
  }

  subscribeQuote(ws, message, sessionId = null) {
    const symbol = normalizeSymbol(message.symbol)
    const expectedId = `${symbol}#QUOTE`
    const subscriptionId = String(message.subscriptionId || expectedId)
    if (subscriptionId !== expectedId) throw new TypeError(`subscriptionId must be ${expectedId}`)
    const subscriptions = this.subscriptions.get(ws)
    if (!subscriptions) throw new Error('Connection is not initialized')
    this.unsubscribe(ws, subscriptionId)
    const subscription = {
      symbol,
      resolution: null,
      timer: null,
      quoteStop: null,
      running: false,
      current: null,
      fingerprint: null,
      closedTime: null,
    }
    subscriptions.set(subscriptionId, subscription)
    subscription.quoteStop = this.marketData.subscribeQuotes([symbol], {
      ...(sessionId ? { sessionId } : {}),
      onQuote: (quote) => {
        if (!subscriptions.has(subscriptionId)) return
        this.send(ws, { type: 'quote', subscriptionId, symbol, quote })
      },
    })
    return { subscriptionId, symbol }
  }

  unsubscribe(ws, subscriptionId) {
    const subscriptions = this.subscriptions.get(ws)
    const subscription = subscriptions?.get(subscriptionId)
    if (!subscription) return { subscriptionId, removed: false }
    clearInterval(subscription.timer)
    subscription.quoteStop?.()
    subscriptions.delete(subscriptionId)
    return { subscriptionId, removed: true }
  }

  handleClose(ws, clientInfo, serverInfo) {
    for (const subscription of this.subscriptions.get(ws)?.values() || []) {
      clearInterval(subscription.timer)
      subscription.quoteStop?.()
    }
    this.subscriptions.delete(ws)
    this.userIds.delete(ws)
    super.handleClose(ws, clientInfo, serverInfo)
  }

  close() {
    for (const ws of this.subscriptions.keys()) this.handleClose(ws, { id: 'shutdown' }, null)
    super.close()
  }
}
