/**
 * SignalR Base Service
 * Generic base class for SignalR WebSocket connections
 * Can be used with any SignalR API implementation
 */
import * as signalR from '@microsoft/signalr'

class SignalRBase {
  /**
   * @param {Object} [options] - Configuration options
   * @param {string} [options.authMethod='none'] - Authentication method: 'query', 'header', or 'none'
   * @param {string} [options.authParamName] - Parameter name for authentication (for query or header)
   * @param {signalR.HttpTransportType} [options.transport=signalR.HttpTransportType.WebSockets] - Transport type
   * @param {boolean} [options.skipNegotiation=true] - Skip negotiation for direct WebSocket connection
   * @param {signalR.LogLevel} [options.logLevel=signalR.LogLevel.Information] - Logging level
   * @param {Object} [options.reconnectConfig] - Reconnect configuration
   * @param {Function} [options.reconnectConfig.nextRetryDelayInMilliseconds] - Custom retry delay function
   */
  constructor(options = {}) {
    this.connection = null
    this.isConnected = false
    this.reconnectAttempts = 0
    
    // Configuration options
    this.authMethod = options.authMethod || 'none' // 'query', 'header', or 'none'
    this.authParamName = options.authParamName // Only used if authMethod is 'query' or 'header'
    this.transport = options.transport || signalR.HttpTransportType.WebSockets
    this.skipNegotiation = options.skipNegotiation !== undefined ? options.skipNegotiation : true
    this.logLevel = options.logLevel || signalR.LogLevel.Information
    
    // Reconnect configuration
    this.reconnectConfig = options.reconnectConfig || {
      nextRetryDelayInMilliseconds: (retryContext) => {
        // Exponential backoff: 0s, 2s, 10s, 30s, then stop
        if (retryContext.previousRetryCount === 0) return 0
        if (retryContext.previousRetryCount === 1) return 2000
        if (retryContext.previousRetryCount === 2) return 10000
        if (retryContext.previousRetryCount === 3) return 30000
        return null // Stop reconnecting after 4 attempts
      }
    }
  }

