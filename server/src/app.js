import express from 'express'
import CorsMiddleware from './middleware/CorsMiddleware.js'
import Routes from './routes/index.js'

/**
 * Express application class
 * Configures and initializes the Express app
 */
class App {
  constructor() {
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // CORS
    this.app.use(CorsMiddleware.getMiddleware())

    // Body parser - increased limit to handle base64-encoded images
    this.app.use(express.json({ limit: '50mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }))

    // Request logging (optional)
    this.app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`)
      next()
    })
  }

  /**
   * Setup routes
   */
  setupRoutes() {
    const routes = new Routes()
    this.app.use('/api', routes.getRouter())
  }

  /**
   * Get Express app instance
   */
  getApp() {
    return this.app
  }
}

export default App

