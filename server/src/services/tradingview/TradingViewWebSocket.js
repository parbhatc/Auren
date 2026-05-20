/**
 * TradingView WebSocket Service
 * Handles WebSocket connections to TradingView's prodata server
 * Uses TradingView's custom message format: ~m~{length}~m~{json}
 */
import WebSocket from 'ws'
import Series from './Series.js'
import { generateRandomString } from './utils.js'

class TradingViewWebSocket {
  /**
   * @param {Object} [options] - Configuration options
   * @param {string} [options.baseURL='wss://prodata.tradingview.com'] - Base WebSocket URL
   * @param {string} [options.token] - Authentication token (if null/undefined, uses 'unauthorized_user_token')
   * @param {string} [options.locale='en'] - Language locale (e.g., 'en', 'es', 'fr')
   * @param {string} [options.country='US'] - Country code (e.g., 'US', 'GB', 'CA')
   * @param {string} [options.timezone='America/New_York'] - Timezone (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo')
   * @param {Object} [options.headers] - Custom headers for WebSocket connection
   * @param {string} [options.symbolRequestId='sds_sym_1'] - Default symbol request ID (used by resolveSymbol, createSeries, modifySeries)
   */
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'wss://prodata.tradingview.com'
    this.token = options.token
    this.locale = options.locale || 'en'
    this.country = options.country || 'US'
    this.timezone = options.timezone || 'America/New_York'
    this.headers = options.headers || {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'Origin': 'https://www.tradingview.com',
      'Referer': 'https://www.tradingview.com/',
    }
    