  /**
   * Build the connection URL
   * @param {string} fullUrl - Full URL including base and hub path (e.g., "https://example.com/hubs/chart")
   * @param {string} [accessToken] - Authentication token (if using query auth)
   * @returns {string} Full connection URL with optional auth parameter
   */
  buildConnectionUrl(fullUrl, accessToken = null) {
    let url = fullUrl
    
    // Only add query parameter if using query authentication method and token is provided
    if (this.authMethod === 'query' && accessToken && this.authParamName) {
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}${this.authParamName}=${encodeURIComponent(accessToken)}`
    }
    
    return url
  }

  /**
   * Build connection options for SignalR
   * @param {string} [accessToken] - Authentication token (if using auth)
   * @returns {Object} Connection options
   */
  buildConnectionOptions(accessToken = null) {
    const options = {
      transport: this.transport,
      skipNegotiation: this.skipNegotiation,
    }

    // Add authentication header if using header method
    if (this.authMethod === 'header' && accessToken) {
      options.headers = {}
      
      // Special handling for Authorization header (adds Bearer prefix if needed)
      if (this.authParamName === 'Authorization') {
        options.headers['Authorization'] = accessToken.startsWith('Bearer ') 
          ? accessToken 
          : `Bearer ${accessToken}`
      } else {
        // Custom header name
        options.headers[this.authParamName] = accessToken
      }
    }

    return options
  }

  /**
   * Connect to a SignalR hub
   * @param {string} fullUrl - Full URL including base and hub path (e.g., "https://example.com/hubs/chart")
   * @param {string} [accessToken] - Authentication token (optional, depends on authMethod)
   * @param {Object} [callbacks] - Object containing callback functions
   * @param {Function} [callbacks.onConnected] - Called when connection is established
   * @param {Function} [callbacks.onDisconnected] - Called when connection is lost
   * @param {Function} [callbacks.onReconnecting] - Called when reconnecting
   * @param {Function} [callbacks.onReconnected] - Called when reconnected
   * @param {Function} [callbacks.onError] - Called when an error occurs
   * @returns {Promise<signalR.HubConnection>} The SignalR connection object
   */
  async connect(fullUrl, accessToken = null, callbacks = {}) {
    try {
      if (this.connection && this.isConnected) {
        console.log('WebSocket already connected')
        return this.connection
      }

      // Build connection URL and options
      const url = this.buildConnectionUrl(fullUrl, accessToken)
      const connectionOptions = this.buildConnectionOptions(accessToken)

      // Create SignalR connection
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(url, connectionOptions)
        .withAutomaticReconnect(this.reconnectConfig)
        .configureLogging(this.logLevel)
        .build()

      // Set up event handlers
      this.connection.onclose((error) => {
        this.isConnected = false
        console.log('WebSocket connection closed', error ? `Error: ${error.message}` : '')
        if (callbacks.onDisconnected) {
          callbacks.onDisconnected(error)
        }
      })

      if (callbacks.onReconnecting) {
        this.connection.onreconnecting((error) => {
          this.isConnected = false
          console.log('WebSocket reconnecting...', error ? `Error: ${error.message}` : '')
          callbacks.onReconnecting(error)
        })
      } else {
        this.connection.onreconnecting((error) => {
          this.isConnected = false
          console.log('WebSocket reconnecting...', error ? `Error: ${error.message}` : '')
        })
      }

      if (callbacks.onReconnected) {
        this.connection.onreconnected((connectionId) => {
          this.isConnected = true
          this.reconnectAttempts = 0
          console.log('WebSocket reconnected. Connection ID:', connectionId)
          callbacks.onReconnected(connectionId)
        })
      } else {
        this.connection.onreconnected((connectionId) => {
          this.isConnected = true
          this.reconnectAttempts = 0
          console.log('WebSocket reconnected. Connection ID:', connectionId)
          if (callbacks.onConnected) {
            callbacks.onConnected(connectionId)
          }
        })
      }

      // Start the connection
      await this.connection.start()
      this.isConnected = true
      this.reconnectAttempts = 0
      console.log('WebSocket connected successfully. Connection ID:', this.connection.connectionId)

      if (callbacks.onConnected) {
        callbacks.onConnected(this.connection.connectionId)
      }

      return this.connection
    } catch (error) {
      this.isConnected = false
      console.error('Failed to connect WebSocket:', error)
      if (callbacks.onError) {
        callbacks.onError(error)
      }
      throw error
    }
  }

  /**
   * Disconnect from the WebSocket
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.connection) {
        await this.connection.stop()
        this.connection = null
        this.isConnected = false
        console.log('WebSocket disconnected')
      }
    } catch (error) {
      console.error('Error disconnecting WebSocket:', error)
      throw error
    }
  }

  /**
   * Invoke a method on the SignalR hub
   * @param {string} methodName - Name of the method to invoke
   * @param {any[]} args - Arguments to pass to the method
   * @returns {Promise<any>} Result from the hub method
   */
  async invoke(methodName, ...args) {
    try {
      if (!this.connection || !this.isConnected) {
        throw new Error('WebSocket is not connected')
      }
      return await this.connection.invoke(methodName, ...args)
    } catch (error) {
      console.error(`Error invoking ${methodName}:`, error)
      throw error
    }
  }

  /**
   * Subscribe to a hub method
   * @param {string} methodName - Name of the method to subscribe to
   * @param {Function} callback - Callback function to handle messages
   */
  on(methodName, callback) {
    if (!this.connection) {
      throw new Error('WebSocket is not connected')
    }
    this.connection.on(methodName, callback)
  }

  /**
   * Unsubscribe from a hub method
   * @param {string} methodName - Name of the method to unsubscribe from
   * @param {Function} [callback] - Optional callback function to remove
   */
  off(methodName, callback) {
    if (!this.connection) {
      return
    }
    if (callback) {
      this.connection.off(methodName, callback)
    } else {
      this.connection.off(methodName)
    }
  }

  /**
   * Get connection state
   * @returns {string} Current connection state
   */
  getState() {
    if (!this.connection) {
      return signalR.HubConnectionState.Disconnected
    }
    return this.connection.state
  }

  /**
   * Check if connected
   * @returns {boolean} True if connected
   */
  getIsConnected() {
    return this.isConnected && this.connection?.state === signalR.HubConnectionState.Connected
  }

  /**
   * Get connection ID
   * @returns {string|null} Connection ID or null if not connected
   */
  getConnectionId() {
    return this.connection?.connectionId || null
  }
}

export default SignalRBase

