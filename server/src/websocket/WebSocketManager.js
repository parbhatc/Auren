import { WebSocketServer } from 'ws'

/**
 * WebSocket Manager
 * Centralized manager for all WebSocket servers in the application
 */
class WebSocketManager {
  constructor() {
    this.servers = new Map() // Map of WebSocket server instances (by name)
    this.pathToServer = new Map() // Map of path -> server name for routing
    this.httpServer = null
    this.upgradeHandler = null
  }

  /**
   * Initialize the WebSocket manager with an HTTP server
   * @param {http.Server} httpServer - HTTP server instance
   * @param {Array} webSocketInstances - Array of WebSocket instances to initialize (optional)
   */
  initialize(httpServer, webSocketInstances = []) {
    this.httpServer = httpServer
    
    // Set up single upgrade handler for all WebSocket servers
    this.setupUpgradeHandler()
    
    console.log('[WebSocket Manager] Initialized')
    
    // Initialize all provided WebSocket instances
    if (webSocketInstances && webSocketInstances.length > 0) {
      this.initializeAll(webSocketInstances)
    }
  }

  /**
   * Initialize multiple WebSocket instances
   * @param {Array} webSocketInstances - Array of WebSocket instances (extending WebSocketBase)
   */
  initializeAll(webSocketInstances) {
    webSocketInstances.forEach((wsInstance) => {
      if (!wsInstance || typeof wsInstance.initialize !== 'function') {
        console.warn('[WebSocket Manager] Invalid WebSocket instance provided, skipping')
        return
      }

      // Initialize the WebSocket instance
      // The instance will call registerServer internally via its initialize method
      wsInstance.initialize(this.httpServer)
    })
  }

  /**
   * Set up the upgrade handler to route connections to appropriate servers
   */
  setupUpgradeHandler() {
    if (this.upgradeHandler) {
      // Remove existing handler if reinitializing
      this.httpServer.removeListener('upgrade', this.upgradeHandler)
    }

    this.upgradeHandler = (request, socket, head) => {
      try {
        const { pathname } = new URL(request.url, `http://${request.headers.host}`)
        
        // Find server by path
        const serverName = this.pathToServer.get(pathname)
        if (!serverName) {
          // Path not registered, close connection
          console.warn(`[WebSocket Manager] Upgrade request for unregistered path: ${pathname}`)
          socket.destroy()
          return
        }

        const serverInfo = this.servers.get(serverName)
        if (!serverInfo || !serverInfo.wss) {
          console.error(`[WebSocket Manager] Server info not found for: ${serverName}`)
          socket.destroy()
          return
        }

        // Handle upgrade for this specific server
        // handleUpgrade automatically sends the proper WebSocket upgrade response
        try {
          serverInfo.wss.handleUpgrade(request, socket, head, (ws) => {
            try {
              // Emit connection event immediately
              // The handleUpgrade callback is called AFTER the upgrade response is sent,
              // so it's safe to emit immediately
              serverInfo.wss.emit('connection', ws, request)
            } catch (error) {
              console.error(`[WebSocket Manager] Error in connection handler for ${serverName}:`, error)
              if (ws.readyState === ws.OPEN) {
                ws.close(1011, 'Internal server error')
              }
            }
          })
        } catch (upgradeError) {
          console.error(`[WebSocket Manager] Error in handleUpgrade for ${serverName}:`, upgradeError)
          socket.destroy()
        }
      } catch (error) {
        console.error('[WebSocket Manager] Error handling upgrade request:', error)
        socket.destroy()
      }
    }

    this.httpServer.on('upgrade', this.upgradeHandler)
  }

