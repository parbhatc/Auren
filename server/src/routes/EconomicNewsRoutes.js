import express from 'express'
import EconomicNewsController from '../controllers/EconomicNewsController.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'

/**
 * Economic News routes class
 * Defines all economic news-related routes
 */
class EconomicNewsRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  /**
   * Setup all economic news routes
   */
  setupRoutes() {
    // Get economic events (authenticated users)
    this.router.get(
      '/events',
      AuthMiddleware.authenticate(),
      EconomicNewsController.getEvents.bind(EconomicNewsController)
    )

    // Force refresh events (authenticated users)
    this.router.post(
      '/events/refresh',
      AuthMiddleware.authenticate(),
      EconomicNewsController.refreshEvents.bind(EconomicNewsController)
    )
  }

  /**
   * Get router instance
   */
  getRouter() {
    return this.router
  }
}

export default EconomicNewsRoutes

