import AuthService from '../services/AuthService.js'
import ErrorHandler from '../middleware/ErrorHandler.js'
import ConfigLoader from '../config/ConfigLoader.js'
import Translator from '../utils/Translator.js'
import { HTTP_STATUS } from '../config/constants.js'

/**
 * Authentication controller class
 * Handles HTTP requests and responses for authentication endpoints
 */
class AuthController {
  constructor() {
    this.config = ConfigLoader.load()
  }

  /**
   * Register new user
   */
  async register(req, res) {
    try {
      // Check if signup is enabled
      if (this.config.signup?.enabled === false) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: Translator.t('auth.signupDisabled'),
        })
      }

      const { name, username, email, password } = req.body
      const result = await AuthService.register(name, username, email, password)

      return res.status(HTTP_STATUS.CREATED).json(result)
    } catch (error) {
      if (error.message === 'Username or email already exists') {
        return ErrorHandler.handleValidationError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Login user
   */
  async login(req, res) {
    try {
      const { username, password } = req.body
      const result = await AuthService.login(username, password)

      return res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      if (error.message === 'Invalid credentials') {
        return ErrorHandler.handleAuthError(res, error.message)
      }
      if (error.message === 'Please verify your email address before logging in') {
        return ErrorHandler.handleValidationError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Verify email with code
   */
  async verifyEmail(req, res) {
    try {
      const { email, code } = req.body
      const result = await AuthService.verifyEmail(email, code)

      return res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      if (
        error.message === 'Invalid or expired verification code' ||
        error.message === 'User not found'
      ) {
        return ErrorHandler.handleValidationError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(req, res) {
    try {
      const { email } = req.body
      const result = await AuthService.resendVerificationEmail(email)

      return res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      if (
        error.code === 'RESEND_COOLDOWN' ||
        error.message === Translator.t('auth.verifyEmail.userNotFound') ||
        error.message === Translator.t('auth.verifyEmail.alreadyVerified')
      ) {
        return ErrorHandler.handleValidationError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body
      const result = await AuthService.forgotPassword(email)

      return res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      if (error.code === 'RESEND_COOLDOWN') {
        return ErrorHandler.handleValidationError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Verify reset code
   */
  async verifyResetCode(req, res) {
    try {
      const { email, code } = req.body
      const result = await AuthService.verifyResetCode(email, code)

      return res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      if (error.message === 'Invalid or expired reset code') {
        return ErrorHandler.handleValidationError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Reset password with code
   */
  async resetPassword(req, res) {
    try {
      const { email, code, password } = req.body
      const result = await AuthService.resetPassword(email, code, password)

      return res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      if (
        error.message === 'Invalid or expired reset code' ||
        error.message === 'User not found' ||
        error.message.includes('Password must be')
      ) {
        return ErrorHandler.handleValidationError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Validate token and get user information
   */
  async validateToken(req, res) {
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
      const result = await AuthService.validateToken(token)

      return res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      if (
        error.message === 'Invalid or expired token' ||
        error.message === 'User not found'
      ) {
        return ErrorHandler.handleAuthError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Update user password
   */
  async updatePassword(req, res) {
    try {
      const userId = req.user.id
      const { currentPassword, newPassword } = req.body

      if (!currentPassword || !newPassword) {
        return ErrorHandler.handleValidationError(res, Translator.t('validation.passwordRequired'))
      }

      const result = await AuthService.updatePassword(userId, currentPassword, newPassword)
      return res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      // All error messages from AuthService are already translated
      if (error.message) {
        return ErrorHandler.handleValidationError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Update user name
   */
  async updateName(req, res) {
    try {
      const userId = req.user.id
      const { name } = req.body

      if (!name) {
        return ErrorHandler.handleValidationError(res, Translator.t('validation.nameRequired'))
      }

      const result = await AuthService.updateName(userId, name)
      return res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      // All error messages from AuthService are already translated
      if (error.message) {
        return ErrorHandler.handleValidationError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Update user email
   */
  async updateEmail(req, res) {
    try {
      const userId = req.user.id
      const { email } = req.body

      if (!email) {
        return ErrorHandler.handleValidationError(res, Translator.t('validation.emailRequired'))
      }

      const result = await AuthService.updateEmail(userId, email)
      return res.status(HTTP_STATUS.OK).json(result)
    } catch (error) {
      // All error messages from AuthService are already translated
      if (error.message) {
        return ErrorHandler.handleValidationError(res, error.message)
      }
      return ErrorHandler.handleServerError(res, error)
    }
  }
}

export default new AuthController()

