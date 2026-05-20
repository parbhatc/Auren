import RoleLoader from '../config/RoleLoader.js'
import Database from '../config/Database.js'
import ErrorHandler from '../middleware/ErrorHandler.js'
import { HTTP_STATUS } from '../config/constants.js'
import translator from '../utils/Translator.js'

/**
 * Permission controller class
 * Handles role and permission management operations
 */
class PermissionController {
  /**
   * Get all roles with their permissions
   */
  getRoles(req, res) {
    try {
      const roles = RoleLoader.getRoles()
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        roles: roles.map(role => ({
          id: role.id,
          name: role.name,
          permissions: role.permissions || [],
        })),
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get a specific role by ID
   */
  getRole(req, res) {
    try {
      const { roleId } = req.params
      const role = RoleLoader.getRoleById(roleId)
      
      if (!role) {
        return ErrorHandler.handleNotFoundError(res, 'Role not found')
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        role: {
          id: role.id,
          name: role.name,
          permissions: role.permissions || [],
        },
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Create a new role
   */
  createRole(req, res) {
    try {
      const { id, name, permissions } = req.body

      if (!id || !name) {
        return ErrorHandler.handleValidationError(res, 'Role ID and name are required')
      }

      if (!permissions || !Array.isArray(permissions)) {
        return ErrorHandler.handleValidationError(res, 'Permissions must be an array')
      }

      // Check if role already exists
      if (RoleLoader.roleExists(id)) {
        return ErrorHandler.handleValidationError(res, 'Role with this ID already exists')
      }

      // Get current roles
      const roles = RoleLoader.getRoles()
      
      // Add new role
      const newRole = {
        id,
        name,
        permissions: permissions.filter(p => typeof p === 'string'),
      }
      
      roles.push(newRole)

      // Save roles
      RoleLoader.saveRoles(roles)

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Role created successfully',
        role: newRole,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Update an existing role
   */
  updateRole(req, res) {
    try {
      const { roleId } = req.params
      const { name, permissions } = req.body

      const role = RoleLoader.getRoleById(roleId)
      if (!role) {
        return ErrorHandler.handleNotFoundError(res, 'Role not found')
      }

      // Get current roles
      const roles = RoleLoader.getRoles()
      const roleIndex = roles.findIndex(r => r.id === roleId)
      
      if (roleIndex === -1) {
        return ErrorHandler.handleNotFoundError(res, 'Role not found')
      }

      // Update role
      if (name) {
        roles[roleIndex].name = name
      }
      if (permissions && Array.isArray(permissions)) {
        roles[roleIndex].permissions = permissions.filter(p => typeof p === 'string')
      }

      // Save roles
      RoleLoader.saveRoles(roles)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Role updated successfully',
        role: roles[roleIndex],
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(req, res) {
    try {
      const { roleId } = req.params

      const role = RoleLoader.getRoleById(roleId)
      if (!role) {
        return ErrorHandler.handleNotFoundError(res, 'Role not found')
      }

      // Check if any users have this role
      const usersWithRole = await Database.findUsersByRole(roleId)
      if (usersWithRole && usersWithRole.length > 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `Cannot delete role. ${usersWithRole.length} user(s) are assigned this role.`,
        })
      }

      // Get current roles
      const roles = RoleLoader.getRoles()
      const filteredRoles = roles.filter(r => r.id !== roleId)

      if (filteredRoles.length === 0) {
        return ErrorHandler.handleValidationError(res, translator.t('roles.cannotDeleteLast'))
      }

      // Save roles
      RoleLoader.saveRoles(filteredRoles)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Role deleted successfully',
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get all available permissions
   */
  getAvailablePermissions(req, res) {
    try {
      const permissions = RoleLoader.getAllAvailablePermissions()
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        permissions,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(req, res) {
    try {
      const { roleId } = req.params
      const users = await Database.findUsersByRole(roleId)
      
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        users: users.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
        })),
        count: users.length,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }
}

export default new PermissionController()

