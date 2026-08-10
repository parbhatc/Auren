import { TradingviewAPI } from 'tradingviewapi'
import { readTradingViewSessionId } from './TradingViewSessionConfig.js'

export default class TradingViewDirectClient {
  constructor(options = {}) {
    this.configPath = options.configPath
    this.sessionIdEnv = options.sessionIdEnv || 'TRADINGVIEW_SESSION_ID'
    this.apiFactory = options.apiFactory
    this.api = null
    this.authenticatedSessionId = ''
    this.authenticationPromise = null
  }

  get sessionId() {
    return readTradingViewSessionId({
      sessionIdEnv: this.sessionIdEnv,
      configPath: this.configPath,
    })
  }

  async createApi() {
    if (this.apiFactory) return this.apiFactory()
    return new TradingviewAPI({ save_session: false })
  }

  async authenticatedApi(sessionId = this.sessionId) {
    const normalizedSessionId = String(sessionId || '').trim()
    if (!normalizedSessionId) {
      throw new Error('TradingView session ID is required. Save it in CSV data settings and try again.')
    }
    if (this.api && this.authenticatedSessionId === normalizedSessionId) return this.api
    if (this.authenticationPromise?.sessionId === normalizedSessionId) {
      return this.authenticationPromise.promise
    }

    const promise = (async () => {
      const api = await this.createApi()
      await api.loginBySessionId(normalizedSessionId)
      this.api?.close?.()
      this.api = api
      this.authenticatedSessionId = normalizedSessionId
      return api
    })()
    this.authenticationPromise = { sessionId: normalizedSessionId, promise }

    try {
      return await promise
    } finally {
      if (this.authenticationPromise?.promise === promise) this.authenticationPromise = null
    }
  }

  async history(symbol, options = {}) {
    const api = await this.authenticatedApi(options.sessionId)
    return api.history(symbol, {
      interval: String(options.interval || '1').toUpperCase(),
      bars: Math.max(1, Number(options.bars) || 500),
      ...(options.to == null ? {} : { to: Math.floor(Number(options.to)) }),
    })
  }

  async loadAllBars(symbol, options = {}) {
    const api = await this.authenticatedApi(options.sessionId)
    return api.loadAllBars(symbol, {
      interval: String(options.interval || '1').toUpperCase(),
      chunkSize: Math.max(1, Math.floor(Number(options.chunkSize) || 25_000)),
      session: options.session || 'extended',
      ...(options.after == null ? {} : { after: Math.floor(Number(options.after)) }),
      ...(typeof options.onProgress === 'function' ? { onProgress: options.onProgress } : {}),
    })
  }

  close() {
    this.api?.close?.()
    this.api = null
    this.authenticatedSessionId = ''
  }
}
