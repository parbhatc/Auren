import express from 'express'
import AdminController from '../controllers/AdminController.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'
import PermissionMiddleware from '../middleware/PermissionMiddleware.js'

/**
 * Admin routes class
 * Defines all admin-only routes
 */
class AdminRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  /**
   * Setup all admin routes
   */
  setupRoutes() {
    // Get configuration route (admin only)
    this.router.get(
      '/config',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      AdminController.getConfig.bind(AdminController)
    )

    // Update configuration route (admin only)
    this.router.put(
      '/config',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      AdminController.updateConfig.bind(AdminController)
    )
  }

  /**
   * Get router instance
   */
  getRouter() {
    return this.router
  }
}

export default AdminRoutes

