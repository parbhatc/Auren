import Database from '../config/Database.js'
import ErrorHandler from '../middleware/ErrorHandler.js'
import { HTTP_STATUS } from '../config/constants.js'
import Translator from '../utils/Translator.js'
import ConfigLoader from '../config/ConfigLoader.js'
import RoleLoader from '../config/RoleLoader.js'
import bcrypt from 'bcryptjs'

/**
 * User controller class
 * Handles user management operations (admin only)
 */
class UserController {
  /**
   * Get all users
   */
  async getAllUsers(req, res) {
    try {
      const users = await Database.getAllUsers()
      
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        users: users.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          email_verified: Boolean(user.email_verified),
          created_at: user.created_at,
        })),
        count: users.length,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get a specific user
   */
  async getUser(req, res) {
    try {
      const { userId } = req.params
      const user = await Database.findUserById(userId)
      
      if (!user) {
        return ErrorHandler.handleNotFound(res, Translator.t('user.notFound'))
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          email_verified: Boolean(user.email_verified),
          created_at: user.created_at,
        },
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Update a user
   */
  async updateUser(req, res) {
    try {
      const { userId } = req.params
      const { name, email, role } = req.body

      // Validate user exists
      const existingUser = await Database.findUserById(userId)
      if (!existingUser) {
        return ErrorHandler.handleNotFound(res, Translator.t('user.notFound'))
      }

      // Validate email if provided
      if (email && email !== existingUser.email) {
        const emailUser = await Database.findUserByEmail(email)
        if (emailUser && emailUser.id !== userId) {
          return ErrorHandler.handleValidationError(res, Translator.t('user.emailExists'))
        }
      }

      // Update user fields only if they're provided and different
      if (name !== undefined && name !== null && name.trim() !== existingUser.name) {
        if (name.trim() === '') {
          return ErrorHandler.handleValidationError(res, Translator.t('user.nameRequired'))
        }
        await Database.updateUserName(userId, name.trim())
      }

      if (email && email !== existingUser.email) {
        await Database.updateUserEmail(userId, email)
      }

      if (role && role !== existingUser.role) {
        if (!RoleLoader.roleExists(role)) {
          return ErrorHandler.handleValidationError(res, 'Invalid role')
        }
        await Database.updateUserRole(userId, role)
      }

      const updatedUser = await Database.findUserById(userId)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: Translator.t('user.updateSuccess'),
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          email_verified: Boolean(updatedUser.email_verified),
          created_at: updatedUser.created_at,
        },
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(req, res) {
    try {
      const { userId } = req.params
      const currentUserId = req.user.id

      // Prevent self-deletion
      if (userId === currentUserId) {
        return ErrorHandler.handleValidationError(res, Translator.t('user.cannotDeleteSelf'))
      }

      // Check if user exists
      const user = await Database.findUserById(userId)
      if (!user) {
        return ErrorHandler.handleNotFound(res, Translator.t('user.notFound'))
      }

      await Database.deleteUser(userId)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: Translator.t('user.deleteSuccess'),
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Reset user password (admin only)
   */
  async resetUserPassword(req, res) {
    try {
      const { userId } = req.params
      const { newPassword } = req.body

      if (!newPassword || newPassword.length < 6) {
        return ErrorHandler.handleValidationError(res, Translator.t('user.passwordTooShort'))
      }

      const user = await Database.findUserById(userId)
      if (!user) {
        return ErrorHandler.handleNotFound(res, Translator.t('user.notFound'))
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10)
      await Database.updateUserPassword(userId, hashedPassword)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: Translator.t('user.passwordResetSuccess'),
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Create a new user (admin only)
   */
  async createUser(req, res) {
    try {
      const { name, username, email, password, role } = req.body

      // Validate required fields
      if (!name || !username || !email || !password) {
        return ErrorHandler.handleValidationError(res, Translator.t('validation.required'))
      }

      // Validate password length
      const config = ConfigLoader.load()
      if (password.length < config.password.minLength) {
        return ErrorHandler.handleValidationError(res, Translator.translate('auth.register.passwordTooShort', {
          minLength: config.password.minLength,
        }))
      }
      if (password.length > config.password.maxLength) {
        return ErrorHandler.handleValidationError(res, Translator.translate('auth.register.passwordTooLong', {
          maxLength: config.password.maxLength,
        }))
      }

      // Check if user already exists
      if (await Database.userExists(username, email)) {
        return ErrorHandler.handleValidationError(res, Translator.t('auth.register.usernameExists'))
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Get default role if not provided
      const userRole = role || RoleLoader.getDefaultRole()
      if (!RoleLoader.roleExists(userRole)) {
        return ErrorHandler.handleValidationError(res, 'Invalid role')
      }

      // Create user (verified by default for admin-created users)
      const newUser = await Database.createUser({
        id: `user-${Date.now()}`,
        name,
        username,
        email,
        password: hashedPassword,
        email_verified: 1, // Admin-created users are verified
        role: userRole,
      })

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: Translator.t('user.createSuccess'),
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          email_verified: Boolean(newUser.email_verified),
          created_at: newUser.created_at,
        },
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }
}

export default new UserController()

