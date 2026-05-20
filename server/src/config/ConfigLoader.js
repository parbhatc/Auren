import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Configuration loader class
 * Loads configuration from config.json file
 */
class ConfigLoader {
  constructor() {
    this.configPath = path.join(__dirname, '../../data/config.json')
    this.config = null
    this.loaded = false
  }

  /**
   * Load configuration from config.json (only loads once, caches result)
   */
  load() {
    // Return cached config if already loaded
    if (this.loaded && this.config) {
      return this.config
    }

    try {
      if (!fs.existsSync(this.configPath)) {
        console.warn('⚠️  config.json not found, using defaults')
        this.config = this.getDefaultConfig()
        this.loaded = true
        return this.config
      }

      const configData = fs.readFileSync(this.configPath, 'utf8')
      this.config = JSON.parse(configData)
      this.loaded = true
      console.log('✅ Configuration loaded from config.json')
      return this.config
    } catch (error) {
      console.error('❌ Error loading config.json:', error.message)
      console.log('Using default configuration')
      this.config = this.getDefaultConfig()
      this.loaded = true
      return this.config
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      password: {
        minLength: 6,
        maxLength: 128,
      },
      signup: {
        enabled: true,
      },
      verificationCode: {
        length: 6,
        expiryMinutes: 15,
      },
      resetCode: {
        length: 6,
        expiryMinutes: 30,
      },
      email: {
        from: 'NexusSync <noreply@nexussync.com>',
        appName: 'NexusSync',
        appUrl: 'http://localhost:2000',
        supportEmail: 'support@nexussync.com',
      },
      jwt: {
        expiresIn: '7d',
      },
      resetToken: {
        expiryHours: 1,
      },
    }
  }

  /**
   * Force reload configuration (clears cache)
   */
  reload() {
    this.loaded = false
    this.config = null
    return this.load()
  }

  /**
   * Get configuration value
   */
  get(path) {
    if (!this.loaded) {
      this.load()
    }
    return this.getNestedValue(this.config, path)
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
}

export default new ConfigLoader()

