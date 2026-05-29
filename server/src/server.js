import App from './app.js'
import Database from './config/Database.js'
import RoleLoader from './config/RoleLoader.js'
import EconomicNewsScheduler from './services/EconomicNewsScheduler.js'
import tradeseaTradesWebSocket from './websocket/TradeseaTradesWebSocket.js'
import tradeseaMdsWebSocket from './websocket/TradeseaMdsWebSocket.js'
import rithmicMdsWebSocket from './websocket/RithmicMdsWebSocket.js'
import webSocketManager from './websocket/WebSocketManager.js'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import http from 'http'
import { fileURLToPath } from 'url'
import path from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Server class
 * Initializes and starts the Express server
 */
class Server {
  constructor() {
    dotenv.config()
    this.port = process.env.PORT || 3001
    this.app = new App().getApp()
    this.server = null
  }

  /**
   * Initialize database and start the server
   */
  async start() {
    try {
      // Validate roles first - server won't start without roles
      try {
        RoleLoader.load()
      } catch (error) {
        console.error('\n❌ CRITICAL ERROR: Roles validation failed')
        console.error('The server cannot start without at least one role defined.')
        console.error('Default roles could not be loaded. Check server/data/roles.json.\n')
        process.exit(1)
      }

      // Initialize database
      await Database.initialize()

      // Create default admin user if no users exist
      const userCount = await Database.getUserCount()
      if (userCount === 0) {
        console.log('📝 No users found. Creating default admin user...')
        const hashedPassword = await bcrypt.hash('admin', 10)
        await Database.createUser({
          id: 'admin-' + Date.now().toString(),
          name: 'Administrator',
          username: 'admin',
          email: 'admin@example.com',
          password: hashedPassword,
          email_verified: 1, // Verified so they can login immediately
          role: 'admin',
        })
        console.log('✅ Default admin user created:')
        console.log('   Username: admin')
        console.log('   Password: admin')
        console.log('   Role: admin')
        console.log('   ⚠️  Please change the password after first login!')
      }

      // Clean expired tokens on startup
      await Database.cleanExpiredTokens()

      // Get network IP for display
      const os = await import('os')
      const networkInterfaces = os.networkInterfaces()
      let localIp = 'localhost'

      // Find the first non-internal IPv4 address
      for (const interfaceName of Object.keys(networkInterfaces)) {
        const addresses = networkInterfaces[interfaceName]
        for (const address of addresses) {
          if (address.family === 'IPv4' && !address.internal) {
            localIp = address.address
            break
          }
        }
        if (localIp !== 'localhost') break
      }

      // Create HTTP server
      this.server = http.createServer(this.app)

      tradeseaTradesWebSocket.initialize(this.server)
      tradeseaMdsWebSocket.initialize(this.server)
      rithmicMdsWebSocket.initialize(this.server)

      webSocketManager.initialize(this.server, [])

      // Start server on all interfaces (0.0.0.0) to allow network access
      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`🚀 Server running on http://localhost:${this.port}`)
        if (localIp !== 'localhost') {
          console.log(`🌐 Network access: http://${localIp}:${this.port}`)
        }
        console.log(`📝 API endpoints available at http://localhost:${this.port}/api`)
        console.log(`📋 Health check: http://localhost:${this.port}/api/health`)
      })

      // Clean expired tokens every hour
      setInterval(async () => {
        await Database.cleanExpiredTokens()
      }, 3600000) // 1 hour

      // Start Economic News Scheduler
      const economicNewsScheduler = new EconomicNewsScheduler()
      economicNewsScheduler.start()

      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down server...')
        economicNewsScheduler.stop()
        webSocketManager.closeAll()
        await Database.close()
        if (this.server) {
          this.server.close()
        }
        process.exit(0)
      })
    } catch (error) {
      console.error('Failed to start server:', error)
      process.exit(1)
    }
  }
}

export default Server
