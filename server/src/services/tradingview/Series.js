/**
 * TradingView Series Class
 * Represents a single chart series with its own symbol, interval, and callbacks
 */
import Replay from './Replay.js'

class Series {
  /**
   * @param {Object} socket - Reference to the parent TradingViewWebSocket instance
   * @param {string} seriesId - Unique series ID (e.g., 'sds_1')
   * @param {string} symbolRequestId - Symbol request ID (e.g., 'sds_sym_1')
   * @param {string} subSeriesId - Sub-series ID (e.g., 's1')
   * @param {string} adjustment - Adjustment (e.g., 'splits')
   * @param {string} currencyId - Currency ID (e.g., 'USD')
   * @param {string} session - Session (e.g., 'regular')
   */
  constructor(socket, seriesId, symbolRequestId, subSeriesId, adjustment, currencyId, session, metric) {
    this.socket = socket
    this.seriesId = seriesId
    this.symbolRequestId = symbolRequestId
    this.subSeriesId = subSeriesId
    this.adjustment = adjustment
    this.currencyId = currencyId
    this.session = session
    this.metric = metric
    // Series configuration (will be set by resolve method)
    this.interval = '1'
    this.bars = 300
    this.additionalParams = ''
    this.symbol = null
    
    // Callbacks
    this.onSymbolResolved = null
    this.onSeriesLoading = null
    this.onSeriesCompleted = null
    this.onTimescaleUpdate = null
    this.onSeriesError = null
    this.onSymbolError = null
    
    // Replay instance (stored separately to avoid conflict with replay() method)
    this._replayInstance = null
  }

  getConfig(symbol, replay = null, metric = true){
    let config = {
      adjustment: this.adjustment,
      'currency-id': this.currencyId,
      session: this.session,
      symbol: symbol
    }
    if(metric){
      config.metric = this.metric
    }
    if(replay){
      return {replay: replay, symbol: config}
    }
    return config
  }

  /**
   * Resolve symbol and create the series in one call
   * @param {string|Object} symbol - Symbol string (e.g., 'CME_MINI:NQ1!') or config object
   * @param {string} [interval='1'] - Interval/timeframe (default: '1')
   * @param {number} [bars=300] - Number of bars to request (default: 300)
   * @returns {boolean} - True if messages were sent successfully, false otherwise
   */
  resolve(symbol, interval = '1', bars = 300) {
    this.interval = String(interval)
    this.bars = bars
    this.symbol = symbol

    if (!this.socket.chartSessionId) {
      console.warn('[Series] Cannot resolve symbol: chartSessionId not set')
      return false
    }
    let resolveSent = this.socket.sendResolveSymbol(this.symbolRequestId, this.getConfig(symbol))
    let createSent = this.socket.sendCreateSeries(this.seriesId, this.subSeriesId, this.symbolRequestId, this.interval, this.bars)
    return resolveSent && createSent
  }

  /**
   * Change the timeframe/interval of the series
   * Automatically increments subSeriesId (s1 -> s2, s2 -> s3, etc.)
   * @param {string} interval - New interval/timeframe (e.g., '15', '60', '240' for minutes, '1D' for daily)
   * @param {string} [additionalParams=''] - Additional parameters (default: '')
   * @returns {boolean} - True if message was sent successfully, false otherwise
   */
  changeTimeframe(interval) {
    if (!this.socket.chartSessionId) {
      console.warn('[Series] Cannot change timeframe: chartSessionId not set')
      return false
    }
    this.interval = String(interval)
    // Auto-increment subSeriesId (s1 -> s2, s2 -> s3, etc.)
    let newSubSeriesId = this.incrementSubSeriesId()
    let modifySent = this.socket.sendModifySeries(this.seriesId, newSubSeriesId, this.symbolRequestId, this.interval)
    return modifySent
  }

  requestMoreData(bars = 500) {
    return this.socket.sendRequestMoreData(this.seriesId, bars)
  }

  /**
   * Change the symbol of the series
   * Calls resolve_symbol with a new symbolRequestId (incremented)
   * @param {string|Object} symbol - New symbol string (e.g., 'CME_MINI:NQ1!') or config object
   * @param {string} [replaySessionId=null] - Replay session ID (default: null)
   * @returns {boolean} - True if messages were sent successfully, false otherwise
   */
  changeSymbol(symbol, replaySessionId = null) {
    if (!this.socket.chartSessionId) {
      console.warn('[Series] Cannot change symbol: chartSessionId not set')
      return false
    }

    // Increment symbolRequestId to avoid duplicate ID error
    this.socket.incrementSymbolRequestId()
    this.symbol = symbol
    this.symbolRequestId = this.socket.symbolRequestId


    let newSubSeriesId = this.incrementSubSeriesId()
    let resolveSent = this.socket.sendResolveSymbol(this.symbolRequestId, this.getConfig(symbol, replaySessionId))
    let modifySent = this.socket.sendModifySeries(this.seriesId, newSubSeriesId, this.symbolRequestId, this.interval)
    return resolveSent && modifySent
  }

  /**
   * Create and return a Replay instance for this series
   * Also sends replay_create_session message
   * @returns {Replay} - Replay instance
   */
  replay() {
    if (!this._replayInstance) {
      this._replayInstance = new Replay(this.socket, this)
      this._replayInstance.createSession()
    }
    return this._replayInstance
  }

  incrementSubSeriesId() {
    // Extract number from current subSeriesId (e.g., 's1' -> 1, 's2' -> 2)
    const match = this.subSeriesId.match(/^s(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      this.subSeriesId = `s${num + 1}`
    } else {
      // Fallback: if format is unexpected, default to s2
      this.subSeriesId = 's2'
    }
    return this.subSeriesId
  }
}

export default Series
