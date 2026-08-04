import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import MarketDataService from './MarketDataService.js'
import TradingViewWebSocket from './TradingViewWebSocket.js'

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

function normalizeBar(row) {
  const values = row?.v
  if (!Array.isArray(values) || values.length < 5) return null
  const [time, open, high, low, close, volume = 0] = values.map(Number)
  if (![time, open, high, low, close].every(Number.isFinite)) return null
  return { time, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 }
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
  return {
    symbol: String(data?.n || ''),
    last: number(values.lp),
    bid: number(values.bid),
    ask: number(values.ask),
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
    this.tokenEnv = options.tokenEnv || 'TRADINGVIEW_AUTH_TOKEN'
    this.baseURL = options.baseURL
    this.timeoutMs = Math.max(5_000, Number(options.timeoutMs || process.env.TRADINGVIEW_REQUEST_TIMEOUT_MS) || 20_000)
    this.maxBars = Math.max(500, Number(options.maxBars || process.env.TRADINGVIEW_MAX_BARS) || 5_000)
    this.historyConcurrency = Math.max(1, Number(options.historyConcurrency || process.env.TRADINGVIEW_HISTORY_CONCURRENCY) || 2)
    this.historyRetries = Math.max(0, Number(options.historyRetries || process.env.TRADINGVIEW_HISTORY_RETRIES) || 3)
    this.historyRetryBaseMs = Math.max(100, Number(options.historyRetryBaseMs || process.env.TRADINGVIEW_HISTORY_RETRY_BASE_MS) || 750)
    this.marketData = options.marketData || new MarketDataService()
    this.socketFactory = options.socketFactory || ((token) => new TradingViewWebSocket({
      token,
      ...(this.baseURL ? { baseURL: this.baseURL } : {}),
    }))
    this.historyQueue = []
    this.activeHistoryRequests = 0
    this.inflightHistory = new Map()
  }

  get token() {
    const envToken = String(process.env[this.tokenEnv] || '').trim()
    if (envToken) return envToken
    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
      return String(config?.tokens?.tradingview || '').trim()
    } catch {
      return ''
    }
  }

  get authenticationMode() {
    return this.token ? 'token' : 'anonymous'
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
      String(options.authToken || '').trim(),
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

  #historyOnce(symbol, options = {}) {
    const interval = String(options.interval || '1').toUpperCase()
    const requestedBars = Math.min(this.maxBars, Math.max(1, Number(options.bars) || 500))
    const end = options.to == null ? null : Math.floor(Number(options.to))
    return new Promise((resolve, reject) => {
      const socket = this.socketFactory(String(options.authToken || '').trim() || this.token || null)
      const barsByTime = new Map()
      let series
      let previousSize = -1
      let settled = false

      const finish = (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        socket.disconnect()
        if (error) return reject(error)
        const eligible = [...barsByTime.values()]
          .sort((left, right) => left.time - right.time)
          .filter((bar) => end == null || bar.time <= end)
          .slice(-requestedBars)
        resolve({
          symbol,
          interval,
          timezone: 'Etc/UTC',
          status: 'ok',
          bars: eligible,
          to: end,
          historyExhausted: eligible.length < requestedBars && barsByTime.size < this.maxBars
        })
      }

      const timer = setTimeout(() => finish(new Error('TradingView history request timed out')), this.timeoutMs)
      socket.connect({
        onSessionInit: () => {
          series = socket.createSeries('regular')
          series.onTimescaleUpdate = (data) => {
            for (const row of data.series_data?.s || []) {
              const bar = normalizeBar(row)
              if (bar) barsByTime.set(bar.time, bar)
            }
          }
          series.onSymbolError = (error) => finish(new Error(error?.error_message || 'TradingView rejected the symbol'))
          series.onSeriesError = (error) => finish(new Error(error?.error_message || error?.error_code || 'TradingView rejected the series'))
          series.onSeriesCompleted = () => {
            const eligibleCount = end == null
              ? barsByTime.size
              : [...barsByTime.keys()].filter((time) => time <= end).length
            if (eligibleCount >= requestedBars || barsByTime.size >= this.maxBars || barsByTime.size === previousSize) {
              finish()
              return
            }
            previousSize = barsByTime.size
            series.requestMoreData(Math.min(500, this.maxBars - barsByTime.size))
          }
          series.resolve(symbol, interval, Math.min(500, requestedBars))
        },
        onError: (error) => finish(error instanceof Error ? error : new Error(String(error))),
        onDisconnected: () => {
          if (!settled && barsByTime.size) finish()
        }
      }).catch(finish)
    })
  }

  subscribeQuotes(symbols, options = {}) {
    const requested = [...new Set((Array.isArray(symbols) ? symbols : [symbols])
      .map((symbol) => String(symbol || '').trim().toUpperCase())
      .filter(Boolean))]
    if (!requested.length) return () => undefined
    const socket = this.socketFactory(String(options.authToken || '').trim() || this.token || null)
    const quoteSession = `qs_${Math.random().toString(36).slice(2, 14)}`
    let stopped = false
    const start = () => {
      socket.send({ m: 'quote_create_session', p: [quoteSession] })
      socket.send({
        m: 'quote_set_fields',
        p: [quoteSession, 'lp', 'lp_time', 'bid', 'ask', 'bid_size', 'ask_size', 'pricescale', 'minmov'],
      })
      socket.send({ m: 'quote_add_symbols', p: [quoteSession, ...requested] })
    }
    void socket.connect({
      onSessionInit: start,
      onMessage: (message) => {
        if (stopped || message?.m !== 'qsd' || message?.p?.[0] !== quoteSession) return
        const quote = normalizeQuote(message.p[1])
        if (quote.symbol) options.onQuote?.(quote)
      },
      onConnected: () => options.onStatus?.({ state: 'connecting' }),
      onDisconnected: () => {
        if (!stopped) options.onStatus?.({ state: 'disconnected' })
      },
      onError: (error) => {
        if (!stopped) options.onStatus?.({ state: 'disconnected', error: error?.message || String(error) })
      },
    }).then(() => {
      if (!stopped) options.onStatus?.({ state: 'connected' })
    }).catch((error) => {
      if (!stopped) options.onStatus?.({ state: 'disconnected', error: error?.message || String(error) })
    })
    return () => {
      stopped = true
      socket.disconnect()
    }
  }
}

export { normalizeQuote, normalizeSearchResult }
