import webSocketManager from './WebSocketManager.js'

/**
 * WebSocket Base Service
 * Generic base class for WebSocket server implementations
 * Can be extended to create specific WebSocket services
 */
class WebSocketBase {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.serverName - Unique name for the WebSocket server
   * @param {string} options.path - WebSocket path (e.g., '/backtester-ws')
   * @param {Object} [options.wsOptions] - Additional options for the WebSocket server
   * @param {boolean} [options.enableHeartbeat=true] - Enable heartbeat/ping-pong mechanism
   * @param {number} [options.heartbeatInterval=5000] - Heartbeat interval in milliseconds (default: 5 seconds)
   * @param {number} [options.heartbeatTimeout=15000] - Timeout before considering client dead in milliseconds (default: 15 seconds)
   * @param {string} [options.pingMessage='ping'] - Message type to send for ping (default: 'ping')
   * @param {string} [options.pongMessage='pong'] - Message type expected for pong (default: 'pong')
   */
  constructor(options) {
    if (!options || !options.serverName || !options.path) {
      throw new Error('WebSocketBase requires serverName and path in options')
    }

    this.serverName = options.serverName
    this.path = options.path
    this.wsOptions = options.wsOptions || {}
    this.initialized = false

    // Heartbeat configuration
    this.enableHeartbeat = options.enableHeartbeat !== false // Default: true
    this.heartbeatInterval = options.heartbeatInterval || 5000 // 5 seconds
    this.heartbeatTimeout = options.heartbeatTimeout || 15000 // 15 seconds (3 missed pings)
    this.pingMessage = options.pingMessage || 'ping'
    this.pongMessage = options.pongMessage || 'pong'
    this.heartbeatIntervalId = null
    this.clientHeartbeats = new Map() // Map<clientId, { lastPing, lastPong, isAlive }>
  }

  /**
   * Initialize WebSocket server
   * @param {http.Server} server - HTTP server instance (optional if manager is already initialized)
   */
  initialize(server) {
    if (this.initialized) {
      console.warn(`[${this.serverName} WS] Already initialized`)
      return
    }

    // Ensure WebSocket Manager is initialized with the HTTP server
    if (server && !webSocketManager.httpServer) {
      webSocketManager.initialize(server)
    }

    // Register with WebSocket Manager
    webSocketManager.registerServer(
      this.serverName,
      this.path,
      this.handleConnection.bind(this),
      this.wsOptions
    )

    this.initialized = true
    console.log(`[${this.serverName} WS] WebSocket server registered on ${this.path}`)

    // Start heartbeat if enabled
    if (this.enableHeartbeat) {
      this.startHeartbeat()
    }
  }

  /**
   * Handle new client connection
   * Override this method in subclasses to implement custom connection handling
   * @param {WebSocket} ws - WebSocket connection
   * @param {http.IncomingMessage} req - HTTP request
   * @param {Object} clientInfo - Client information
   * @param {Object} serverInfo - Server information
   */
  handleConnection(ws, req, clientInfo, serverInfo) {
    // Initialize heartbeat tracking for this client
    if (this.enableHeartbeat) {
      this.clientHeartbeats.set(clientInfo.id, {
        lastPing: null,
        lastPong: Date.now(), // Initialize as alive
        isAlive: true
      })
    }

    // Send welcome message immediately for all browsers
    // iOS Safari compatibility is handled on the client side via testConnectivity
    this.sendWelcomeMessage(ws)

    // Set up default message handler
    ws.on('message', (message) => {
      this.handleMessage(ws, message, clientInfo, serverInfo)
    })

    // Set up default error handler
    ws.on('error', (error) => {
      this.handleError(ws, error, clientInfo, serverInfo)
    })

    // Set up default close handler
    ws.on('close', (code, reason) => {
      this.handleClose(ws, clientInfo, serverInfo)
    })
  }

  /**
   * Send welcome message to client
   * Override this method in subclasses to customize welcome message
   * @param {WebSocket} ws - WebSocket connection
   */
  sendWelcomeMessage(ws) {
    try {
      if (ws.readyState === ws.OPEN) {
        const message = JSON.stringify({
          type: 'connected',
          message: `Connected to ${this.serverName} WebSocket`,
          timestamp: new Date().toISOString()
        })
        ws.send(message)
        const userAgent = ws._socket?.upgradeReq?.headers['user-agent'] || ''
        const isIOS = /iPad|iPhone|iPod/.test(userAgent)
        if (isIOS) {
          console.log(`[WebSocket Base] iOS Safari: Welcome message sent (${message.length} bytes)`)
        }
      } else {
        console.warn(`[WebSocket Base] Cannot send welcome message: connection not open (state: ${ws.readyState})`)
      }
    } catch (error) {
      console.error(`[WebSocket Base] Error sending welcome message:`, error)
    }
  }

