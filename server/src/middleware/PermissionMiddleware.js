import RoleLoader from '../config/RoleLoader.js'
import Database from '../config/Database.js'
import { HTTP_STATUS } from '../config/constants.js'

/**
 * Permission middleware class
 * Handles permission checking for routes
 */
class PermissionMiddleware {
  /**
   * Middleware to check if user has required permission
   * @param {string|string[]} requiredPermission - Single permission or array of permissions
   * @param {string} mode - 'any' (default) or 'all' - check if user has any or all permissions
   * @returns {Function} Express middleware function
   */
  requirePermission(requiredPermission, mode = 'any') {
    return async (req, res, next) => {
      try {
        // Get user from request (assuming user is attached by auth middleware)
        const userId = req.user?.id || req.user?.userId

        if (!userId) {
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication required',
          })
        }

        // Get user from database to get their role
        const user = await Database.findUserById(userId)
        if (!user) {
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'User not found',
          })
        }

        const userRole = user.role || RoleLoader.getDefaultRole()

        // Convert single permission to array
        const permissions = Array.isArray(requiredPermission)
          ? requiredPermission
          : [requiredPermission]

        // Check permissions based on mode
        let hasPermission = false
        if (mode === 'all') {
          hasPermission = RoleLoader.hasAllPermissions(userRole, permissions)
        } else {
          hasPermission = RoleLoader.hasAnyPermission(userRole, permissions)
        }

        if (!hasPermission) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'Insufficient permissions',
          })
        }

        // User has required permission, continue
        next()
      } catch (error) {
        console.error('Permission check error:', error)
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Error checking permissions',
        })
      }
    }
  }

  /**
   * Middleware to check if user has admin role
   * @returns {Function} Express middleware function
   */
  requireAdmin() {
    return this.requirePermission('*', 'any')
  }
}

export default new PermissionMiddleware()

