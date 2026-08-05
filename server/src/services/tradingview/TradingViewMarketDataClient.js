import path from 'path'
import { fileURLToPath } from 'url'
import MarketDataService from './MarketDataService.js'
import TradingViewGatewayClient from './TradingViewGatewayClient.js'
import { readTradingViewSessionId } from './TradingViewSessionConfig.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '../../../data/config.json')

function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
}

function normalizeSearchResult(item) {
  const continuous = item.type === 'futures'
    ? item.contracts?.find((contract) => contract.typespecs?.includes('continuous'))
    : null
  const root = cleanText(item.symbol)
  const symbol = cleanText(continuous?.symbol || item.symbol)
  const prefix = cleanText(continuous?.prefix || item.source_id || item.exchange)
  const ticker = prefix ? `${prefix}:${symbol}` : symbol
  return {
    symbol: root,
    ticker,
    name: ticker,
    full_name: ticker,
    description: cleanText(item.description),
    exchange: cleanText(item.exchange),
    type: cleanText(item.type),
    currency_code: cleanText(item.currency_code)
  }
}

function normalizeQuote(data) {
  const values = data?.v || {}
  const number = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const bid = number(values.bid)
  const ask = number(values.ask)
  let last = number(values.lp)
  if (last != null && bid != null && ask != null) {
    const midpoint = (bid + ask) / 2
    const tolerance = Math.max(1, Math.abs(midpoint) * 0.002)
    if (Math.abs(last - midpoint) > tolerance) last = null
  }
  return {
    symbol: String(data?.n || ''),
    last,
    bid,
    ask,
    bidSize: number(values.bid_size),
    askSize: number(values.ask_size),
    time: number(values.lp_time),
  }
}

function isTradingViewRateLimit(error) {
  return Number(error?.statusCode) === 429 || /(?:^|\D)429(?:\D|$)|too many requests/i.test(String(error?.message || ''))
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default class TradingViewMarketDataClient {
  constructor(options = {}) {
    this.configPath = options.configPath || DEFAULT_CONFIG_PATH
    this.sessionIdEnv = options.sessionIdEnv || 'TRADINGVIEW_SESSION_ID'
    this.gatewayURL = options.gatewayURL || process.env.TRADINGVIEW_GATEWAY_WS_URL
    this.timeoutMs = Math.max(5_000, Number(options.timeoutMs || process.env.TRADINGVIEW_REQUEST_TIMEOUT_MS) || 20_000)
    this.maxBars = Math.max(500, Number(options.maxBars || process.env.TRADINGVIEW_MAX_BARS) || 5_000)
    this.historyConcurrency = Math.max(1, Number(options.historyConcurrency || process.env.TRADINGVIEW_HISTORY_CONCURRENCY) || 2)
    this.historyRetries = Math.max(0, Number(options.historyRetries || process.env.TRADINGVIEW_HISTORY_RETRIES) || 3)
    this.historyRetryBaseMs = Math.max(100, Number(options.historyRetryBaseMs || process.env.TRADINGVIEW_HISTORY_RETRY_BASE_MS) || 750)
    this.marketData = options.marketData || new MarketDataService()
    this.gateway = options.gateway || new TradingViewGatewayClient({
      baseURL: this.gatewayURL,
      timeoutMs: this.timeoutMs,
    })
    this.historyQueue = []
    this.activeHistoryRequests = 0
    this.inflightHistory = new Map()
  }

  get sessionId() {
    return readTradingViewSessionId({ sessionIdEnv: this.sessionIdEnv, configPath: this.configPath })
  }

  get authenticationMode() {
    return this.sessionId ? 'session' : 'unconfigured'
  }

  async search(query, options = {}) {
    const response = await this.marketData.search(
      query,
      'en',
      options.exchange || '',
      options.type || 'undefined'
    )
    const rows = Array.isArray(response) ? response : response?.symbols || []
    return rows.slice(0, Math.min(50, Number(options.limit) || 30)).map(normalizeSearchResult)
  }

  history(symbol, options = {}) {
    const key = JSON.stringify([
      String(symbol || '').toUpperCase(),
      String(options.interval || '1').toUpperCase(),
      Number(options.bars) || 500,
      options.to == null ? null : Math.floor(Number(options.to)),
      String(options.sessionId || '').trim(),
    ])
    const existing = this.inflightHistory.get(key)
    if (existing) return existing

    const request = this.#enqueueHistory(() => this.#historyWithRetry(symbol, options))
    this.inflightHistory.set(key, request)
    void request.finally(() => {
      if (this.inflightHistory.get(key) === request) this.inflightHistory.delete(key)
    }).catch(() => undefined)
    return request
  }

  #enqueueHistory(run) {
    return new Promise((resolve, reject) => {
      this.historyQueue.push({ run, resolve, reject })
      this.#drainHistoryQueue()
    })
  }

  #drainHistoryQueue() {
    while (this.activeHistoryRequests < this.historyConcurrency && this.historyQueue.length) {
      const task = this.historyQueue.shift()
      this.activeHistoryRequests += 1
      void task.run().then(task.resolve, task.reject).finally(() => {
        this.activeHistoryRequests -= 1
        this.#drainHistoryQueue()
      })
    }
  }

  async #historyWithRetry(symbol, options) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.#historyOnce(symbol, options)
      } catch (error) {
        if (!isTradingViewRateLimit(error) || attempt >= this.historyRetries) throw error
        const backoff = this.historyRetryBaseMs * (2 ** attempt)
        const jitter = Math.floor(Math.random() * Math.min(250, backoff / 4))
        await wait(backoff + jitter)
      }
    }
  }

  async #historyOnce(symbol, options = {}) {
    const interval = String(options.interval || '1').toUpperCase()
    const requestedBars = Math.min(this.maxBars, Math.max(1, Number(options.bars) || 500))
    const end = options.to == null ? null : Math.floor(Number(options.to))
    return this.gateway.history(symbol, {
      interval,
      bars: requestedBars,
      ...(end == null ? {} : { to: end }),
    }, String(options.sessionId || '').trim() || this.sessionId)
  }

  subscribeQuotes(symbols, options = {}) {
    const requested = [...new Set((Array.isArray(symbols) ? symbols : [symbols])
      .map((symbol) => String(symbol || '').trim().toUpperCase())
      .filter(Boolean))]
    if (!requested.length) return () => undefined
    let stopped = false
    const sessionId = String(options.sessionId || '').trim() || this.sessionId
    const poll = async () => {
      try {
        const rows = await this.gateway.quotes(requested, sessionId)
        if (!stopped) options.onStatus?.({ state: 'connected' })
        for (const data of rows || []) {
          const quote = normalizeQuote({ n: data.symbol, v: data })
          if (!stopped && quote.symbol) options.onQuote?.(quote)
        }
      } catch (error) {
        if (!stopped) options.onStatus?.({ state: 'disconnected', error: error?.message || String(error) })
      }
    }
    void poll()
    const timer = setInterval(poll, Math.max(1_000, Number(options.pollMs) || 2_000))
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }
}

export { normalizeQuote, normalizeSearchResult }
