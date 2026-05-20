import ConfigLoader from '../config/ConfigLoader.js'
import ErrorHandler from '../middleware/ErrorHandler.js'
import { HTTP_STATUS } from '../config/constants.js'
import translator from '../utils/Translator.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Admin controller class
 * Handles admin-only operations like config management
 */
class AdminController {
  constructor() {
    this.configPath = path.join(__dirname, '../../data/config.json')
  }

  /**
   * Get current configuration
   */
  getConfig(req, res) {
    try {
      const config = ConfigLoader.load()
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        config,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Update configuration
   */
  updateConfig(req, res) {
    try {
      const { config } = req.body

      if (!config || typeof config !== 'object') {
        return ErrorHandler.handleValidationError(res, translator.t('admin.invalidConfiguration'))
      }

      // Validate config structure - merge with current config to preserve structure
      const currentConfig = ConfigLoader.load()
      const mergedConfig = { ...currentConfig, ...config }

      // Write to file
      fs.writeFileSync(this.configPath, JSON.stringify(mergedConfig, null, 2), 'utf8')

      // Force reload config to clear cache
      ConfigLoader.reload()

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Configuration updated successfully',
        config: mergedConfig,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }
}

export default new AdminController()

