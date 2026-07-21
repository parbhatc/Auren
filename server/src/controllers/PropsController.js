/**
 * Props Controller
 * Handles prop firm credential management
 */
import Database from '../config/Database.js'
import ErrorHandler from '../middleware/ErrorHandler.js'
import { HTTP_STATUS } from '../config/constants.js'
import Translator from '../utils/Translator.js'

const SUPPORTED_PROP_FIRM_TYPES = ['tradesea', 'custom']

class PropsController {
  /**
   * Initialize database table if it doesn't exist
   */
  async initializeTable() {
    await Database.run(`
      CREATE TABLE IF NOT EXISTS prop_firms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        credentials_encrypted TEXT NOT NULL,
        token TEXT,
        session_id TEXT,
        expiration TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, type),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
    
    // Add token and session_id columns if they don't exist (for existing databases)
    try {
      await Database.run(`ALTER TABLE prop_firms ADD COLUMN token TEXT`)
    } catch (err) {
      // Column already exists, ignore error
    }
    
    try {
      await Database.run(`ALTER TABLE prop_firms ADD COLUMN session_id TEXT`)
    } catch (err) {
      // Column already exists, ignore error
    }
    
    try {
      await Database.run(`ALTER TABLE prop_firms ADD COLUMN expiration TEXT`)
    } catch (err) {
      // Column already exists, ignore error
    }
  }

  /**
   * Encrypt credentials
   */
  async encryptCredentials(credentials) {
    // For now, simple base64 encoding (in production, use proper encryption)
    const credentialsJson = JSON.stringify(credentials)
    return Buffer.from(credentialsJson).toString('base64')
  }

  /**
   * Decrypt credentials
   */
  decryptCredentials(encrypted) {
    try {
      const credentialsJson = Buffer.from(encrypted, 'base64').toString('utf-8')
      return JSON.parse(credentialsJson)
    } catch (error) {
      return {}
    }
  }

  /**
   * Get all prop firms for the current user
   */
  async getPropFirms(req, res) {
    try {
      await this.initializeTable()
      const userId = req.user.id

      const propFirms = await Database.query(
        'SELECT id, user_id, type, name, display_name, enabled, created_at, updated_at FROM prop_firms WHERE user_id = ?',
        [userId]
      )

      const result = propFirms.filter(firm => SUPPORTED_PROP_FIRM_TYPES.includes(firm.type)).map(firm => ({
        id: firm.id.toString(),
        type: firm.type,
        name: firm.name,
        displayName: firm.display_name,
        enabled: firm.enabled === 1,
        credentials: {} // Don't return credentials in list
      }))

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        propFirms: result
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get a specific prop firm by type
   */
  async getPropFirm(req, res) {
    try {
      await this.initializeTable()
      const userId = req.user.id
      const type = req.params.type

      if (!SUPPORTED_PROP_FIRM_TYPES.includes(type)) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          propFirm: null,
          message: Translator.t('props.firmNotFound')
        })
      }

      const firm = await Database.get(
        'SELECT * FROM prop_firms WHERE user_id = ? AND type = ?',
        [userId, type]
      )

      if (!firm) {
        // Return success: true with null propFirm when firm doesn't exist
        // This allows frontend to handle it gracefully
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          propFirm: null,
          message: Translator.t('props.firmNotFound')
        })
      }

      const credentials = this.decryptCredentials(firm.credentials_encrypted)

      // Build prop firm response
      const propFirmResponse = {
        id: firm.id.toString(),
        type: firm.type,
        name: firm.name,
        displayName: firm.display_name,
        enabled: firm.enabled === 1,
        credentials: credentials,
        token: firm.token || null,
        expiration: firm.expiration || null,
        createdAt: firm.created_at,
        updatedAt: firm.updated_at
      }

      propFirmResponse.sessionId = firm.session_id || null

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        propFirm: propFirmResponse
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Create or update prop firm credentials
   */
  async savePropFirm(req, res) {
    try {
      await this.initializeTable()
      const userId = req.user.id
      // Get type from body or params (for PUT requests)
      const type = req.body.type || req.params.type
      const { credentials } = req.body

      if (!type || !credentials) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: Translator.t('props.invalidData')
        })
      }

      // Validate prop firm type
      if (!SUPPORTED_PROP_FIRM_TYPES.includes(type)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: Translator.t('props.invalidType')
        })
      }

      // Get display name
      const displayNames = {
        tradesea: 'Tradesea',
        custom: 'Custom',
      }

      const encryptedCredentials = await this.encryptCredentials(credentials)

      // Check if prop firm already exists
      const existing = await Database.get(
        'SELECT id FROM prop_firms WHERE user_id = ? AND type = ?',
        [userId, type]
      )

      if (existing) {
        // Update existing (preserve token and session_id if not provided)
        await Database.run(
          'UPDATE prop_firms SET credentials_encrypted = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [encryptedCredentials, existing.id]
        )

        return res.status(HTTP_STATUS.OK).json({
          success: true,
          message: Translator.t('props.updatedSuccessfully')
        })
      } else {
        // Create new
        await Database.run(
          'INSERT INTO prop_firms (user_id, type, name, display_name, enabled, credentials_encrypted) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, type, type, displayNames[type] || type, 1, encryptedCredentials]
        )

        return res.status(HTTP_STATUS.CREATED).json({
          success: true,
          message: Translator.t('props.createdSuccessfully')
        })
      }
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Delete prop firm credentials
   */
  async deletePropFirm(req, res) {
    try {
      await this.initializeTable()
      const userId = req.user.id
      const type = req.params.type

      // Check if firm exists first (Database.run doesn't reliably return .changes)
      const existing = await Database.get(
        'SELECT id FROM prop_firms WHERE user_id = ? AND type = ?',
        [userId, type]
      )
      if (!existing) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: Translator.t('props.firmNotFound')
        })
      }

      await Database.run(
        'DELETE FROM prop_firms WHERE user_id = ? AND type = ?',
        [userId, type]
      )

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: Translator.t('props.deletedSuccessfully')
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Save token for prop firm (called after frontend tests connection)
   */
  async saveToken(req, res) {
    try {
      await this.initializeTable()
      const userId = req.user.id
      const type = req.params.type
      const { token, sessionId, expiration } = req.body

      // Token is optional - allow saving just sessionId and expiration for some prop firms
      // At least one of token, sessionId, or expiration should be provided
      if (!token && !sessionId && !expiration) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'At least one of token, sessionId, or expiration is required'
        })
      }

      // Check if prop firm exists
      const firm = await Database.get(
        'SELECT id FROM prop_firms WHERE user_id = ? AND type = ?',
        [userId, type]
      )

      if (!firm) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: Translator.t('props.firmNotFound')
        })
      }

      // Update token, session_id, and expiration (allow null values)
      await Database.run(
        'UPDATE prop_firms SET token = ?, session_id = ?, expiration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [token || null, sessionId || null, expiration || null, firm.id]
      )

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: Translator.t('props.connectionSuccessful')
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }
}

export default new PropsController()

