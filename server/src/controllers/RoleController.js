import RoleLoader from '../config/RoleLoader.js'
import { HTTP_STATUS } from '../config/constants.js'

/**
 * Role controller class
 * Handles role-related endpoints
 */
class RoleController {
  /**
   * Get roles status
   * Returns whether roles are available
   */
  getRolesStatus(req, res) {
    try {
      const roles = RoleLoader.getRoles()
      
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        hasRoles: roles.length > 0,
        rolesCount: roles.length,
        roles: roles.map(role => ({
          id: role.id,
          name: role.name,
        })),
      })
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        hasRoles: false,
        error: error.message,
      })
    }
  }
}

export default new RoleController()

