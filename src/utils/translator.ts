import enTranslations from '../translations/en.json'

type TranslationKey = string
type Translations = typeof enTranslations

/**
 * Translator utility class
 * Handles all user-facing messages and translations
 */
class Translator {
  private translations: Translations
  private currentLanguage: string = 'en'

  constructor() {
    this.translations = enTranslations
  }

  /**
   * Get translation by key path (e.g., 'auth.login.title')
   * Supports parameter replacement using {paramName} syntax
   */
  t(key: TranslationKey, params?: Record<string, string | number>, defaultValue?: string): string {
    const keys = key.split('.')
    let value: any = this.translations

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k as keyof typeof value]
      } else {
        return defaultValue || key
      }
    }

    let result = typeof value === 'string' ? value : defaultValue || key

    // Replace parameters if provided
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((param) => {
        const regex = new RegExp(`\\{${param}\\}`, 'g')
        result = result.replace(regex, String(params[param]))
      })
    }

    return result
  }

  /**
   * Get translation with fallback
   */
  translate(key: TranslationKey, params?: Record<string, string | number>, fallback?: string): string {
    return this.t(key, params, fallback)
  }

  /**
   * Get current language
   */
  getLanguage(): string {
    return this.currentLanguage
  }

  /**
   * Set language (for future multi-language support)
   */
  setLanguage(lang: string): void {
    if (lang === 'en') {
      this.currentLanguage = 'en'
      this.translations = enTranslations
    }
    // Future: load other language files here
  }
}

// Export singleton instance
export const translator = new Translator()

// Export convenience function
export const t = (key: TranslationKey, params?: Record<string, string | number>, defaultValue?: string): string => {
  return translator.t(key, params, defaultValue)
}

export default translator