  /**
   * Register a new WebSocket server
   * @param {string} name - Unique name for the WebSocket server
   * @param {string} path - WebSocket path (e.g., '/backtester-ws')
   * @param {Function} onConnection - Callback function when a client connects
   * @param {Object} options - Additional options for the WebSocket server
   * @returns {WebSocketServer} The created WebSocket server instance
   */
  registerServer(name, path, onConnection, options = {}) {
    if (this.servers.has(name)) {
      console.warn(`[WebSocket Manager] Server "${name}" already exists, replacing it`)
      this.unregisterServer(name)
    }

    if (!this.httpServer) {
      throw new Error('[WebSocket Manager] HTTP server not initialized. Call initialize() first.')
    }

    // Check if path is already registered
    if (this.pathToServer.has(path)) {
      const existingName = this.pathToServer.get(path)
      if (existingName !== name) {
        throw new Error(`[WebSocket Manager] Path "${path}" is already registered to server "${existingName}"`)
      }
    }

    // Create WebSocket server with noServer option to avoid conflicts
    // iOS Safari compatibility: Accept connections with or without protocol
    const wss = new WebSocketServer({
      noServer: true, // Don't attach to HTTP server automatically
      // Handle protocol negotiation - accept any protocol or no protocol
      // This is important for iOS Safari compatibility
      handleProtocols: (protocols, request) => {
        // If client doesn't specify a protocol (iOS Safari often doesn't), accept without protocol
        if (!protocols || protocols.length === 0) {
          return false // Accept without protocol (don't set Sec-WebSocket-Protocol in response)
        }
        // If client specifies protocols, accept the first one (like Vite does)
        return protocols[0]
      },
      ...options
    })

    // Store server info
    const serverInfo = {
      name,
      path,
      wss,
      clients: new Map(),
      options,
      onConnection,
      createdAt: new Date()
    }

    this.servers.set(name, serverInfo)
    this.pathToServer.set(path, name)

    // Set up connection handler
    wss.on('connection', (ws, req) => {
      try {
        const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        // Extract token from query string if present
        const url = new URL(req.url || `${path}`, `http://${req.headers?.host || 'localhost'}`)
        const token = url.searchParams.get('token')

        // Store client connection
        const clientInfo = {
          id: clientId,
          ws,
          token: token || null,
          connectedAt: new Date(),
          ip: (req.socket && req.socket.remoteAddress) || (req.headers && req.headers['x-forwarded-for']) || 'unknown'
        }
        
        serverInfo.clients.set(clientId, clientInfo)

        console.log(`[WebSocket Manager] Client connected to "${name}": ${clientId}`, {
          path,
          token: token ? 'provided' : 'none',
          ip: clientInfo.ip
        })

        // Handle client disconnect
        ws.on('close', (code, reason) => {
          console.log(`[WebSocket Manager] Client disconnected from "${name}": ${clientId}`)
          serverInfo.clients.delete(clientId)
        })

        // Handle errors
        ws.on('error', (error) => {
          console.error(`[WebSocket Manager] WebSocket error on "${name}":`, error)
          serverInfo.clients.delete(clientId)
        })

        // Call custom connection handler with error handling
        if (serverInfo.onConnection) {
          try {
            const connectionResult = serverInfo.onConnection(ws, req, clientInfo, serverInfo)
            Promise.resolve(connectionResult).catch((error) => {
              console.error(`[WebSocket Manager] Async error in onConnection handler for "${name}":`, error)
              if (ws.readyState === ws.OPEN) {
                ws.close(1011, 'Internal server error')
              }
            })
          } catch (error) {
            console.error(`[WebSocket Manager] Error in onConnection handler for "${name}":`, error)
            // Don't close the connection immediately - let it try to work
          }
        }
      } catch (error) {
        console.error(`[WebSocket Manager] Error setting up connection for "${name}":`, error)
        ws.close(1011, 'Internal server error')
      }
    })

    console.log(`[WebSocket Manager] Registered server "${name}" on path "${path}"`)
    return wss
  }