    this.ws = null
    this.isConnected = false
    this.isIntentionallyClosed = false
    this.sessionId = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000
    this.reconnectTimer = null
    this.messageId = 0
    this.callbacks = {}
    this.chartSessionId = null
    this.symbolRequestId = 'sds_sym_0'
    this.seriesId = 'sds_0'
    this.subSeriesId = 's1'
    this.series = [] // Store all series instances
  }

  /**
   * Parse TradingView WebSocket message format
   * Format: ~m~{length}~m~{json_payload} or ~m~{length}~m~~h~{number} for heartbeat
   * @param {Buffer|string} message - Raw message from WebSocket
   * @returns {Object|null} - Parsed JSON object, heartbeat object, or null if invalid
   */
  parseMessage(message) {
    try {
      const messageStr = message.toString()
      
      // Check for heartbeat messages: ~m~{length}~m~~h~{number}
      const heartbeatMatch = messageStr.match(/^~m~(\d+)~m~~h~(\d+)$/)
      if (heartbeatMatch) {
        return { type: 'heartbeat', number: parseInt(heartbeatMatch[2], 10) }
      }
      
      // TradingView format: ~m~{length}~m~{json}
      const match = messageStr.match(/^~m~(\d+)~m~(.+)$/s) // 's' flag allows . to match newlines
      
      if (match) {
        const length = parseInt(match[1], 10)
        const payload = match[2]
        
        // Check if payload length matches expected length (handle truncated messages)
        if (payload.length < length) {
          // Message is truncated, can't parse
          return null
        }
        
        // Extract only the expected length of payload (in case multiple messages are concatenated)
        const expectedPayload = payload.substring(0, length)
        
        // Parse JSON payload
        try {
          const parsed = JSON.parse(expectedPayload)
          return parsed
        } catch (parseError) {
          // If parsing fails with exact length, try parsing the full payload
          // (might be a case where length calculation differs)
          try {
            const parsed = JSON.parse(payload)
            return parsed
          } catch (fullParseError) {
            // If both fail, return null silently (might be malformed)
            return null
          }
        }
      } else {
        // Try to parse as plain JSON (might be non-standard message)
        try {
          return JSON.parse(messageStr)
        } catch (parseError) {
          return null
        }
      }
    } catch (error) {
      // Silently return null for any parsing errors
      return null
    }
  }

  /**
   * Format TradingView message for sending
   * Format: ~m~{length}~m~{json_payload}
   * @param {Object|string} data - Object to send (will be JSON stringified) or already stringified JSON
   * @returns {string} - Formatted message string
   */
  formatMessage(data) {
    const json = typeof data === 'string' ? data : JSON.stringify(data)
    return `~m~${Buffer.byteLength(json, 'utf8')}~m~${json}`
  }

  /**
   * Build WebSocket connection URL
   * @returns {string} - Full WebSocket URL with query parameters
   */
  buildWebSocketUrl() {
    const date = new Date().toISOString()
    const params = new URLSearchParams({
      date: date,
      type: 'chart'
    })
    return `${this.baseURL}/socket.io/websocket?${params.toString()}`
  }

  /**
   * Split concatenated TradingView messages
   * Messages can be concatenated like: ~m~95~m~{...}~m~7208~m~{...}
   * @param {string} messageStr - Raw message string
   * @returns {Array<string>} - Array of individual message strings
   * @private
   */
  splitMessages(messageStr) {
    const messages = []
    let currentIndex = 0
    
    while (currentIndex < messageStr.length) {
      // Look for message start: ~m~
      const startMatch = messageStr.substring(currentIndex).match(/^~m~(\d+)~m~/)
      if (!startMatch) {
        break // No more messages
      }
      
      const length = parseInt(startMatch[1], 10)
      const messageStart = currentIndex + startMatch[0].length
      const messageEnd = messageStart + length
      
      // Extract the full message including the header
      const fullMessage = messageStr.substring(currentIndex, messageEnd)
      messages.push(fullMessage)
      
      currentIndex = messageEnd
    }
    
    return messages
  }

  /**
   * Connect to TradingView WebSocket
   * @param {Object} callbacks - Object containing callback functions
   * @param {Function} callbacks.onConnected - Called when connection is established
   * @param {Function} callbacks.onDisconnected - Called when connection is lost
   * @param {Function} callbacks.onError - Called when an error occurs
   * @param {Function} callbacks.onMessage - Called when any message is received (generic)
   * @param {Function} callbacks.onUnhandledMessage - Called when a message is received that isn't handled by dedicated callbacks
   * @param {Function} callbacks.onSessionInit - Called when session initialization message is received
   * @param {Function} callbacks.onSymbolResolved - Called when symbol_resolved message is received
   *   Parameters: (symbolData, symbolRequestId, chartSessionId)
   * @param {Function} callbacks.onSeriesLoading - Called when series_loading message is received
   *   Parameters: (chartSessionId, seriesId, subSeriesId)
   * @param {Function} callbacks.onSeriesCompleted - Called when series_completed message is received
   *   Parameters: (chartSessionId, seriesId, status, subSeriesId, options)
   * @param {Function} callbacks.onTimescaleUpdate - Called when timescale_update message is received
   *   Parameters: (chartSessionId, seriesData, updateData)
   * @returns {Promise<void>}
   */
  async connect(callbacks = {}) {
    if (this.isConnected && this.ws) {
      return
    }

    if (this.isIntentionallyClosed) {
      return
    }

    // Store callbacks
    this.callbacks = callbacks

    return new Promise((resolve, reject) => {
      try {
        const url = this.buildWebSocketUrl()

        this.ws = new WebSocket(url, {
          headers: this.headers
        })

        this.ws.on('open', () => {
          this.isConnected = true
          this.isIntentionallyClosed = false
          this.reconnectAttempts = 0

          if (this.callbacks.onConnected) {
            this.callbacks.onConnected()
          }
          resolve()
        })

        this.ws.on('message', (data) => {
          const messageStr = data.toString()
          
          // Split concatenated messages (TradingView can send multiple messages in one frame)
          const messages = this.splitMessages(messageStr)
          
          // Process each message individually
          for (const msg of messages.length > 0 ? messages : [messageStr]) {
            const parsed = this.parseMessage(msg)
            
            // Handle heartbeat messages silently
            if (parsed && parsed.type === 'heartbeat') {
              // Heartbeat received, no action needed
              continue
            }
            
            if (!parsed) {
              // Silently ignore unparseable messages (likely heartbeat or malformed)
              continue
            }

            // Handle session initialization message
            if (parsed.session_id && !this.sessionId) {
            this.sessionId = parsed.session_id
            
            // Send auth token after session init
            this.sendAuthToken()
            
            // Send locale after auth token
            this.sendLocale()
            
            // Send chart_create_session after locale
            this.sendChartCreateSession()
            
            // Send switch_timezone after chart_create_session
            this.sendSwitchTimezone()
            
            if (this.callbacks.onSessionInit) {
              this.callbacks.onSessionInit(parsed)
            }
          }
            // Handle symbol_resolved message
            if (parsed.m === 'symbol_resolved' && parsed.p && parsed.p.length >= 3) {
              const chartSessionId = parsed.p[0]
              const symbolRequestId = parsed.p[1]
              const symbolData = parsed.p[2]
              
              // Find series by symbolRequestId and call its callback
              const series = this.series.find(s => s.symbolRequestId === symbolRequestId)
              if (series && series.onSymbolResolved) {
                series.onSymbolResolved({
                  ...symbolData,
                  request_id: symbolRequestId,
                  chart_session_id: chartSessionId
                })
              }
              
              // Also call global callback for backward compatibility
              if (this.callbacks.onSymbolResolved) {
                this.callbacks.onSymbolResolved(symbolData, symbolRequestId, chartSessionId)
              }
            }

            // Handle symbol_error message
            if (parsed.m === 'symbol_error' && parsed.p && parsed.p.length >= 3) {
              const chartSessionId = parsed.p[0]
              const symbolRequestId = parsed.p[1]
              const errorMessage = parsed.p[2]
              
              // Find series by symbolRequestId and call its callback
              const series = this.series.find(s => s.symbolRequestId === symbolRequestId)
              if (series && series.onSymbolError) {
                series.onSymbolError({
                  symbol_request_id: symbolRequestId,
                  error_message: errorMessage,
                  chart_session_id: chartSessionId
                })
              }
            }

            // Handle series_loading message
            if (parsed.m === 'series_loading' && parsed.p && parsed.p.length >= 3) {
              const chartSessionId = parsed.p[0]
              const seriesId = parsed.p[1]
              const subSeriesId = parsed.p[2]
              
              // Find series by seriesId and call its callback
              const series = this.series.find(s => s.seriesId === seriesId)
              if (series && series.onSeriesLoading) {
                series.onSeriesLoading({
                  series_id: seriesId,
                  sub_series_id: subSeriesId,
                  chart_session_id: chartSessionId
                })
              }
              
              // Also call global callback for backward compatibility
              if (this.callbacks.onSeriesLoading) {
                this.callbacks.onSeriesLoading(chartSessionId, seriesId, subSeriesId)
              }
            }

            // Handle series_completed message
            if (parsed.m === 'series_completed' && parsed.p && parsed.p.length >= 4) {
              const chartSessionId = parsed.p[0]
              const seriesId = parsed.p[1]
              const status = parsed.p[2]
              const subSeriesId = parsed.p[3]
              const options = parsed.p[4] || {}
              
              // Find series by seriesId and call its callback
              const series = this.series.find(s => s.seriesId === seriesId)
              if (series && series.onSeriesCompleted) {
                series.onSeriesCompleted({
                  series_id: seriesId,
                  sub_series_id: subSeriesId,
                  status,
                  options,
                  chart_session_id: chartSessionId
                })
              }
              
              // Also call global callback for backward compatibility
              if (this.callbacks.onSeriesCompleted) {
                this.callbacks.onSeriesCompleted(chartSessionId, seriesId, status, subSeriesId, options)
              }
            }

            // Handle series_error message
            if (parsed.m === 'series_error' && parsed.p && parsed.p.length >= 5) {
              const chartSessionId = parsed.p[0]
              const seriesId = parsed.p[1]
              const subSeriesId = parsed.p[2]
              const errorCode = parsed.p[3]
              const errorMessage = parsed.p[4]
              
              // Find series by seriesId and call its callback
              const series = this.series.find(s => s.seriesId === seriesId)
              if (series && series.onSeriesError) {
                series.onSeriesError({
                  series_id: seriesId,
                  sub_series_id: subSeriesId,
                  error_code: errorCode,
                  error_message: errorMessage,
                  chart_session_id: chartSessionId
                })
              }
            }

            // Handle timescale_update message
            if (parsed.m === 'timescale_update' && parsed.p && parsed.p.length >= 2) {
              const chartSessionId = parsed.p[0]
              const seriesData = parsed.p[1] || {}
              const updateData = parsed.p[2] || null
              
              // Call callback for each series that matches
              const seriesIds = Object.keys(seriesData)
              for (const seriesId of seriesIds) {
                const series = this.series.find(s => s.seriesId === seriesId)
                if (series && series.onTimescaleUpdate) {
                  series.onTimescaleUpdate({
                    series_id: seriesId,
                    chart_session_id: chartSessionId,
                    series_data: seriesData[seriesId],
                    update_data: updateData
                  })
                }
              }
              
              // Also call global callback for backward compatibility
              if (this.callbacks.onTimescaleUpdate) {
                this.callbacks.onTimescaleUpdate(chartSessionId, seriesData, updateData)
              }
            }

            // Handle replay_instance_id message
            if (parsed.m === 'replay_instance_id' && parsed.p && parsed.p.length >= 2) {
              const replaySessionId = parsed.p[0]
              const replayInstanceId = parsed.p[1]
              
              // Find series with matching replay session ID
              for (const series of this.series) {
                const replayInstance = series._replayInstance
                if (replayInstance && replayInstance.replaySessionId === replaySessionId) {
                  replayInstance.replayInstanceId = replayInstanceId
                  if (replayInstance.onReplayInstanceId) {
                    replayInstance.onReplayInstanceId(replayInstanceId)
                  }
                  break
                }
              }
            }

            // Handle replay_reset message
            if (parsed.m === 'replay_reset' && parsed.p && parsed.p.length >= 3) {
              const replaySessionId = parsed.p[0]
              const messageId = parsed.p[1]
              const timestamp = parsed.p[2]
              
              // Find series with matching replay session ID
              for (const series of this.series) {
                const replayInstance = series._replayInstance
                if (replayInstance && replayInstance.replaySessionId === replaySessionId) {
                  if (replayInstance.onReplayReset) {
                    replayInstance.onReplayReset({
                      messageId,
                      timestamp
                    })
                  }
                  break
                }
              }
            }

            // Handle replay_ok message
            if (parsed.m === 'replay_ok' && parsed.p && parsed.p.length >= 2) {
              const replaySessionId = parsed.p[0]
              const messageId = parsed.p[1]
              
              // Find series with matching replay session ID
              for (const series of this.series) {
                const replayInstance = series._replayInstance
                if (replayInstance && replayInstance.replaySessionId === replaySessionId) {
                  if (replayInstance.onReplayOk) {
                    replayInstance.onReplayOk({
                      messageId
                    })
                  }
                  break
                }
              }
            }

            // Handle replay_point message
            if (parsed.m === 'replay_point' && parsed.p && parsed.p.length >= 2) {
              const replaySessionId = parsed.p[0]
              const timestamp = parsed.p[1]
              
              // Find series with matching replay session ID
              for (const series of this.series) {
                const replayInstance = series._replayInstance
                if (replayInstance && replayInstance.replaySessionId === replaySessionId) {
                  if (replayInstance.onReplayPoint) {
                    replayInstance.onReplayPoint({
                      timestamp
                    })
                  }
                  break
                }
              }
            }

            // Handle replay_error message
            if (parsed.m === 'replay_error' && parsed.p && parsed.p.length >= 4) {
              const replaySessionId = parsed.p[0]
              const messageId = parsed.p[1]
              const errorCode = parsed.p[2]
              const errorDetails = parsed.p[3]
              
              // Find series with matching replay session ID
              for (const series of this.series) {
                const replayInstance = series._replayInstance
                if (replayInstance && replayInstance.replaySessionId === replaySessionId) {
                  if (replayInstance.onReplayError) {
                    replayInstance.onReplayError({
                      messageId,
                      errorCode,
                      errorDetails
                    })
                  }
                  break
                }
              }
            }

            // Handle replay_depth message
            if (parsed.m === 'replay_depth' && parsed.p && parsed.p.length >= 4) {
              const replaySessionId = parsed.p[0]
              const messageId = parsed.p[1]
              const timestamp = parsed.p[2]
              const depthType = parsed.p[3]
              
              // Find series with matching replay session ID
              for (const series of this.series) {
                const replayInstance = series._replayInstance
                if (replayInstance && replayInstance.replaySessionId === replaySessionId) {
                  if (replayInstance.onReplayDepth) {
                    replayInstance.onReplayDepth({
                      messageId,
                      timestamp,
                      depthType
                    })
                  }
                  break
                }
              }
            }

            // Handle replay_resolutions message
            if (parsed.m === 'replay_resolutions' && parsed.p && parsed.p.length >= 3) {
              const replaySessionId = parsed.p[0]
              const resolutionId = parsed.p[1]
              const resolution = parsed.p[2]
              
              // Find series with matching replay session ID
              for (const series of this.series) {
                const replayInstance = series._replayInstance
                if (replayInstance && replayInstance.replaySessionId === replaySessionId) {
                  if (replayInstance.onReplayResolutions) {
                    replayInstance.onReplayResolutions({
                      resolutionId,
                      resolution
                    })
                  }
                  break
                }
              }
            }

            // Track if message was handled by dedicated callbacks
            let messageHandled = false
            
            // Session initialization messages (have session_id but no 'm' property) are always handled
            if (parsed.session_id) {
              messageHandled = true // This is handled in onSessionInit above
            }
            
            // List of handled message types
            const handledMessageTypes = [
              'symbol_resolved', 'symbol_error', 'series_loading', 'series_completed', 'series_error',
              'timescale_update', 'qsd', 'quote_completed',
              'replay_instance_id', 'replay_reset', 'replay_ok', 'replay_point',
              'replay_error', 'replay_depth', 'replay_resolutions'
            ]
            
            if (parsed.m && handledMessageTypes.includes(parsed.m)) {
              messageHandled = true
            }
            
            // Call generic message callback
            if (this.callbacks.onMessage) {
              this.callbacks.onMessage(parsed, msg)
            }
            
            // Call unhandled message callback if message wasn't handled
            if (!messageHandled && this.callbacks.onUnhandledMessage) {
              this.callbacks.onUnhandledMessage(parsed, msg)
            }
          }
        })

        this.ws.on('error', (error) => {
          console.error('[TradingViewWebSocket] WebSocket error:', error.message)
          this.isConnected = false

          if (this.callbacks.onError) {
            this.callbacks.onError(error)
          }

          // Attempt reconnection if not intentionally closed
          if (!this.isIntentionallyClosed) {
            this.scheduleReconnect()
          }

          reject(error)
        })

        this.ws.on('close', (code, reason) => {
          this.isConnected = false
          this.ws = null

          if (this.callbacks.onDisconnected) {
            this.callbacks.onDisconnected(code, reason)
          }

          // Attempt reconnection if not intentionally closed
          if (!this.isIntentionallyClosed) {
            this.scheduleReconnect()
          }
        })
      } catch (error) {
        console.error('[TradingViewWebSocket] Connection error:', error.message)
        reject(error)
      }
    })
  }

  /**
   * Schedule reconnection attempt
   * @private
   */
  scheduleReconnect() {
    if (this.reconnectTimer || this.isIntentionallyClosed) {
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[TradingViewWebSocket] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.isIntentionallyClosed) {
        this.connect(this.callbacks).catch(error => {
          console.error('[TradingViewWebSocket] Reconnect failed:', error.message)
        })
      }
    }, delay)
  }

  /**
   * Send a message to TradingView
   * @param {Object|string} data - Data to send (will be JSON stringified if object)
   * @returns {boolean} - True if message was sent successfully, false otherwise
   */
  send(data) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[TradingViewWebSocket] Cannot send message: not connected')
      return false
    }

    try {
      const formatted = this.formatMessage(data)
      this.ws.send(formatted)
      return true
    } catch (error) {
      console.error('[TradingViewWebSocket] Error sending message:', error.message)
      return false
    }
  }

  /**
   * Generate next message ID
   * @returns {number} - Next message ID
   */
  getNextMessageId() {
    return ++this.messageId
  }

  /**
   * Send authentication token to TradingView
   * @private
   */
  sendAuthToken() {
    // Use 'unauthorized_user_token' if token is null or undefined
    const authToken = (this.token === null || this.token === undefined) 
      ? 'unauthorized_user_token' 
      : this.token
    
    const message = {
      m: 'set_auth_token',
      p: [authToken]
    }
    
    this.send(message)
  }

  /**
   * Send locale settings to TradingView
   * @private
   */
  sendLocale() {
    const message = {
      m: 'set_locale',
      p: [this.locale, this.country]
    }
    
    this.send(message)
  }


  /**
   * Send chart_create_session message to TradingView
   * @private
   */
  sendChartCreateSession() {
    // Generate chart session ID if not already set
    if (!this.chartSessionId) {
      const randomStr = generateRandomString(12)
      this.chartSessionId = `cs_${randomStr}`
    }
    
    const message = {
      m: 'chart_create_session',
      p: [this.chartSessionId, '']
    }
    
    this.send(message)
  }

  /**
   * Send switch_timezone message to TradingView
   * @private
   */
  sendSwitchTimezone() {
    if (!this.chartSessionId) {
      console.warn('[TradingViewWebSocket] Cannot send switch_timezone: chartSessionId not set')
      return
    }
    
    const message = {
      m: 'switch_timezone',
      p: [this.chartSessionId, this.timezone]
    }
    
    this.send(message)
  }

  /**
   * Send resolve_symbol message
   * Helper method to send resolve_symbol with a config object
   * @param {string} symbolRequestId - Symbol request ID (e.g., 'sds_sym_1')
   * @param {Object} config - Configuration object to send (will be JSON stringified with = prefix)
   * @returns {boolean} - True if message was sent successfully, false otherwise
   */
  sendResolveSymbol(symbolRequestId, config = {}) {
    if (!this.chartSessionId) {
      console.warn('[TradingViewWebSocket] Cannot send resolve_symbol: chartSessionId not set')
      return false
    }

    if (!symbolRequestId) {
      console.warn('[TradingViewWebSocket] sendResolveSymbol requires symbolRequestId')
      return false
    }
    // Format the config as a JSON string with = prefix
    const configString = `=${JSON.stringify(config)}`
    
    const message = {
      m: 'resolve_symbol',
      p: [this.chartSessionId, symbolRequestId, configString]
    }

    return this.send(message)
  }

  sendCreateSeries(seriesId, subSeriesId, symbolRequestId, interval, bars) {
    if (!this.chartSessionId) {
      console.warn('[TradingViewWebSocket] Cannot send create_series: chartSessionId not set')
      return false
    }

    let message = {
      m: 'create_series',
      p: [this.chartSessionId, seriesId, subSeriesId, symbolRequestId, interval, bars, ""]
    }
    return this.send(message)
  }

  sendModifySeries(seriesId, newSubSeriesId, symbolRequestId, interval) {
    if (!this.chartSessionId) {
      console.warn('[TradingViewWebSocket] Cannot send modify_series: chartSessionId not set')
      return false
    }
    const message = {
      m: 'modify_series',
      p: [this.chartSessionId, seriesId, newSubSeriesId, symbolRequestId, interval, ""]
    }
    return this.send(message)
  }

  sendReplayCreateSession(replaySessionId) {
    const message = {
      m: 'replay_create_session',
      p: [replaySessionId]
    }
    return this.send(message)
  }

  sendReplayReset(replaySessionId, messageId, resetTimestamp) {
    const message = {
      m: 'replay_reset',
      p: [replaySessionId, messageId, resetTimestamp]
    }
    return this.send(message)
  }

  sendReplayAddSeries(replaySessionId, messageId, config, interval) {
    const configString = `=${JSON.stringify(config)}`
    const message = {
      m: 'replay_add_series',
      p: [replaySessionId, messageId, configString, String(interval)]
    }
    return this.send(message)
  }

  sendReplayGetDepth(replaySessionId, messageId, config, interval) {
    const configString = `=${JSON.stringify(config)}`
    const message = {
      m: 'replay_get_depth',
      p: [replaySessionId, messageId, configString, interval]
    }
    return this.send(message)
  }

  sendSetBroker(broker = 'replaybroker') {
    const message = {
      m: 'set_broker',
      p: [broker]
    }
    return this.send(message)
  }

  /**
   * Create a series object for chart data
   * Returns a Series instance with methods and callbacks
   * @returns {Series} - Series object with resolve method and callback properties
   */
  createSeries(session = 'regular',adjustment = 'splits', currencyId = 'USD', metric = 'price') {
    if (!this.chartSessionId) {
      console.warn('[TradingViewWebSocket] Cannot create series: chartSessionId not set')
      return null
    }

    // Increment seriesId and symbolRequestId for this new series (before creating the object)
    this.incrementSeriesId()
    this.incrementSymbolRequestId()
    
    // Use the incremented values for this series
    const seriesId = this.seriesId
    const symbolRequestId = this.symbolRequestId
    const subSeriesId = this.subSeriesId
    
    // Create series instance
    const series = new Series(this, seriesId, symbolRequestId, subSeriesId, adjustment, currencyId, session, metric)
    
    // Store series in socket's series array
    this.series.push(series)
    
    return series
  }

  /**
   * Increment series ID (e.g., sds_1 -> sds_2, sds_2 -> sds_3)
   * @returns {string} - The new series ID
   * @private
   */
  incrementSeriesId() {
    // Extract number from current seriesId (e.g., 'sds_1' -> 1, 'sds_2' -> 2)
    const match = this.seriesId.match(/^sds_(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      this.seriesId = `sds_${num + 1}`
    } else {
      // Fallback: if format is unexpected, default to sds_2
      this.seriesId = 'sds_2'
    }
    return this.seriesId
  }

  /**
   * Increment symbol request ID (e.g., sds_sym_1 -> sds_sym_2, sds_sym_2 -> sds_sym_3)
   * @returns {string} - The new symbol request ID
   * @private
   */
  incrementSymbolRequestId() {
    // Extract number from current symbolRequestId (e.g., 'sds_sym_1' -> 1, 'sds_sym_2' -> 2)
    const match = this.symbolRequestId.match(/^sds_sym_(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      this.symbolRequestId = `sds_sym_${num + 1}`
    } else {
      // Fallback: if format is unexpected, default to sds_sym_2
      this.symbolRequestId = 'sds_sym_2'
    }
    return this.symbolRequestId
  }

  /**
   * Increment sub-series ID (e.g., s1 -> s2, s2 -> s3)
   * @returns {string} - The new sub-series ID
   * @private
   */
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

  /**
   * Disconnect from TradingView WebSocket
   */
  disconnect() {
    this.isIntentionallyClosed = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.isConnected = false
    this.sessionId = null
    this.chartSessionId = null
    this.reconnectAttempts = 0
  }

  /**
   * Get connection status
   * @returns {boolean} - True if connected, false otherwise
   */
  getConnected() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * Get session ID
   * @returns {string|null} - Session ID or null if not connected
   */
  getSessionId() {
    return this.sessionId
  }
}

export default TradingViewWebSocket
