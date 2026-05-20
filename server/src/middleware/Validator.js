import { HTTP_STATUS } from '../config/constants.js'
import ConfigLoader from '../config/ConfigLoader.js'

/**
 * Request validation middleware class
 */
class Validator {
  constructor() {
    this.config = ConfigLoader.load()
  }

  /**
   * Validate register request
   */
  validateRegister(req, res, next) {
    const { name, username, email, password } = req.body

    if (!name || !username || !email || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'All fields are required',
      })
    }

    if (name.length < 2) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Name must be at least 2 characters',
      })
    }

    if (password.length < this.config.password.minLength) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Password must be at least ${this.config.password.minLength} characters`,
      })
    }

    if (password.length > this.config.password.maxLength) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Password must be no more than ${this.config.password.maxLength} characters`,
      })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid email format',
      })
    }

    next()
  }

  /**
   * Validate login request
   */
  validateLogin(req, res, next) {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Username and password are required',
      })
    }

    next()
  }

  /**
   * Validate forgot password request
   */
  validateForgotPassword(req, res, next) {
    const { email } = req.body

    if (!email) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Email is required',
      })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid email format',
      })
    }

    next()
  }

  /**
   * Validate verify email request
   */
  validateVerifyEmail(req, res, next) {
    const { email, code } = req.body

    if (!email || !code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Email and verification code are required',
      })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid email format',
      })
    }

    if (!/^\d+$/.test(code)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Verification code must be numeric',
      })
    }

    next()
  }

  /**
   * Validate verify reset code request
   */
  validateVerifyResetCode(req, res, next) {
    const { email, code } = req.body

    if (!email || !code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Email and reset code are required',
      })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid email format',
      })
    }

    if (!/^\d+$/.test(code)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Reset code must be numeric',
      })
    }

    next()
  }

  /**
   * Validate reset password request
   */
  validateResetPassword(req, res, next) {
    const { email, code, password } = req.body

    if (!email || !code || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Email, code, and password are required',
      })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid email format',
      })
    }

    if (!/^\d+$/.test(code)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Reset code must be numeric',
      })
    }

    if (password.length < this.config.password.minLength) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Password must be at least ${this.config.password.minLength} characters`,
      })
    }

    if (password.length > this.config.password.maxLength) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Password must be no more than ${this.config.password.maxLength} characters`,
      })
    }

    next()
  }
}

export default new Validator()

