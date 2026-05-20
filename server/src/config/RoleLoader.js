import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Translator from '../utils/Translator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Role loader class
 * Loads and validates roles from roles.json file
 */
class RoleLoader {
  constructor() {
    this.rolesPath = path.join(__dirname, '../../data/roles.json')
    this.roles = null
  }

  /**
   * Load roles from roles.json
   */
  load() {
    try {
      if (!fs.existsSync(this.rolesPath)) {
        console.error('❌ roles.json not found')
        throw new Error(Translator.t('roles.fileNotFound'))
      }

      const rolesData = fs.readFileSync(this.rolesPath, 'utf8')
      const parsed = JSON.parse(rolesData)

      // Validate structure
      if (!parsed.roles || !Array.isArray(parsed.roles)) {
        throw new Error(Translator.t('roles.invalidStructure'))
      }

      if (parsed.roles.length === 0) {
        throw new Error(Translator.t('roles.notFound'))
      }

      // Validate each role has required fields
      for (const role of parsed.roles) {
        if (!role.id || !role.name) {
          throw new Error(Translator.t('roles.missingFields'))
        }
        
        // Validate permissions array exists and is an array
        if (!role.permissions || !Array.isArray(role.permissions)) {
          throw new Error(Translator.t('roles.missingPermissions'))
        }
        
        // Validate permissions are strings
        for (const permission of role.permissions) {
          if (typeof permission !== 'string') {
            throw new Error(Translator.t('roles.invalidPermissionType'))
          }
        }
      }

      this.roles = parsed.roles
      console.log(`✅ Loaded ${this.roles.length} role(s): ${this.roles.map(r => r.id).join(', ')}`)
      return this.roles
    } catch (error) {
      console.error('❌ Error loading roles.json:', error.message)
      throw error
    }
  }

  /**
   * Get all roles
   */
  getRoles() {
    if (!this.roles) {
      this.roles = this.load()
    }
    return this.roles
  }

  /**
   * Get role by ID
   */
  getRoleById(roleId) {
    if (!this.roles) {
      this.roles = this.load()
    }
    return this.roles.find(role => role.id === roleId)
  }

  /**
   * Check if role exists
   */
  roleExists(roleId) {
    if (!this.roles) {
      this.roles = this.load()
    }
    return this.roles.some(role => role.id === roleId)
  }

  /**
   * Get default role (first role in the list, typically "user")
   */
  getDefaultRole() {
    if (!this.roles) {
      this.roles = this.load()
    }
    return this.roles[0]?.id || 'user'
  }

  /**
   * Check if a role has a specific permission
   * @param {string} roleId - The role ID to check
   * @param {string} permission - The permission to check (e.g., 'user.read', 'admin.*')
   * @returns {boolean} - True if the role has the permission
   */
  hasPermission(roleId, permission) {
    if (!this.roles) {
      this.roles = this.load()
    }

    const role = this.getRoleById(roleId)
    if (!role || !role.permissions) {
      return false
    }

    // Check for wildcard permission (all permissions)
    if (role.permissions.includes('*')) {
      return true
    }

    // Check for exact permission match
    if (role.permissions.includes(permission)) {
      return true
    }

    // Check for wildcard pattern (e.g., 'user.*' matches 'user.read', 'user.write')
    for (const rolePermission of role.permissions) {
      if (rolePermission.endsWith('.*')) {
        const prefix = rolePermission.slice(0, -2)
        if (permission.startsWith(prefix + '.')) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if a role has any of the specified permissions
   * @param {string} roleId - The role ID to check
   * @param {string[]} permissions - Array of permissions to check
   * @returns {boolean} - True if the role has at least one of the permissions
   */
  hasAnyPermission(roleId, permissions) {
    return permissions.some(permission => this.hasPermission(roleId, permission))
  }

  /**
   * Check if a role has all of the specified permissions
   * @param {string} roleId - The role ID to check
   * @param {string[]} permissions - Array of permissions to check
   * @returns {boolean} - True if the role has all of the permissions
   */
  hasAllPermissions(roleId, permissions) {
    return permissions.every(permission => this.hasPermission(roleId, permission))
  }

  /**
   * Get all permissions for a role
   * @param {string} roleId - The role ID
   * @returns {string[]} - Array of permissions for the role
   */
  getRolePermissions(roleId) {
    if (!this.roles) {
      this.roles = this.load()
    }

    const role = this.getRoleById(roleId)
    return role?.permissions || []
  }

  /**
   * Save roles to roles.json file
   * @param {Array} roles - Array of role objects to save
   * @returns {boolean} - True if saved successfully
   */
  saveRoles(roles) {
    try {
      // Validate roles structure
      if (!Array.isArray(roles) || roles.length === 0) {
        throw new Error(Translator.t('roles.notFound'))
      }

      // Validate each role
      for (const role of roles) {
        if (!role.id || !role.name) {
          throw new Error(Translator.t('roles.missingFields'))
        }
        if (!role.permissions || !Array.isArray(role.permissions)) {
          throw new Error(Translator.t('roles.missingPermissions'))
        }
        for (const permission of role.permissions) {
          if (typeof permission !== 'string') {
            throw new Error(Translator.t('roles.invalidPermissionType'))
          }
        }
      }

      // Write to file
      const rolesData = { roles }
      fs.writeFileSync(this.rolesPath, JSON.stringify(rolesData, null, 2), 'utf8')
      
      // Reload roles
      this.roles = null
      this.load()
      
      return true
    } catch (error) {
      console.error('❌ Error saving roles.json:', error.message)
      throw error
    }
  }

  /**
   * Get all available permissions (extracted from all roles)
   * @returns {string[]} - Array of unique permissions
   */
  getAllAvailablePermissions() {
    if (!this.roles) {
      this.roles = this.load()
    }

    const permissionsSet = new Set()
    for (const role of this.roles) {
      if (role.permissions) {
        for (const permission of role.permissions) {
          permissionsSet.add(permission)
        }
      }
    }
    return Array.from(permissionsSet).sort()
  }
}

export default new RoleLoader()

