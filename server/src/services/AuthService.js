import bcrypt from 'bcryptjs'
import Database from '../config/Database.js'
import TokenService from './TokenService.js'
import EmailService from './EmailService.js'
import ConfigLoader from '../config/ConfigLoader.js'
import RoleLoader from '../config/RoleLoader.js'
import Translator from '../utils/Translator.js'

/**
 * Authentication service class
 * Contains business logic for authentication operations
 */
class AuthService {
  constructor() {
    this.config = ConfigLoader.load()
  }

  /**
   * Register a new user
   */
  async register(name, username, email, password) {
    // Validate password length
    if (password.length < this.config.password.minLength) {
      throw new Error(Translator.translate('auth.register.passwordTooShort', {
        minLength: this.config.password.minLength,
      }))
    }
    if (password.length > this.config.password.maxLength) {
      throw new Error(Translator.translate('auth.register.passwordTooLong', {
        maxLength: this.config.password.maxLength,
      }))
    }

    // Check if user already exists
    if (await Database.userExists(username, email)) {
      throw new Error(Translator.t('auth.register.usernameExists'))
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Get default role
    const defaultRole = RoleLoader.getDefaultRole()

    // Create user (not verified yet)
    const newUser = await Database.createUser({
      id: Date.now().toString(),
      name,
      username,
      email,
      password: hashedPassword,
      email_verified: 0,
      role: defaultRole,
    })

    // Generate verification code
    const verificationCode = TokenService.generateVerificationCode()
    const expiresAt = new Date(
      Date.now() + this.config.verificationCode.expiryMinutes * 60 * 1000
    ).toISOString()

    // Store verification code
    await Database.storeVerificationCode(verificationCode, email, 'email_verification', expiresAt)

    // Send verification email
    try {
      await EmailService.sendVerificationEmail(email, name, verificationCode)
    } catch (error) {
      console.error('Failed to send verification email:', error)
      // Don't fail registration if email fails, but log it
    }

    return {
      success: true,
      message: Translator.t('auth.register.success'),
      requiresVerification: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
    }
  }

  /**
   * Verify email with code
   */
  async verifyEmail(email, code) {
    const storedEmail = await Database.getEmailByVerificationCode(code, 'email_verification')
    
    if (!storedEmail || storedEmail !== email) {
      throw new Error(Translator.t('auth.verifyEmail.invalidCode'))
    }

    // Verify user email
    await Database.verifyUserEmail(email)
    
    // Delete used code
    await Database.deleteVerificationCode(code)

    // Find user
    const user = await Database.findUserByEmail(email)
    if (!user) {
      throw new Error(Translator.t('auth.verifyEmail.userNotFound'))
    }

    // Generate JWT token
    const token = TokenService.generateAuthToken(user.id, user.username)

    return {
      success: true,
      message: Translator.t('auth.verifyEmail.success'),
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    }
  }

  /**
   * Login user
   */
  async login(username, password) {
    // Find user
    const user = await Database.findUserByUsernameOrEmail(username)
    if (!user) {
      throw new Error(Translator.t('auth.login.invalidCredentials'))
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      throw new Error(Translator.t('auth.login.invalidCredentials'))
    }

    // Check if email is verified
    if (!user.email_verified) {
      throw new Error(Translator.t('auth.login.emailNotVerified'))
    }

    // Generate JWT token
    const token = TokenService.generateAuthToken(user.id, user.username)

    return {
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(email) {
    const user = await Database.findUserByEmail(email)

    // Always return success for security (don't reveal if email exists)
    if (user) {
      // Generate reset code
      const resetCode = TokenService.generateResetCode()
      const expiresAt = new Date(
        Date.now() + this.config.resetCode.expiryMinutes * 60 * 1000
      ).toISOString()

      // Store reset code
      await Database.storeVerificationCode(resetCode, email, 'password_reset', expiresAt)

      // Send reset email
      try {
        await EmailService.sendPasswordResetEmail(email, resetCode)
      } catch (error) {
        console.error('Failed to send password reset email:', error)
        // Don't reveal if email exists
      }
    }

    return {
      success: true,
      message: 'If the email exists, a reset code has been sent',
    }
  }

  /**
   * Verify reset code
   */
  async verifyResetCode(email, code) {
    const storedEmail = await Database.getEmailByVerificationCode(code, 'password_reset')
    
    if (!storedEmail || storedEmail !== email) {
      throw new Error(Translator.t('auth.verifyResetCode.invalidCode'))
    }

    return {
      success: true,
      message: 'Reset code verified',
    }
  }

  /**
   * Reset password with code
   */
  async resetPassword(email, code, password) {
    // Validate password length
    if (password.length < this.config.password.minLength) {
      throw new Error(Translator.translate('auth.resetPassword.passwordTooShort', {
        minLength: this.config.password.minLength,
      }))
    }
    if (password.length > this.config.password.maxLength) {
      throw new Error(Translator.translate('auth.resetPassword.passwordTooLong', {
        maxLength: this.config.password.maxLength,
      }))
    }

    // Verify code
    const storedEmail = await Database.getEmailByVerificationCode(code, 'password_reset')
    if (!storedEmail || storedEmail !== email) {
      throw new Error(Translator.t('auth.resetPassword.invalidCode'))
    }

    // Find user
    const user = await Database.findUserByEmail(email)
    if (!user) {
      throw new Error(Translator.t('auth.resetPassword.userNotFound'))
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)
    await Database.updateUserPassword(user.id, hashedPassword)

    // Delete used code
    await Database.deleteVerificationCode(code)

    return {
      success: true,
      message: 'Password reset successfully',
    }
  }

  /**
   * Validate token and get user information
   */
  async validateToken(token) {
    // Verify token
    const decoded = TokenService.verifyAuthToken(token)
    if (!decoded) {
      throw new Error(Translator.t('auth.validateToken.invalidToken'))
    }

    // Get user from database
    const user = await Database.findUserById(decoded.userId)
    if (!user) {
      throw new Error(Translator.t('auth.validateToken.userNotFound'))
    }

    // Get user permissions based on role
    const userRole = user.role || RoleLoader.getDefaultRole()
    const permissions = RoleLoader.getRolePermissions(userRole)
    const hasAdminPermission = RoleLoader.hasPermission(userRole, '*')

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        email_verified: user.email_verified === 1,
        permissions,
        isAdmin: hasAdminPermission,
      },
    }
  }

  /**
   * Update user password
   */
  async updatePassword(userId, currentPassword, newPassword) {
    // Get user
    const user = await Database.findUserById(userId)
    if (!user) {
      throw new Error(Translator.t('auth.updatePassword.userNotFound'))
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)
    if (!isValidPassword) {
      throw new Error(Translator.t('auth.updatePassword.currentPasswordIncorrect'))
    }

    // Validate new password length
    if (newPassword.length < this.config.password.minLength) {
      throw new Error(Translator.translate('auth.updatePassword.passwordTooShort', {
        minLength: this.config.password.minLength,
      }))
    }
    if (newPassword.length > this.config.password.maxLength) {
      throw new Error(Translator.translate('auth.updatePassword.passwordTooLong', {
        maxLength: this.config.password.maxLength,
      }))
    }

    // Check if new password is the same as current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) {
      throw new Error(Translator.t('auth.updatePassword.samePassword'))
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await Database.updateUserPassword(userId, hashedPassword)

    return {
      success: true,
      message: Translator.t('auth.updatePassword.success'),
    }
  }

  /**
   * Update user name
   */
  async updateName(userId, name) {
    // Get user
    const user = await Database.findUserById(userId)
    if (!user) {
      throw new Error(Translator.t('auth.updateName.userNotFound'))
    }

    // Validate name
    if (!name || name.trim().length < 2) {
      throw new Error(Translator.t('auth.updateName.nameTooShort'))
    }

    const trimmedName = name.trim()

    // Check if new name is the same as current name
    if (user.name && user.name.toLowerCase() === trimmedName.toLowerCase()) {
      throw new Error(Translator.t('auth.updateName.sameName'))
    }

    await Database.updateUserName(userId, trimmedName)

    return {
      success: true,
      message: Translator.t('auth.updateName.success'),
    }
  }

  /**
   * Update user email
   */
  async updateEmail(userId, newEmail) {
    // Get user
    const user = await Database.findUserById(userId)
    if (!user) {
      throw new Error(Translator.t('auth.updateEmail.userNotFound'))
    }

    // Validate email format
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
    if (!emailRegex.test(newEmail)) {
      throw new Error(Translator.t('auth.updateEmail.invalidFormat'))
    }

    // Check if new email is the same as current email
    if (user.email && user.email.toLowerCase() === newEmail.toLowerCase()) {
      throw new Error(Translator.t('auth.updateEmail.sameEmail'))
    }

    // Check if email is already taken by another user
    const existingUser = await Database.findUserByEmail(newEmail)
    if (existingUser && existingUser.id !== userId) {
      throw new Error(Translator.t('auth.updateEmail.emailInUse'))
    }

    // Update email (will require verification)
    await Database.updateUserEmail(userId, newEmail)

    // Generate verification code
    const verificationCode = TokenService.generateVerificationCode()
    const expiresAt = new Date(
      Date.now() + this.config.verificationCode.expiryMinutes * 60 * 1000
    ).toISOString()

    // Store verification code
    await Database.storeVerificationCode(verificationCode, newEmail, 'email_verification', expiresAt)

    // Send verification email
    try {
      const user = await Database.findUserById(userId)
      await EmailService.sendVerificationEmail(newEmail, user.name, verificationCode)
    } catch (error) {
      console.error('Failed to send verification email:', error)
    }

    return {
      success: true,
      message: Translator.t('auth.updateEmail.success'),
    }
  }
}

export default new AuthService()

