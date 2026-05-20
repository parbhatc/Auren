import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Translator utility class
 * Handles all user-facing messages and translations
 */
class Translator {
  constructor() {
    this.translations = null
    this.currentLanguage = 'en'
    this.loadTranslations()
  }

  /**
   * Load translations from JSON file
   */
  loadTranslations() {
    try {
      const translationsPath = path.join(__dirname, '../translations/en.json')
      const translationsData = fs.readFileSync(translationsPath, 'utf8')
      this.translations = JSON.parse(translationsData)
    } catch (error) {
      console.error('❌ Error loading translations:', error.message)
      this.translations = {}
    }
  }

  /**
   * Get translation by key path (e.g., 'auth.login.success')
   */
  t(key, defaultValue = null) {
    if (!this.translations) {
      return defaultValue || key
    }

    const keys = key.split('.')
    let value = this.translations

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return defaultValue || key
      }
    }

    return typeof value === 'string' ? value : defaultValue || key
  }

  /**
   * Get translation with parameter replacement
   * Example: t('auth.register.passwordTooShort', { minLength: 6 })
   */
  translate(key, params = {}) {
    let message = this.t(key)

    // Replace parameters in the message
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((param) => {
        const regex = new RegExp(`\\{${param}\\}`, 'g')
        message = message.replace(regex, params[param])
      })
    }

    return message
  }

  /**
   * Get current language
   */
  getLanguage() {
    return this.currentLanguage
  }
}

// Export singleton instance
const translator = new Translator()

export default translator

