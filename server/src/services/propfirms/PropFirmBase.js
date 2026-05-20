/**
 * Base class for Prop Firms (Backend)
 */
export class PropFirmBase {
  /**
   * Test connection to the prop firm
   * @param {Object} credentials - The credentials to test
   * @returns {Promise<Object>} - Result with success, message, and optional token
   */
  async testConnection(credentials) {
    throw new Error('testConnection must be implemented by subclass')
  }
}

