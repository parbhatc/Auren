/**
 * Props routes class
 * Defines all prop firm credential management routes
 */
import express from 'express'
import PropsController from '../controllers/PropsController.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'

class PropsRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  /**
   * Setup all props routes
   */
  setupRoutes() {
    // Get all prop firms for current user
    this.router.get(
      '/',
      AuthMiddleware.authenticate(),
      PropsController.getPropFirms.bind(PropsController)
    )

    // Get specific prop firm by type
    this.router.get(
      '/:type',
      AuthMiddleware.authenticate(),
      PropsController.getPropFirm.bind(PropsController)
    )

    // Create or update prop firm credentials
    this.router.post(
      '/',
      AuthMiddleware.authenticate(),
      PropsController.savePropFirm.bind(PropsController)
    )

    // Update prop firm credentials
    this.router.put(
      '/:type',
      AuthMiddleware.authenticate(),
      PropsController.savePropFirm.bind(PropsController)
    )

    // Delete prop firm credentials
    this.router.delete(
      '/:type',
      AuthMiddleware.authenticate(),
      PropsController.deletePropFirm.bind(PropsController)
    )

    // Save token for prop firm (after frontend tests connection)
    this.router.post(
      '/:type/token',
      AuthMiddleware.authenticate(),
      PropsController.saveToken.bind(PropsController)
    )

    this.router.post(
      '/:type/session',
      AuthMiddleware.authenticate(),
      PropsController.saveToken.bind(PropsController)
    )
  }

  /**
   * Get router instance
   */
  getRouter() {
    return this.router
  }
}

export default PropsRoutes