  /**
   * Handle incoming messages
   * Override this method in subclasses to implement custom message handling
   * @param {WebSocket} ws - WebSocket connection
   * @param {Buffer|string} message - Incoming message
   * @param {Object} clientInfo - Client information
   * @param {Object} serverInfo - Server information
   */
  handleMessage(ws, message, clientInfo, serverInfo) {
    try {
      const data = JSON.parse(message.toString())
      
      // Handle heartbeat pong response first (before subclass processing)
      if (this.enableHeartbeat && this.isPongMessage(data)) {
        this.handlePong(clientInfo.id)
        return // Don't process further if it's a pong - no log needed
      }
      
      // Log only if message is not handled (will be logged in onMessage if not handled)
      this.onMessage(ws, data, clientInfo, serverInfo)
    } catch (error) {
      console.error(`[${this.serverName} WS] Error parsing message:`, error)
      // If message is not JSON, treat as plain text
      const messageStr = message.toString()
      
      // Handle heartbeat pong response first (before subclass processing)
      if (this.enableHeartbeat && this.isPongMessage(messageStr)) {
        this.handlePong(clientInfo.id)
        return // Don't process further if it's a pong - no log needed
      }
      
      // Log only if message is not handled (will be logged in onMessage if not handled)
      this.onMessage(ws, messageStr, clientInfo, serverInfo)
    }
  }

