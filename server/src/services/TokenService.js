import jwt from 'jsonwebtoken'
import ConfigLoader from '../config/ConfigLoader.js'

/**
 * Token service class
 * Handles JWT token generation, reset tokens, and verification codes
 */
class TokenService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    this.config = ConfigLoader.load()
  }

  /**
   * Generate JWT authentication token
   */
  generateAuthToken(userId, username) {
    return jwt.sign(
      { userId, username },
      this.jwtSecret,
      { expiresIn: this.config.jwt.expiresIn }
    )
  }

  /**
   * Generate password reset token
   */
  generateResetToken() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    )
  }

  /**
   * Generate verification code (numeric)
   */
  generateVerificationCode(length = null) {
    const codeLength = length || this.config.verificationCode.length
    let code = ''
    for (let i = 0; i < codeLength; i++) {
      code += Math.floor(Math.random() * 10).toString()
    }
    return code
  }

  /**
   * Generate reset code (numeric)
   */
  generateResetCode(length = null) {
    const codeLength = length || this.config.resetCode.length
    let code = ''
    for (let i = 0; i < codeLength; i++) {
      code += Math.floor(Math.random() * 10).toString()
    }
    return code
  }

  /**
   * Verify JWT token
   */
  verifyAuthToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret)
    } catch (error) {
      return null
    }
  }
}

export default new TokenService()

