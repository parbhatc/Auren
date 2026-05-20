import express from 'express'
import UserController from '../controllers/UserController.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'
import PermissionMiddleware from '../middleware/PermissionMiddleware.js'

/**
 * User routes class
 * Defines all user management routes (admin only)
 */
class UserRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  /**
   * Setup all user management routes
   */
  setupRoutes() {
    // Create a new user (admin only)
    this.router.post(
      '/',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      UserController.createUser.bind(UserController)
    )

    // Get all users (admin only)
    this.router.get(
      '/',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      UserController.getAllUsers.bind(UserController)
    )

    // Get a specific user (admin only)
    this.router.get(
      '/:userId',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      UserController.getUser.bind(UserController)
    )

    // Update a user (admin only)
    this.router.put(
      '/:userId',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      UserController.updateUser.bind(UserController)
    )

    // Delete a user (admin only)
    this.router.delete(
      '/:userId',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      UserController.deleteUser.bind(UserController)
    )

    // Reset user password (admin only)
    this.router.post(
      '/:userId/reset-password',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      UserController.resetUserPassword.bind(UserController)
    )
  }

  /**
   * Get router instance
   */
  getRouter() {
    return this.router
  }
}

export default UserRoutes

