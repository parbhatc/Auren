/**
 * TradingView Replay Class
 * Handles replay session for a series
 */
import { generateRandomString } from './utils.js'

class Replay {
  /**
   * @param {Object} socket - Reference to the parent TradingViewWebSocket instance
   * @param {Object} series - Reference to the parent Series instance
   */
  constructor(socket, series) {
    this.socket = socket
    this.series = series
    this.replaySessionId = null
    this.replayInstanceId = null
    this.onReplayInstanceId = null
    this.onReplayReset = null
    this.onReplayOk = null
    this.onReplayPoint = null
    this.onReplayError = null
    this.onReplayDepth = null
    this.onReplayResolutions = null
    
    // Generate random messageId with '0' as the last character
    // Generate random length between 10-15 characters, then append '0'
    const length = Math.floor(Math.random() * 6) + 10 // 10-15 characters
    const randomPart = generateRandomString(length)
    this.messageId = `${randomPart}0`
  }

  /**
   * Increment message ID (e.g., 8xdatyyeWvuX0 -> 8xdatyyeWvuX1, 8xdatyyeWvuX1 -> 8xdatyyeWvuX2)
   * @returns {string} - The new message ID
   */
  incrementMessageId() {
    // Extract the numeric suffix from the messageId
    const match = this.messageId.match(/^(.+?)(\d+)$/)
    if (match) {
      const prefix = match[1]
      const num = parseInt(match[2], 10)
      this.messageId = `${prefix}${num + 1}`
    } else {
      // Fallback: if format is unexpected, append _1
      this.messageId = `${this.messageId}_1`
    }
    return this.messageId
  }

  /**
   * Create a replay session
   * Sends replay_create_session message and stores the session ID
   * Called automatically when Replay instance is created via series.replay()
   * @returns {boolean} - True if message was sent successfully, false otherwise
   */
  createSession() {
    if (!this.socket.chartSessionId) {
      console.warn('[Replay] Cannot create replay session: chartSessionId not set')
      return false
    }
    let randomId = generateRandomString(13)
    this.replaySessionId = `rs_${randomId}`

    return this.socket.sendReplayCreateSession(this.replaySessionId)
  }

  start(timestamp = null, symbol = null, timeframe = null) {
    if(timestamp === null) {
      console.warn('[Replay] Cannot start: timestamp not set')
      return false
    }
    if(symbol === null){
      symbol = this.series.symbol
    }
    if(timeframe === null){
      timeframe = this.series.interval
    }
    if(symbol === null) {
      console.warn('[Replay] Cannot start: symbol not set')
      return false
    }
    if(timeframe === null) {
      console.warn('[Replay] Cannot start: timeframe not set')
      return false
    }
    
    if (!this.socket.chartSessionId) {
      console.warn('[Replay] Cannot start: chartSessionId not set')
      return false
    }

    // Increment symbolRequestId for this resolve_symbol call
    // Send resolve_symbol message with replay config using the socket's helper method
    this.reset(timestamp)
    this.addSeries(symbol, timeframe)
    this.series.changeSymbol(symbol, this.replaySessionId)
  }

  /**
   * Send replay_reset message
   * @param {number} [timestamp] - Unix timestamp (defaults to current time)
   * @returns {boolean} - True if message was sent successfully, false otherwise
   */
  reset(timestamp = null) {
    if (!this.replaySessionId) {
      console.warn('[Replay] Cannot reset: replaySessionId not set')
      return false
    }

    if (!this.socket.chartSessionId) {
      console.warn('[Replay] Cannot reset: chartSessionId not set')
      return false
    }
    if(timestamp === null) {
      console.warn('[Replay] Cannot reset: timestamp not set')
      return false
    }

    let resetSent = this.socket.sendReplayReset(this.replaySessionId, this.messageId, timestamp)
    this.incrementMessageId()
    return resetSent
  }

  /**
   * Send replay_get_depth message
   * @param {string|Object} symbol - Symbol string (e.g., 'CME_MINI_DL:NQ1!') or config object
   * @param {string} interval - Interval/timeframe (e.g., '15')
   * @returns {boolean} - True if message was sent successfully, false otherwise
   */
  getDepth(symbol, interval) {
    if (!this.replaySessionId) {
      console.warn('[Replay] Cannot get depth: replaySessionId not set')
      return false
    }

    if (!this.socket.chartSessionId) {
      console.warn('[Replay] Cannot get depth: chartSessionId not set')
      return false
    }

    if (!symbol) {
      console.warn('[Replay] getDepth requires a symbol')
      return false
    }

    if (!interval) {
      console.warn('[Replay] getDepth requires an interval')
      return false
    }
    let getDepthSent = this.socket.sendReplayGetDepth(this.replaySessionId, this.messageId, this.series.getConfig(symbol, null, false), String(interval))
    this.incrementMessageId()
    return getDepthSent
  }

  /**
   * Send set_broker message
   * @param {string} [broker='replaybroker'] - Broker name (defaults to 'replaybroker')
   * @returns {boolean} - True if message was sent successfully, false otherwise
   */
  setBroker(broker = 'replaybroker') {
    if (!this.socket.chartSessionId) {
      console.warn('[Replay] Cannot set broker: chartSessionId not set')
      return false
    }

    return this.socket.sendSetBroker(broker)
  }

  /**
   * Send replay_add_series message
   * @param {string|Object} symbol - Symbol string (e.g., 'CME_MINI_DL:NQ1!') or config object
   * @param {string} interval - Interval/timeframe (e.g., '15')
   * @returns {boolean} - True if message was sent successfully, false otherwise
   */
  addSeries(symbol, interval) {
    if (!this.replaySessionId) {
      console.warn('[Replay] Cannot add series: replaySessionId not set')
      return false
    }

    if (!this.socket.chartSessionId) {
      console.warn('[Replay] Cannot add series: chartSessionId not set')
      return false
    }

    if (!symbol) {
      console.warn('[Replay] addSeries requires a symbol')
      return false
    }

    if (!interval) {
      console.warn('[Replay] addSeries requires an interval')
      return false
    }

    let addSeriesSent = this.socket.sendReplayAddSeries(this.replaySessionId, this.messageId, this.series.getConfig(symbol, null, false), interval)
    this.incrementMessageId()
    return addSeriesSent
  }
}

export default Replay
