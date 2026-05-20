import TokenService from '../services/TokenService.js'
import Database from '../config/Database.js'
import { HTTP_STATUS } from '../config/constants.js'

/**
 * Authentication middleware class
 * Handles JWT token extraction and validation
 */
class AuthMiddleware {
  /**
   * Middleware to authenticate requests using JWT token
   * Extracts token from Authorization header and validates it
   * Attaches user to request object if valid
   */
  authenticate() {
    return async (req, res, next) => {
      try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'No token provided',
          })
        }

        const token = authHeader.substring(7) // Remove 'Bearer ' prefix

        // Verify token
        const decoded = TokenService.verifyAuthToken(token)
        if (!decoded) {
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'Invalid or expired token',
          })
        }

        // Get user from database
        const user = await Database.findUserById(decoded.userId)
        if (!user) {
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            message: 'User not found',
          })
        }

        // Attach user to request object
        req.user = {
          id: user.id,
          userId: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
        }

        next()
      } catch (error) {
        console.error('Auth middleware error:', error)
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Authentication error',
        })
      }
    }
  }

  /**
   * Optional authentication middleware
   * Attaches user if token is valid, but doesn't fail if token is missing
   */
  optionalAuthenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7)
          const decoded = TokenService.verifyAuthToken(token)
          if (decoded) {
            const user = await Database.findUserById(decoded.userId)
            if (user) {
              req.user = {
                id: user.id,
                userId: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                role: user.role,
              }
            }
          }
        }
        next()
      } catch (error) {
        // Continue even if there's an error
        next()
      }
    }
  }
}

export default new AuthMiddleware()