  /**
   * Unregister a WebSocket server
   * @param {string} name - Name of the WebSocket server to unregister
   */
  unregisterServer(name) {
    const serverInfo = this.servers.get(name)
    if (!serverInfo) {
      console.warn(`[WebSocket Manager] Server "${name}" not found`)
      return
    }

    // Close all client connections
    serverInfo.clients.forEach((client) => {
      if (client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.close()
      }
    })

    // Remove path mapping
    this.pathToServer.delete(serverInfo.path)

    // Close the WebSocket server
    serverInfo.wss.close()
    this.servers.delete(name)
    console.log(`[WebSocket Manager] Unregistered server "${name}"`)
  }

  /**
   * Broadcast message to all clients of a specific server
   * @param {string} serverName - Name of the server
   * @param {Object|string} message - Message to broadcast
   */
  broadcast(serverName, message) {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) {
      console.warn(`[WebSocket Manager] Server "${serverName}" not found`)
      return
    }

    const data = typeof message === 'string' ? message : JSON.stringify(message)
    let sentCount = 0

    serverInfo.clients.forEach((client) => {
      if (client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.send(data)
        sentCount++
      }
    })
  }

  /**
   * Send message to a specific client
   * @param {string} serverName - Name of the server
   * @param {string} clientId - ID of the client
   * @param {Object|string} message - Message to send
   */
  sendToClient(serverName, clientId, message) {
    const serverInfo = this.servers.get(serverName)
    if (!serverInfo) {
      console.warn(`[WebSocket Manager] Server "${serverName}" not found`)
      return false
    }

    const client = serverInfo.clients.get(clientId)
    if (!client) {
      console.warn(`[WebSocket Manager] Client "${clientId}" not found on server "${serverName}"`)
      return false
    }

    if (client.ws.readyState === 1) { // WebSocket.OPEN
      const data = typeof message === 'string' ? message : JSON.stringify(message)
      client.ws.send(data)
      return true
    }

    return false
  }

  /**
   * Get server information
   * @param {string} name - Name of the server (optional, returns all if not provided)
   * @returns {Object|Map} Server information
   */
  getServerInfo(name) {
    if (name) {
      const serverInfo = this.servers.get(name)
      if (!serverInfo) return null

      return {
        name: serverInfo.name,
        path: serverInfo.path,
        clientCount: serverInfo.clients.size,
        createdAt: serverInfo.createdAt,
        clients: Array.from(serverInfo.clients.values()).map(client => ({
          id: client.id,
          connectedAt: client.connectedAt,
          ip: client.ip,
          hasToken: !!client.token
        }))
      }
    }

    // Return all servers
    const allServers = {}
    this.servers.forEach((serverInfo, name) => {
      allServers[name] = {
        name: serverInfo.name,
        path: serverInfo.path,
        clientCount: serverInfo.clients.size,
        createdAt: serverInfo.createdAt
      }
    })
    return allServers
  }

  /**
   * Get total number of connected clients across all servers
   * @returns {number}
   */
  getTotalClientCount() {
    let total = 0
    this.servers.forEach((serverInfo) => {
      total += serverInfo.clients.size
    })
    return total
  }

  /**
   * Close all WebSocket servers
   */
  closeAll() {
    console.log('[WebSocket Manager] Closing all WebSocket servers...')
    const serverNames = Array.from(this.servers.keys())
    serverNames.forEach((name) => {
      this.unregisterServer(name)
    })
    console.log('[WebSocket Manager] All WebSocket servers closed')
  }

  /**
   * Get status of all WebSocket servers
   * @returns {Object}
   */
  getStatus() {
    const status = {
      totalServers: this.servers.size,
      totalClients: this.getTotalClientCount(),
      servers: {}
    }

    this.servers.forEach((serverInfo, name) => {
      status.servers[name] = {
        path: serverInfo.path,
        clientCount: serverInfo.clients.size,
        createdAt: serverInfo.createdAt
      }
    })

    return status
  }

  /**
   * Get internal server info (includes direct access to clients map)
   * @param {string} name - Name of the server
   * @returns {Object|null} Internal server info or null if not found
   */
  getInternalServerInfo(name) {
    return this.servers.get(name) || null
  }
}

// Export singleton instance
const webSocketManager = new WebSocketManager()
export default webSocketManager

