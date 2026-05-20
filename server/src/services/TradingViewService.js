/**
 * TradingView API Service
 * Main service that composes all component services
 * Handles communication with TradingView API
 * 
 * @module TradingViewService
 * @example
 * import TradingViewService from './services/TradingViewService.js'
 * 
 * // Login to TradingView
 * const result = await TradingViewService.login('username@email.com', 'password')
 * if (result.success) {
 *   console.log('Token:', result.auth_token)
 * }
 * 
 * // Search symbols
 * const searchResults = await TradingViewService.search('AAPL')
 * console.log('Found symbols:', searchResults.symbols)
 */
import AuthService from './tradingview/AuthService.js'
import MarketDataService from './tradingview/MarketDataService.js'
import TradingViewWebSocket from './tradingview/TradingViewWebSocket.js'

class TradingViewService {
  constructor() {
    this.baseURL = 'https://www.tradingview.com'

    // Initialize component services
    this.authService = new AuthService(this.baseURL)
    this.marketDataService = new MarketDataService()
    
    // WebSocket service (lazy initialization - create instance when needed)
    this._webSocketService = null
  }

  /**
   * Login to TradingView
   * @param {string} username - Username or email for login
   * @param {string} password - Password for login
   * @param {boolean} [remember=true] - Whether to remember the session (default: true)
   * @returns {Promise<{success: boolean, error?: string, code?: string, user?: object, auth_token?: string, session_hash?: string}>}
   * @description
   * Authenticates with TradingView and returns authentication token.
   * 
   * Success response includes:
   * - user: User object with profile information
   * - auth_token: JWT token for API authentication
   * - session_hash: Session hash for maintaining session
   * 
   * Error response includes:
   * - error: Error message (e.g., "Invalid username or password")
   * - code: Error code (e.g., "invalid_credentials")
   * 
   * @example
   * const result = await TradingViewService.login('user@example.com', 'password123')
   * if (result.success) {
   *   console.log('Logged in as:', result.user.username)
   *   console.log('Auth token:', result.auth_token)
   * } else {
   *   console.error('Login failed:', result.error)
   * }
   */
  async login(username, password, remember = true) {
    return await this.authService.login(username, password, remember)
  }

  /**
   * Search for symbols on TradingView
   * @param {string} query - Search query text (e.g., "TE", "AAPL", "TSLA")
   * @param {string} [lang='en'] - Language code (default: 'en')
   * @param {string} [exchange=''] - Exchange filter (optional, empty string for all)
   * @param {string} [searchType='undefined'] - Search type filter:
   *   - 'undefined' (default) - All types
   *   - 'stocks' - Stocks only
   *   - 'funds' - Funds only
   *   - 'futures' - Futures only
   *   - 'forex' - Forex only
   *   - 'crypto' - Cryptocurrencies only
   *   - 'index' - Indices only
   *   - 'bond' - Bonds only
   *   - 'economic' - Economic indicators only
   *   - 'options' - Options only
   * @param {string} [sortByCountry='US'] - Sort by country code (default: 'US')
   * @returns {Promise<{symbols: Array, symbols_remaining: number}>}
   * @description
   * Searches TradingView symbol database. No authentication required.
   * 
   * Returns:
   * - symbols: Array of symbol objects with symbol, description, type, exchange, etc.
   * - symbols_remaining: Number of additional symbols available beyond the returned results
   * 
   * @example
   * // Search all types
   * const result = await TradingViewService.search('AAPL')
   * 
   * // Search stocks only
   * const stocks = await TradingViewService.search('AAPL', 'en', '', 'stocks')
   * 
   * // Search futures only
   * const futures = await TradingViewService.search('ES', 'en', '', 'futures')
   */
  async search(query, lang = 'en', exchange = '', searchType = 'undefined', sortByCountry = 'US') {
    return await this.marketDataService.search(query, lang, exchange, searchType, 'production', sortByCountry, true, 1)
  }

  /**
   * Get or create WebSocket service instance
   * @param {Object} [options] - Options for WebSocket service
   * @returns {TradingViewWebSocket} - WebSocket service instance
   */
  getWebSocketService(options = {}) {
    if (!this._webSocketService) {
      this._webSocketService = new TradingViewWebSocket(options)
    }
    return this._webSocketService
  }
}

// Export singleton instance
export default new TradingViewService()