  /**
   * Process parsed message
   * Override this method in subclasses to implement message processing logic
   * Note: Pong messages are handled automatically before this method is called
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object|string} data - Parsed message data
   * @param {Object} clientInfo - Client information
   * @param {Object} serverInfo - Server information
   */
  onMessage(ws, data, clientInfo, serverInfo) {
    // Default implementation: echo back the message
    // Log unhandled messages (messages that reach default handler)
    console.log(`[${this.serverName} WS] Unhandled message:`, data)
    this.send(ws, {
      type: 'echo',
      data: data,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Check if message is a pong/heartbeat response
   * @param {Object|string} data - Message data
   * @returns {boolean} True if message is a pong
   */
  isPongMessage(data) {
    if (typeof data === 'string') {
      return data.toLowerCase() === this.pongMessage.toLowerCase()
    }
    if (typeof data === 'object' && data !== null) {
      return data.type === this.pongMessage || 
             data.message === this.pongMessage ||
             data.pong === true
    }
    return false
  }

  /**
   * Handle pong response from client
   * @param {string} clientId - Client ID
   */
  handlePong(clientId) {
    const heartbeat = this.clientHeartbeats.get(clientId)
    if (heartbeat) {
      heartbeat.lastPong = Date.now()
      heartbeat.isAlive = true
      // No log needed - pong is handled automatically
    }
  }

  /**
   * Handle WebSocket errors
   * Override this method in subclasses to implement custom error handling
   * @param {WebSocket} ws - WebSocket connection
   * @param {Error} error - Error object
   * @param {Object} clientInfo - Client information
   * @param {Object} serverInfo - Server information
   */
  handleError(ws, error, clientInfo, serverInfo) {
    console.error(`[${this.serverName} WS] WebSocket error:`, error)
  }

  /**
   * Handle WebSocket close
   * Override this method in subclasses to implement custom close handling
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} clientInfo - Client information
   * @param {Object} serverInfo - Server information
   */
  handleClose(ws, clientInfo, serverInfo) {
    // Clean up heartbeat tracking
    if (this.enableHeartbeat) {
      this.clientHeartbeats.delete(clientInfo.id)
    }
    console.log(`[${this.serverName} WS] Client disconnected:`, clientInfo.id)
  }

  /**
   * Send message to a specific WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object|string} message - Message to send
   */
  send(ws, message) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      const data = typeof message === 'string' ? message : JSON.stringify(message)
      ws.send(data)
    }
  }

  /**
   * Send message to a specific client by ID
   * @param {string} clientId - Client ID
   * @param {Object|string} message - Message to send
   * @returns {boolean} True if message was sent successfully
   */
  sendToClient(clientId, message) {
    return webSocketManager.sendToClient(this.serverName, clientId, message)
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object|string} message - Message to broadcast
   */
  broadcast(message) {
    webSocketManager.broadcast(this.serverName, message)
  }

  /**
   * Get number of connected clients
   * @returns {number}
   */
  getClientCount() {
    const serverInfo = webSocketManager.getServerInfo(this.serverName)
    return serverInfo ? serverInfo.clientCount : 0
  }

  /**
   * Get server information
   * @returns {Object|null} Server information or null if not initialized
   */
  getServerInfo() {
    return webSocketManager.getServerInfo(this.serverName)
  }

  /**
   * Get all connected clients
   * @returns {Array} Array of client information
   */
  getClients() {
    const serverInfo = webSocketManager.getServerInfo(this.serverName)
    return serverInfo ? serverInfo.clients : []
  }

  /**
   * Start heartbeat interval
   * Sends ping messages to all connected clients periodically
   */
  startHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId)
    }

    this.heartbeatIntervalId = setInterval(() => {
      this.sendHeartbeat()
      this.checkDeadClients()
    }, this.heartbeatInterval)

    console.log(`[${this.serverName} WS] Heartbeat started (interval: ${this.heartbeatInterval}ms, timeout: ${this.heartbeatTimeout}ms)`)
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId)
      this.heartbeatIntervalId = null
      console.log(`[${this.serverName} WS] Heartbeat stopped`)
    }
  }

  /**
   * Send heartbeat (ping) to all connected clients
   */
  sendHeartbeat() {
    const internalServerInfo = webSocketManager.getInternalServerInfo(this.serverName)
    if (!internalServerInfo || !internalServerInfo.clients) {
      return
    }

    const now = Date.now()
    const pingMessage = {
      type: this.pingMessage,
      timestamp: now,
      serverTime: new Date().toISOString()
    }

    internalServerInfo.clients.forEach((client) => {
      const heartbeat = this.clientHeartbeats.get(client.id)
      if (heartbeat && client.ws.readyState === 1) { // WebSocket.OPEN
        // Mark that we sent a ping
        heartbeat.lastPing = now
        // Send ping message
        this.send(client.ws, pingMessage)
      }
    })
  }

  /**
   * Check for dead clients and disconnect them
   */
  checkDeadClients() {
    const now = Date.now()
    const deadClients = []

    this.clientHeartbeats.forEach((heartbeat, clientId) => {
      // Check if client hasn't responded to pings
      if (heartbeat.lastPing && heartbeat.lastPong) {
        const timeSinceLastPong = now - heartbeat.lastPong
        if (timeSinceLastPong > this.heartbeatTimeout) {
          heartbeat.isAlive = false
          deadClients.push(clientId)
        }
      } else if (heartbeat.lastPing) {
        // If we sent a ping but never got a pong, check timeout
        const timeSinceLastPing = now - heartbeat.lastPing
        if (timeSinceLastPing > this.heartbeatTimeout) {
          heartbeat.isAlive = false
          deadClients.push(clientId)
        }
      }
    })

    // Disconnect dead clients
    deadClients.forEach((clientId) => {
      console.warn(`[${this.serverName} WS] Client ${clientId} is dead (no pong response), disconnecting...`)
      this.disconnectClient(clientId)
    })
  }

  /**
   * Disconnect a specific client
   * @param {string} clientId - Client ID to disconnect
   */
  disconnectClient(clientId) {
    const internalServerInfo = webSocketManager.getInternalServerInfo(this.serverName)
    if (!internalServerInfo) return

    const client = internalServerInfo.clients.get(clientId)
    if (client && client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.close(1000, 'Heartbeat timeout')
    }

    // Clean up heartbeat tracking
    this.clientHeartbeats.delete(clientId)
  }

  /**
   * Close WebSocket server
   */
  close() {
    // Stop heartbeat
    if (this.enableHeartbeat) {
      this.stopHeartbeat()
    }

    // Clear heartbeat tracking
    this.clientHeartbeats.clear()

    if (this.initialized) {
      webSocketManager.unregisterServer(this.serverName)
      this.initialized = false
      console.log(`[${this.serverName} WS] WebSocket server closed`)
    }
  }
}

export default WebSocketBase

