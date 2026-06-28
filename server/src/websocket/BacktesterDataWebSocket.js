import WebSocketBase from './WebSocketBase.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { listAllCsvFiles } from '../utils/backtesterCsvPaths.js'
import TopstepDataHandler from './handlers/TopstepDataHandler.js'
import TradingViewDataHandler from './handlers/TradingViewDataHandler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class BacktesterDataWebSocket extends WebSocketBase {

  constructor(server) {
    super({
      serverName: 'backtester-data',
      path: '/backtester/data-management-ws',
      enableHeartbeat: true,
      heartbeatInterval: 5000,
      heartbeatTimeout: 15000,
      pingMessage: 'ServerTime',
      pongMessage: 'ClientTime'
    })
    this.currentTab = null
    this.server = server
    this.configPath = path.join(__dirname, '../../data/backtester/config.json')
    this.csvDir = path.join(__dirname, '../../data/backtester/csv')
    
    // Store progress state for all operations
    this.progressState = new Map() // Map<operationKey, progressData>
    
    // Track active operations to prevent duplicates
    this.activeOperations = new Set() // Set<operationKey>
    
    // Initialize data handlers
    this.topstepHandler = new TopstepDataHandler(this)
    this.tradingViewHandler = new TradingViewDataHandler(this)
  }

  /**
   * Override sendWelcomeMessage to send initial data on connection
   */
  sendWelcomeMessage(ws) {
    // Send initial data including tokens, symbols, and CSV files
    this.sendInitialData(ws)
  }

  /**
   * Send initial data to client (tokens, symbols, CSV files)
   */
  async sendInitialData(ws) {
    try {
      // Load config
      let config = {}
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8')
        config = JSON.parse(configData)
      }

      // Get tokens
      const tokens = config.tokens || {}

      // Get symbols
      const symbols = config.symbols || {}

      // Get all CSV files (including unknown ones)
      const allFiles = this.getAllCSVFiles()
      
      // Filter files by config.json and type
      const csvFiles = {
        topstep: this.filterFilesByConfig(allFiles, 'topstep', config),
        tradingview: this.filterFilesByConfig(allFiles, 'tradingview', config),
        unknown: this.getUnknownFiles(allFiles, config)
      }
      // Send initial data message
      this.send(ws, {
        type: 'initial_data',
        success: true,
        data: {
          tokens,
          symbols,
          csvFiles
        }
      })

      // Send current progress state to newly connected client
      if (this.progressState.size > 0) {
        for (const [key, progressData] of this.progressState.entries()) {
          this.send(ws, {
            type: 'progress',
            action: progressData.action,
            symbol: progressData.symbol,
            source: progressData.source,
            progress: 0, // Always 0, no percentage
            message: progressData.message
          })
        }
      }
    } catch (error) {
      console.error('[backtester-data WS] Error sending initial data:', error.message)
      this.send(ws, {
        type: 'initial_data',
        success: false,
        error: 'Failed to load initial data'
      })
    }
  }

  /**
   * Get all CSV files from all directories (no filtering)
   */
  getAllCSVFiles() {
    try {
      return listAllCsvFiles(this.csvDir)
    } catch (error) {
      console.error(`[backtester-data WS] Error getting all CSV files:`, error.message)
      return []
    }
  }

  /**
   * Filter files by config.json and type
   * Only includes files for symbols that exist in config.json with matching type
   */
  filterFilesByConfig(allFiles, type, config) {
    const symbols = config.symbols || {}
    
    return allFiles.filter(file => {
      const fileSymbol = file.symbol
      
      // Check if symbol exists in config
      // For Topstep: normalize symbol (remove leading slash for comparison)
      if (type === 'topstep') {
        const normalizedFileSymbol = fileSymbol.startsWith('/') ? fileSymbol.slice(1) : fileSymbol
        
        // Check if symbol exists in config (with or without slash)
        const configEntry = symbols[normalizedFileSymbol] || symbols[`/${normalizedFileSymbol}`]
        
        // Must exist in config AND match type (or have no type specified, default to topstep)
        return configEntry && (configEntry.type === 'topstep' || !configEntry.type)
      }
      
      // For TradingView: check exact match and double underscore format
      if (type === 'tradingview') {
        // Check exact symbol match
        const configEntry = symbols[fileSymbol]
        if (configEntry && configEntry.type === 'tradingview') {
          return true
        }
        
        // Also check if symbol matches any config entry's double underscore format
        for (const [configSymbol, configData] of Object.entries(symbols)) {
          if (configData.type === 'tradingview' && configSymbol === fileSymbol) {
            return true
          }
        }
        
        return false
      }
      
      return false
    })
  }

  /**
   * Get files that are not in config.json (unknown files)
   */
  getUnknownFiles(allFiles, config) {
    const symbols = config.symbols || {}
    const configSymbols = new Set(Object.keys(symbols))
    
    return allFiles.filter(file => {
      const fileSymbol = file.symbol
      
      // For Topstep: normalize symbol (remove leading slash for comparison)
      const normalizedFileSymbol = fileSymbol.startsWith('/') ? fileSymbol.slice(1) : fileSymbol
      
      // Check if symbol exists in config (with or without slash)
      const inConfig = configSymbols.has(normalizedFileSymbol) || configSymbols.has(`/${normalizedFileSymbol}`) || configSymbols.has(fileSymbol)
      
      return !inConfig
    })
  }

  /**
   * Get CSV files by type (for backward compatibility with API endpoints)
   * Now filters by config.json
   */
  getCSVFilesByType(type, config) {
    const allFiles = this.getAllCSVFiles()
    return this.filterFilesByConfig(allFiles, type, config)
  }

  onMessage(ws, data, clientInfo, serverInfo) {
    if (!data || typeof data !== 'object' || !data.type) {
      console.log('[backtester WS] Unhandled message:', data)
      return
    }

    switch (data.type) {
      case 'tab_change':
        this.onTabChange(ws, data, clientInfo, serverInfo)
        break
      case 'search':
        this.onSearch(ws, data, clientInfo, serverInfo)
        break
      case 'save-token':
        this.onSaveToken(ws, data, clientInfo, serverInfo)
        break
      case 'user_login':
        this.onUserLogin(ws, data, clientInfo, serverInfo)
        break
      case 'download':
        this.onDownload(ws, data, clientInfo, serverInfo)
        break
      case 'update':
        this.onUpdate(ws, data, clientInfo, serverInfo)
        break
      case 'overwrite':
        this.onOverwrite(ws, data, clientInfo, serverInfo)
        break
      case 'reset':
        this.onReset(ws, data, clientInfo, serverInfo)
        break
      default:
        console.log('[backtester WS] Unhandled message type:', data.type)
    }
  }

  onTabChange(ws, data, clientInfo, serverInfo) {
    const { tab } = data
    this.currentTab = tab
    console.log('[backtester-data WS] Tab changed to:', tab)
    this.send(ws, {
      type: 'tab_change_response',
      success: true,
      tab: tab
    })
  }

  async onSearch(ws, data, clientInfo, serverInfo) {
    const { search: searchQuery, token, searchType } = data
    console.log('[backtester-data WS] Search:', searchQuery, 'Token:', token ? 'provided' : 'not provided', 'SearchType:', searchType || 'undefined')
    
    try {
      // Get token from request or from config based on current tab
      let authToken = token
      if (!authToken && this.currentTab) {
        // Load config to get saved token
        let config = {}
        if (fs.existsSync(this.configPath)) {
          const configData = fs.readFileSync(this.configPath, 'utf8')
          config = JSON.parse(configData)
        }
        authToken = config.tokens?.[this.currentTab] || ''
      }

      // Handle search based on current tab
      if (this.currentTab === 'topstep' && authToken && searchQuery) {
        // TopstepX search requires token
        const TopstepXService = (await import('../services/TopstepXService.js')).default
        
        const results = await TopstepXService.search(authToken, searchQuery, 30, '', false)
        
        // Normalize type: "Future" or "future" should be "futures"
        const normalizedResults = (results || []).map(result => {
          if (result && typeof result === 'object' && result.type) {
            const normalizedType = result.type.toLowerCase()
            if (normalizedType === 'future') {
              return { ...result, type: 'futures' }
            }
          }
          return result
        })
        
        this.send(ws, {
          type: 'search_response',
          success: true,
          results: normalizedResults
        })
      } else if (this.currentTab === 'tradingview' && searchQuery) {
        // TradingView search doesn't require token
        // searchType can be: undefined, stocks, funds, futures, forex, crypto, index, bond, economic, options
        const TradingViewService = (await import('../services/TradingViewService.js')).default
        
        const result = await TradingViewService.search(searchQuery, 'en', '', searchType || 'undefined')
        
        // Extract symbols array from response and format as source_id:symbol
        const formattedResults = {}
        const symbols = (result?.symbols || []).map(symbolData => {
          // Remove <em> tags from symbol if present
          const cleanSymbol = symbolData.symbol?.replace(/<[^>]*>/g, '') || symbolData.symbol
          
          // Format as source_id:symbol if source_id exists
          const formattedSymbol = symbolData.source_id 
            ? `${symbolData.source_id}:${cleanSymbol}`
            : cleanSymbol
          
          // Create entry in formattedResults map with source_id:symbol as key
          if (symbolData.source_id) {
            formattedResults[formattedSymbol] = {
              ...symbolData,
              symbol: cleanSymbol,
              formattedSymbol: formattedSymbol
            }
          }
          
          return {
            ...symbolData,
            symbol: cleanSymbol,
            formattedSymbol: formattedSymbol
          }
        })
        
        this.send(ws, {
          type: 'search_response',
          success: true,
          results: symbols,
          symbols_remaining: result?.symbols_remaining || 0,
          formattedResults: formattedResults  // Map with source_id:symbol as keys
        })
      } else if (this.currentTab === 'topstep' && !authToken) {
        // Topstep requires token
        this.send(ws, {
          type: 'search_response',
          success: false,
          error: 'Token is required for search. Please save a token in the Token Selection section.',
          results: []
        })
      } else if (!searchQuery) {
        // Search query required for both
        this.send(ws, {
          type: 'search_response',
          success: false,
          error: 'Search query is required',
          results: []
        })
      }
    } catch (error) {
      // Handle 401 errors specifically
      let errorMessage = error.message || 'Search failed'
      if (error.message && (error.message.includes('401') || error.message.includes('Invalid token') || error.message.includes('Unauthorized'))) {
        errorMessage = 'Invalid token or token expired. Please login again to get a new token.'
      }
      
      this.send(ws, {
        type: 'search_response',
        success: false,
        error: errorMessage,
        results: []
      })
    }
  }

  /**
   * Handle save token message
   */
  onSaveToken(ws, data, clientInfo, serverInfo) {
    const { token, source } = data
    console.log('[backtester-data WS] Save token request for:', source)
    
    try {
      if (!source) {
        this.send(ws, {
          type: 'save_token_response',
          success: false,
          error: 'Source is required'
        })
        return
      }

      // Allow empty token - save it to config (can be used to clear the token)
      const tokenValue = token || ''
      
      // Save token to config
      this.saveTokenToConfig(source, tokenValue)
      
      this.send(ws, {
        type: 'save_token_response',
        success: true,
        message: tokenValue ? `Token saved successfully for ${source}` : `Token cleared for ${source}`
      })
    } catch (error) {
      console.error('[backtester-data WS] Error saving token:', error.message)
      this.send(ws, {
        type: 'save_token_response',
        success: false,
        error: error.message || 'Failed to save token'
      })
    }
  }

  /**
   * Handle user login message
   */
  async onUserLogin(ws, data, clientInfo, serverInfo) {
    const { username, password, source } = data
    console.log('[backtester-data WS] User login request for:', source)
    
    try {
      if (!username || !password || !source) {
        this.send(ws, {
          type: 'user_login_response',
          success: false,
          error: 'Username, password, and source are required'
        })
        return
      }

      if (source === 'topstep') {
        // TopStep login should be done via API directly from frontend, not through WebSocket
        this.send(ws, {
          type: 'user_login_response',
          success: false,
          error: 'TopStep login should be done via API directly from the frontend'
        })
        return
      } else if (source === 'tradingview') {
        // Import TradingViewService dynamically to avoid circular dependencies
        const TradingViewService = (await import('../services/TradingViewService.js')).default
        
        const result = await TradingViewService.login(username, password, true)
        
        if (result.success && result.auth_token) {
          // Save token to config (TradingView uses auth_token)
          this.saveTokenToConfig(source, result.auth_token)
          
          this.send(ws, {
            type: 'user_login_response',
            success: true,
            token: result.auth_token
          })
        } else {
          this.send(ws, {
            type: 'user_login_response',
            success: false,
            error: result.error || 'Login failed'
          })
        }
      } else {
        this.send(ws, {
          type: 'user_login_response',
          success: false,
          error: 'Invalid source. Supported sources: topstep, tradingview'
        })
      }
    } catch (error) {
      console.error('[backtester-data WS] Error during user login:', error.message)
      this.send(ws, {
        type: 'user_login_response',
        success: false,
        error: error.message || 'Login failed'
      })
    }
  }

  /**
   * Get operation key for tracking
   * @param {string} action - The action
   * @param {string} symbol - The symbol
   * @param {string} source - The source
   * @returns {string} Operation key
   */
  getOperationKey(action, symbol, source) {
    return `${source}_${symbol}_${action}`
  }

  /**
   * Send progress update to all clients and store in state
   * @param {WebSocket} ws - WebSocket connection (optional, for backward compatibility)
   * @param {string} action - The action ('download', 'update', 'overwrite', 'reset')
   * @param {string} symbol - The symbol
   * @param {string} source - The source ('topstep' or 'tradingview')
   * @param {number} progress - Progress percentage (0-100, but not displayed)
   * @param {string} message - Progress message with date/time info
   */
  sendProgress(ws, action, symbol, source, progress, message = '') {
    const operationKey = this.getOperationKey(action, symbol, source)
    
    // Store progress state
    this.progressState.set(operationKey, {
      action,
      symbol,
      source,
      progress,
      message,
      timestamp: Date.now()
    })

    // Broadcast to all connected clients
    this.broadcast({
      type: 'progress',
      action: action,
      symbol: symbol,
      source: source,
      progress: 0, // Always send 0, frontend won't show percentage
      message: message
    })
  }

  /**
   * Clear progress for an operation
   * @param {string} action - The action
   * @param {string} symbol - The symbol
   * @param {string} source - The source
   */
  clearProgress(action, symbol, source) {
    const operationKey = this.getOperationKey(action, symbol, source)
    this.progressState.delete(operationKey)
    this.activeOperations.delete(operationKey)
    
    // Broadcast clear to all clients
    this.broadcast({
      type: 'progress',
      action: action,
      symbol: symbol,
      source: source,
      progress: 0,
      message: '',
      completed: true
    })
  }

  /**
   * Run an async data handler without letting rejections crash the process.
   */
  runDataHandlerSafely(promise, { action, symbol, source, operationKey }) {
    Promise.resolve(promise)
      .catch((err) => {
        console.error(`[backtester-data WS] ${action} failed for ${symbol} (${source}):`, err?.message || err)
      })
      .finally(() => {
        if (operationKey) {
          this.activeOperations.delete(operationKey)
        }
        this.clearProgress(action, symbol, source)
      })
  }

  /**
   * Save token to config.json file
   * @param {string} source - The source ('topstep' or 'tradingview')
   * @param {string} token - The token to save
   */
  saveTokenToConfig(source, token) {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
        console.log(`[backtester-data WS] Created directory: ${configDir}`)
      }

      // Load existing config
      let config = {}
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8')
        config = JSON.parse(configData)
      }

      // Initialize tokens object if it doesn't exist
      if (!config.tokens) {
        config.tokens = {}
      }

      // Update the token for the source
      config.tokens[source] = token

      // Save config back to file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8')
      console.log(`[backtester-data WS] Saved token for ${source} to config.json`)
    } catch (error) {
      console.error('[backtester-data WS] Error saving token to config:', error.message)
      throw error
    }
  }

  /**
   * Handle download message
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} data - Message data
   * @param {Object} clientInfo - Client information
   * @param {Object} serverInfo - Server information
   */
  async onDownload(ws, data, clientInfo, serverInfo) {
    const { symbol, source, storageSymbol: storageSymbolRaw, resolution: resolutionRaw } = data
    const storageSymbol = storageSymbolRaw || symbol
    const resolution = resolutionRaw || '1'
    console.log('[backtester-data WS] onDownload called - Symbol:', symbol, 'Storage:', storageSymbol, 'Source:', source, 'Resolution:', resolution)
    
    try {
      if (!symbol) {
        this.send(ws, {
          type: 'download_response',
          success: false,
          error: 'Symbol is required'
        })
        return
      }

      if (source === 'topstep') {
        // Get token from config
        let config = {}
        if (fs.existsSync(this.configPath)) {
          const configData = fs.readFileSync(this.configPath, 'utf8')
          config = JSON.parse(configData)
        }
        const token = config.tokens?.topstep || ''
        
        if (!token) {
          this.send(ws, {
            type: 'download_response',
            success: false,
            error: 'Token is required for download. Please save a token in the Token Selection section.'
          })
          return
        }

        const normalizedSymbol = storageSymbol.startsWith('/') ? storageSymbol.substring(1) : storageSymbol
        const apiSymbol = symbol.startsWith('/') ? symbol : `/${symbol}`

        // Check if operation is already in progress
        const operationKey = this.getOperationKey('download', normalizedSymbol, source)
        if (this.activeOperations.has(operationKey)) {
          this.send(ws, {
            type: 'download_response',
            success: false,
            error: `Download for ${symbol} is already in progress`
          })
          return
        }

        // Mark operation as active
        this.activeOperations.add(operationKey)

        // Don't send immediate response - let the handler send the final response with bar counts
        // The handler will send download_response via broadcast when operation completes

        // Start download process using handler
        this.runDataHandlerSafely(
          this.topstepHandler.download(apiSymbol, normalizedSymbol, token, 'download'),
          { action: 'download', symbol: normalizedSymbol, source, operationKey }
        )
      } else if (source === 'tradingview') {
        const normalizedSymbol = storageSymbol

        // Check if operation is already in progress
        const operationKey = this.getOperationKey('download', normalizedSymbol, source)
        if (this.activeOperations.has(operationKey)) {
          this.send(ws, {
            type: 'download_response',
            success: false,
            error: `Download for ${symbol} is already in progress`
          })
          return
        }

        // Mark operation as active
        this.activeOperations.add(operationKey)

        // Don't send immediate response - let the handler send the final response with bar counts
        // The handler will send download_response via broadcast when operation completes

        // Start download process using handler
        this.runDataHandlerSafely(
          this.tradingViewHandler.download(symbol, 'download', normalizedSymbol, resolution),
          { action: 'download', symbol: normalizedSymbol, source, operationKey }
        )
      } else {
        this.send(ws, {
          type: 'download_response',
          success: false,
          error: 'Invalid source. Supported sources: topstep, tradingview'
        })
      }
    } catch (error) {
      console.error('[backtester-data WS] Error during download:', error.message)
      this.send(ws, {
        type: 'download_response',
        success: false,
        error: error.message || 'Download failed'
      })
    }
  }



  /**
   * Handle update message
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} data - Message data
   * @param {Object} clientInfo - Client information
   * @param {Object} serverInfo - Server information
   */
  async onUpdate(ws, data, clientInfo, serverInfo) {
    const { symbol, source, storageSymbol: storageSymbolRaw, resolution: resolutionRaw } = data
    const storageSymbol = storageSymbolRaw || symbol
    const resolution = resolutionRaw || '1'
    console.log('[backtester-data WS] onUpdate called - Symbol:', symbol, 'Storage:', storageSymbol, 'Source:', source, 'Resolution:', resolution)

    // Don't send immediate response - let the handler send the final response with bar counts
    try {
      if (!symbol) {
        this.send(ws, {
          type: 'update_response',
          success: false,
          error: 'Symbol is required'
        })
        return
      }

      if (source === 'topstep') {
        // Get token from config
        let config = {}
        if (fs.existsSync(this.configPath)) {
          const configData = fs.readFileSync(this.configPath, 'utf8')
          config = JSON.parse(configData)
        }
        const token = config.tokens?.topstep || ''
        
        if (!token) {
          this.send(ws, {
            type: 'update_response',
            success: false,
            error: 'Token is required for update. Please save a token in the Token Selection section.'
          })
          return
        }

        // Normalize symbol — api ticker may include exchange prefix
        const normalizedSymbol = storageSymbol.startsWith('/') ? storageSymbol.substring(1) : storageSymbol
        const apiSymbol = symbol.startsWith('/') ? symbol : `/${symbol}`

        // Check if operation is already in progress
        const operationKey = this.getOperationKey('update', normalizedSymbol, source)
        if (this.activeOperations.has(operationKey)) {
          this.send(ws, {
            type: 'update_response',
            success: false,
            error: `Update for ${symbol} is already in progress`
          })
          return
        }

        // Mark operation as active
        this.activeOperations.add(operationKey)

        // Don't send immediate response - let the handler send the final response with bar counts
        // The handler will send update_response via broadcast when operation completes

        // Update data using handler
        this.runDataHandlerSafely(
          this.topstepHandler.update(apiSymbol, normalizedSymbol, token),
          { action: 'update', symbol: normalizedSymbol, source, operationKey }
        )
      } else if (source === 'tradingview') {
        const normalizedSymbol = storageSymbol
        
        // Check if operation is already in progress
        const operationKey = this.getOperationKey('update', normalizedSymbol, source)
        if (this.activeOperations.has(operationKey)) {
          this.send(ws, {
            type: 'update_response',
            success: false,
            error: `Update for ${symbol} is already in progress`
          })
          return
        }

        // Mark operation as active
        this.activeOperations.add(operationKey)

        // Don't send immediate response - let the handler send the final response with bar counts
        // The handler will send update_response via broadcast when operation completes

        // Start update process using handler
        this.runDataHandlerSafely(
          this.tradingViewHandler.update(symbol, normalizedSymbol, resolution),
          { action: 'update', symbol: normalizedSymbol, source, operationKey }
        )
      } else {
        this.send(ws, {
          type: 'update_response',
          success: false,
          error: 'Invalid source. Supported sources: topstep, tradingview'
        })
      }
    } catch (error) {
      console.error('[backtester-data WS] Error during update:', error.message)
      this.send(ws, {
        type: 'update_response',
        success: false,
        error: error.message || 'Update failed'
      })
    }
  }


  /**
   * Handle overwrite message
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} data - Message data
   * @param {Object} clientInfo - Client information
   * @param {Object} serverInfo - Server information
   */
  async onOverwrite(ws, data, clientInfo, serverInfo) {
    const { symbol, source, storageSymbol: storageSymbolRaw, resolution: resolutionRaw } = data
    const storageSymbol = storageSymbolRaw || symbol
    const resolution = resolutionRaw || '1'
    console.log('[backtester-data WS] onOverwrite called - Symbol:', symbol, 'Storage:', storageSymbol, 'Source:', source, 'Resolution:', resolution)
    
    try {
      if (!symbol) {
        this.send(ws, {
          type: 'overwrite_response',
          success: false,
          error: 'Symbol is required'
        })
        return
      }

      if (source === 'topstep') {
        // Get token from config
        let config = {}
        if (fs.existsSync(this.configPath)) {
          const configData = fs.readFileSync(this.configPath, 'utf8')
          config = JSON.parse(configData)
        }
        const token = config.tokens?.topstep || ''
        
        if (!token) {
          this.send(ws, {
            type: 'overwrite_response',
            success: false,
            error: 'Token is required for overwrite. Please save a token in the Token Selection section.'
          })
          return
        }

        // Normalize symbol
        const normalizedSymbol = storageSymbol.startsWith('/') ? storageSymbol.substring(1) : storageSymbol
        const apiSymbol = symbol.startsWith('/') ? symbol : `/${symbol}`

        // Check if operation is already in progress
        const operationKey = this.getOperationKey('overwrite', normalizedSymbol, source)
        if (this.activeOperations.has(operationKey)) {
          this.send(ws, {
            type: 'overwrite_response',
            success: false,
            error: `Overwrite for ${symbol} is already in progress`
          })
          return
        }

        // Mark operation as active
        this.activeOperations.add(operationKey)

        // Send initial response
        this.send(ws, {
          type: 'overwrite_response',
          success: true,
          message: `Overwrite started for ${symbol}`
        })

        // Overwrite data (same as download but doesn't delete folder)
        this.runDataHandlerSafely(
          this.topstepHandler.download(apiSymbol, normalizedSymbol, token, 'overwrite'),
          { action: 'overwrite', symbol: normalizedSymbol, source, operationKey }
        )
      } else if (source === 'tradingview') {
        const normalizedSymbol = storageSymbol
        
        // Check if operation is already in progress
        const operationKey = this.getOperationKey('overwrite', normalizedSymbol, source)
        if (this.activeOperations.has(operationKey)) {
          this.send(ws, {
            type: 'overwrite_response',
            success: false,
            error: `Overwrite for ${symbol} is already in progress`
          })
          return
        }

        // Mark operation as active
        this.activeOperations.add(operationKey)

        this.send(ws, {
          type: 'overwrite_response',
          success: true,
          message: `Overwrite started for ${symbol}`
        })

        // Start overwrite process (same as download, overwrites existing files)
        this.runDataHandlerSafely(
          this.tradingViewHandler.download(symbol, 'overwrite', normalizedSymbol, resolution),
          { action: 'overwrite', symbol: normalizedSymbol, source, operationKey }
        )
      } else {
        this.send(ws, {
          type: 'overwrite_response',
          success: false,
          error: 'Invalid source. Supported sources: topstep, tradingview'
        })
      }
    } catch (error) {
      console.error('[backtester-data WS] Error during overwrite:', error.message)
      this.send(ws, {
        type: 'overwrite_response',
        success: false,
        error: error.message || 'Overwrite failed'
      })
    }
  }

  /**
   * Handle reset message
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} data - Message data
   * @param {Object} clientInfo - Client information
   * @param {Object} serverInfo - Server information
   */
  async onReset(ws, data, clientInfo, serverInfo) {
    const { symbol, source } = data
    console.log('[backtester-data WS] onReset called - Symbol:', symbol, 'Source:', source)
    
    try {
      if (!symbol) {
        this.send(ws, {
          type: 'reset_response',
          success: false,
          error: 'Symbol is required'
        })
        return
      }

      if (source === 'topstep') {
        // Get token from config
        let config = {}
        if (fs.existsSync(this.configPath)) {
          const configData = fs.readFileSync(this.configPath, 'utf8')
          config = JSON.parse(configData)
        }
        const token = config.tokens?.topstep || ''
        
        if (!token) {
          this.send(ws, {
            type: 'reset_response',
            success: false,
            error: 'Token is required for reset. Please save a token in the Token Selection section.'
          })
          return
        }

        // Normalize symbol
        const normalizedSymbol = symbol.startsWith('/') ? symbol.substring(1) : symbol
        const apiSymbol = symbol.startsWith('/') ? symbol : `/${symbol}`

        // Check if operation is already in progress
        const operationKey = this.getOperationKey('reset', normalizedSymbol, source)
        if (this.activeOperations.has(operationKey)) {
          this.send(ws, {
            type: 'reset_response',
            success: false,
            error: `Reset for ${symbol} is already in progress`
          })
          return
        }

        // Mark operation as active
        this.activeOperations.add(operationKey)

        // Send initial response
        this.send(ws, {
          type: 'reset_response',
          success: true,
          message: `Reset started for ${symbol}`
        })

        // Delete folder first
        this.sendProgress(null, 'reset', normalizedSymbol, 'topstep', 0, 'Deleting existing data...')
        const symbolDir = path.join(this.csvDir, normalizedSymbol)
        if (fs.existsSync(symbolDir)) {
          fs.rmSync(symbolDir, { recursive: true, force: true })
          console.log(`[backtester-data WS] Deleted directory: ${symbolDir}`)
        }

        // Then download using handler
        this.runDataHandlerSafely(
          this.topstepHandler.download(apiSymbol, normalizedSymbol, token, 'reset'),
          { action: 'reset', symbol: normalizedSymbol, source, operationKey }
        )
      } else if (source === 'tradingview') {
        // Normalize symbol for TradingView
        const normalizedSymbol = symbol
        
        // Check if operation is already in progress
        const operationKey = this.getOperationKey('reset', normalizedSymbol, source)
        if (this.activeOperations.has(operationKey)) {
          this.send(ws, {
            type: 'reset_response',
            success: false,
            error: `Reset for ${symbol} is already in progress`
          })
          return
        }

        // Mark operation as active
        this.activeOperations.add(operationKey)

        this.send(ws, {
          type: 'reset_response',
          success: true,
          message: `Reset started for ${symbol}`
        })

        // Delete existing data first, then download
        try {
          const symbolDir = path.join(this.csvDir, normalizedSymbol)
          if (fs.existsSync(symbolDir)) {
            this.sendProgress(null, 'reset', normalizedSymbol, 'tradingview', 0, 'Deleting existing data...')
            fs.rmSync(symbolDir, { recursive: true, force: true })
            console.log(`[backtester-data WS] Deleted directory: ${symbolDir}`)
          }

          // Then download using handler
          this.runDataHandlerSafely(
            this.tradingViewHandler.download(normalizedSymbol, 'reset'),
            { action: 'reset', symbol: normalizedSymbol, source, operationKey }
          )
        } catch (error) {
          this.activeOperations.delete(operationKey)
          this.clearProgress('reset', normalizedSymbol, source)
          this.send(ws, {
            type: 'reset_response',
            success: false,
            error: error.message || 'Reset failed'
          })
        }
      } else {
        this.send(ws, {
          type: 'reset_response',
          success: false,
          error: 'Invalid source. Supported sources: topstep, tradingview'
        })
      }
    } catch (error) {
      console.error('[backtester-data WS] Error during reset:', error.message)
      this.send(ws, {
        type: 'reset_response',
        success: false,
        error: error.message || 'Reset failed'
      })
    }
  }
}

export default BacktesterDataWebSocket
