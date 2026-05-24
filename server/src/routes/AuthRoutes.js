import express from 'express'
import AuthController from '../controllers/AuthController.js'
import Validator from '../middleware/Validator.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'

/**
 * Authentication routes class
 * Defines all authentication-related routes
 */
class AuthRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  /**
   * Setup all authentication routes
   */
  setupRoutes() {
    // Register route
    this.router.post(
      '/register',
      Validator.validateRegister.bind(Validator),
      AuthController.register.bind(AuthController)
    )

    // Login route
    this.router.post(
      '/login',
      Validator.validateLogin.bind(Validator),
      AuthController.login.bind(AuthController)
    )

    // Forgot password route
    this.router.post(
      '/forgot-password',
      Validator.validateForgotPassword.bind(Validator),
      AuthController.forgotPassword.bind(AuthController)
    )

    // Verify email route
    this.router.post(
      '/verify-email',
      Validator.validateVerifyEmail.bind(Validator),
      AuthController.verifyEmail.bind(AuthController)
    )

    // Resend verification email route
    this.router.post(
      '/resend-verification',
      Validator.validateForgotPassword.bind(Validator),
      AuthController.resendVerificationEmail.bind(AuthController)
    )

    // Verify reset code route
    this.router.post(
      '/verify-reset-code',
      Validator.validateVerifyResetCode.bind(Validator),
      AuthController.verifyResetCode.bind(AuthController)
    )

    // Reset password route
    this.router.post(
      '/reset-password',
      Validator.validateResetPassword.bind(Validator),
      AuthController.resetPassword.bind(AuthController)
    )

    // Validate token route
    this.router.get(
      '/validate',
      AuthController.validateToken.bind(AuthController)
    )

    // Protected profile update routes
    this.router.put(
      '/profile/password',
      AuthMiddleware.authenticate(),
      AuthController.updatePassword.bind(AuthController)
    )

    this.router.put(
      '/profile/name',
      AuthMiddleware.authenticate(),
      AuthController.updateName.bind(AuthController)
    )

    this.router.put(
      '/profile/email',
      AuthMiddleware.authenticate(),
      AuthController.updateEmail.bind(AuthController)
    )
  }

  /**
   * Get router instance
   */
  getRouter() {
    return this.router
  }
}

export default AuthRoutes
