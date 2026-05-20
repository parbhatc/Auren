import express from 'express'
import PermissionController from '../controllers/PermissionController.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'
import PermissionMiddleware from '../middleware/PermissionMiddleware.js'

/**
 * Permission routes class
 * Defines all permission and role management routes
 */
class PermissionRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  /**
   * Setup all permission routes
   */
  setupRoutes() {
    // Get all roles (admin only)
    this.router.get(
      '/roles',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      PermissionController.getRoles.bind(PermissionController)
    )

    // Get specific role (admin only)
    this.router.get(
      '/roles/:roleId',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      PermissionController.getRole.bind(PermissionController)
    )

    // Create new role (admin only)
    this.router.post(
      '/roles',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      PermissionController.createRole.bind(PermissionController)
    )

    // Update role (admin only)
    this.router.put(
      '/roles/:roleId',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      PermissionController.updateRole.bind(PermissionController)
    )

    // Delete role (admin only)
    this.router.delete(
      '/roles/:roleId',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      PermissionController.deleteRole.bind(PermissionController)
    )

    // Get available permissions (admin only)
    this.router.get(
      '/permissions',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      PermissionController.getAvailablePermissions.bind(PermissionController)
    )

    // Get users by role (admin only)
    this.router.get(
      '/roles/:roleId/users',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      PermissionController.getUsersByRole.bind(PermissionController)
    )
  }

  /**
   * Get router instance
   */
  getRouter() {
    return this.router
  }
}

export default PermissionRoutes

