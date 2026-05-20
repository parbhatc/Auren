/**
 * Utility functions for TradingView services
 */

/**
 * Generate a random alphanumeric string
 * @param {number} [length=12] - Length of the string to generate
 * @returns {string} - Random alphanumeric string
 */
export function generateRandomString(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
