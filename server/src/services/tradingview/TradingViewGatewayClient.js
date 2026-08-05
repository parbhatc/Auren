import WebSocket from 'ws'

const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:8532/api/tradingview/stream'

function gatewayUrl(baseURL, sessionId) {
  const url = new URL(baseURL || process.env.TRADINGVIEW_GATEWAY_WS_URL || DEFAULT_GATEWAY_URL)
  if (sessionId) url.searchParams.set('session_id', sessionId)
  return url.toString()
}

export default class TradingViewGatewayClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL
    this.timeoutMs = options.timeoutMs || 20_000
    this.WebSocket = options.WebSocket || WebSocket
  }

  request(type, payload = {}, sessionId = '') {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const socket = new this.WebSocket(gatewayUrl(this.baseURL, sessionId))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error(`TradingView gateway ${type} request timed out`)), this.timeoutMs)
      let settled = false
      const finish = (error, result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        socket.close()
        error ? reject(error) : resolve(result)
      }
      socket.once('open', () => socket.send(JSON.stringify({ id, type, ...payload })))
      socket.on('message', (raw) => {
        let message
        try { message = JSON.parse(raw.toString()) } catch { return }
        if (message.id !== id) return
        if (message.type === 'error') {
          const error = new Error(message.error?.message || 'TradingView gateway request failed')
          error.code = message.error?.code
          finish(error)
        } else if (message.type === 'response') {
          finish(null, message.data)
        }
      })
      socket.once('error', finish)
      socket.once('close', () => {
        if (!settled) finish(new Error(`TradingView gateway closed before answering ${type}`))
      })
    })
  }

  history(symbol, options, sessionId) {
    return this.request('history', {
      symbol,
      resolution: options.interval,
      bars: options.bars,
      ...(options.to == null ? {} : { to: options.to }),
    }, sessionId)
  }

  quotes(symbols, sessionId) {
    return this.request('quotes', { symbols }, sessionId)
  }
}
