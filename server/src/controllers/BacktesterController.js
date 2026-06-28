import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ErrorHandler from '../middleware/ErrorHandler.js'
import { HTTP_STATUS } from '../config/constants.js'
import Translator from '../utils/Translator.js'
import Database from '../config/Database.js'
import { getBacktesterBarsService } from '../services/BacktesterBarsService.js'
import { listAllCsvFiles, listSymbolCsvFiles, listSymbolCsvResolutions, listSymbolChartResolutions } from '../utils/backtesterCsvPaths.js'
import { buildCsvInventory } from '../utils/backtesterCsvInventory.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Backtester Controller
 * Handles backtester-related operations
 */
class BacktesterController {
  // Cache for symbol config to avoid repeated file reads
  static symbolConfigCache = null
  static configCacheTime = null
  static CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Get full symbol config from config file (with caching)
   * Returns symbol configuration including tick size, tick value, and fees
   */
  getSymbolConfig(symbol) {
    // Check if cache is valid
    const now = Date.now()
    if (BacktesterController.symbolConfigCache && 
        BacktesterController.configCacheTime && 
        (now - BacktesterController.configCacheTime) < BacktesterController.CACHE_DURATION) {
      // Use cached config
      const symbolConfig = BacktesterController.symbolConfigCache.symbols?.[symbol]
      if (symbolConfig) {
        return {
          tickSize: symbolConfig.tickSize || 1,
          tickValue: symbolConfig.tickValue || 1,
          totalFees: symbolConfig.totalFees || 0
        }
      }
      return { tickSize: 1, tickValue: 1, totalFees: 0 }
    }

    // Load config from file
    try {
      const configPath = path.join(__dirname, '../../data/backtester/config.json')
      
      if (!fs.existsSync(configPath)) {
        return { tickSize: 1, tickValue: 1, totalFees: 0 }
      }

      const configData = fs.readFileSync(configPath, 'utf8')
      const config = JSON.parse(configData)
      
      // Cache the config
      BacktesterController.symbolConfigCache = config
      BacktesterController.configCacheTime = now
      
      const symbolConfig = config.symbols?.[symbol]
      if (symbolConfig) {
        return {
          tickSize: symbolConfig.tickSize || 1,
          tickValue: symbolConfig.tickValue || 1,
          totalFees: symbolConfig.totalFees || 0
        }
      }
      
      return { tickSize: 1, tickValue: 1, totalFees: 0 }
    } catch (error) {
      // Return defaults on error
      return { tickSize: 1, tickValue: 1, totalFees: 0 }
    }
  }

  /**
   * Get tick size and tick value for a symbol from config
   * Returns default values of 1 if symbol not found
   * @deprecated Use getSymbolConfig instead for better performance
   */
  getSymbolTickConfig(symbol) {
    const config = this.getSymbolConfig(symbol)
    return {
      tickSize: config.tickSize,
      tickValue: config.tickValue
    }
  }

  /**
   * Convert timeframe from display format to DB format (TradingView compatible)
   * @param {string|number} timeframe - Display format (e.g., "1m", "1H", "1D") or number
   * @returns {string|number} - DB format (number for minutes, string for S/T/D/W/M/Y)
   */
  convertTimeframeToDb(timeframe) {
    if (typeof timeframe === 'string') {
      const trimmed = timeframe.trim()
      // Check for lowercase 'm' FIRST (minutes) before converting to uppercase
      if (trimmed.toLowerCase().endsWith('m')) {
        // Minutes (lowercase m) - convert to integer
        const minutes = parseInt(trimmed.slice(0, -1), 10)
        if (!isNaN(minutes)) {
          return minutes
        }
        return 1 // Default
      }
      
      const str = trimmed.toUpperCase()
      if (str.endsWith('S') || str.endsWith('T') || str.endsWith('D') || str.endsWith('W') || str.endsWith('M') || str.endsWith('Y')) {
        // TradingView formats: Seconds, Ticks, Days, Weeks, Months, Years - keep as string
        return str
      } else if (str.endsWith('H')) {
        // Hours (uppercase H) - convert to minutes (integer)
        const hours = parseInt(str.slice(0, -1), 10)
        if (!isNaN(hours)) {
          return hours * 60
        }
        return str
      } else {
        // No suffix - try to parse as number (treat as minutes)
        const num = parseInt(str, 10)
        if (!isNaN(num)) {
          return num
        }
        return 1 // Default
      }
    } else if (typeof timeframe === 'number') {
      // Already a number, use as-is
      return timeframe
    } else {
      return 1 // Default
    }
  }
  /**
   * Get available symbols from CSV folder
   */
  async getAvailableSymbols(req, res) {
    try {
      const csvDir = path.join(__dirname, '../../data/backtester/csv')
      
      // Check if directory exists
      if (!fs.existsSync(csvDir)) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          symbols: [],
          count: 0,
        })
      }

      // Read subdirectories (each symbol has its own folder)
      const items = fs.readdirSync(csvDir, { withFileTypes: true })
      const symbolDirs = items
        .filter(item => item.isDirectory())
        .map(item => item.name)
      
      // Symbols are the folder names
      const symbols = symbolDirs

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        symbols: symbols.sort(),
        count: symbols.length,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get backtester symbol data (tick size and tick value)
   */
  async getSymbolData(req, res) {
    try {
      const configPath = path.join(__dirname, '../../data/backtester/config.json')
      const csvDir = path.join(__dirname, '../../data/backtester/csv')
      
      if (!fs.existsSync(configPath)) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          symbols: {},
        })
      }

      const configData = fs.readFileSync(configPath, 'utf8')
      const config = JSON.parse(configData)
      const rawSymbols = config.symbols || {}
      const symbols = {}

      for (const [sym, info] of Object.entries(rawSymbols)) {
        const csvResolutions = listSymbolCsvResolutions(csvDir, sym)
        symbols[sym] = {
          ...info,
          csvResolutions,
          supportedChartResolutions: listSymbolChartResolutions(csvDir, sym),
        }
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        symbols,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get tokens from config.json
   */
  async getTokens(req, res) {
    try {
      const configPath = path.join(__dirname, '../../data/backtester/config.json')
      
      if (!fs.existsSync(configPath)) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          tokens: {},
        })
      }

      const configData = fs.readFileSync(configPath, 'utf8')
      const config = JSON.parse(configData)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        tokens: config.tokens || {},
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get server time
   * Returns current server time in milliseconds (Unix timestamp)
   */
  async getServerTime(req, res) {
    try {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        timestamp: Date.now(),
        serverTime: new Date().toISOString()
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Load historical bars (auth token only).
   * GET /backtester/history?symbol=NQ&resolution=1&from=&to=&countback=
   */
  async getHistory(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId
      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Authentication required',
        })
      }

      const {
        symbol,
        resolution,
        from,
        to,
        countback,
        countBack,
        firstDataRequest,
        requestId,
      } = req.query ?? {}

      if (!symbol || !resolution) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'symbol and resolution are required',
        })
      }

      const parsedCountBack = Number(countback ?? countBack)
      const parsedFrom = from != null && from !== '' ? Number(from) : undefined
      const parsedTo = to != null && to !== '' ? Number(to) : undefined
      const parsedFirstDataRequest =
        firstDataRequest === 'true' ||
        firstDataRequest === '1' ||
        firstDataRequest === true

      const result = getBacktesterBarsService().getHistoryBars({
        symbol: String(symbol),
        resolution: String(resolution),
        from: Number.isFinite(parsedFrom) ? parsedFrom : undefined,
        to: Number.isFinite(parsedTo) ? parsedTo : undefined,
        countBack: Number.isFinite(parsedCountBack) ? parsedCountBack : undefined,
        firstDataRequest: parsedFirstDataRequest,
        requestId: requestId != null ? String(requestId) : undefined,
      })

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        ...result,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * CSV inventory with date ranges per symbol/resolution (admin).
   */
  async getCsvInventory(req, res) {
    try {
      const csvDir = path.join(__dirname, '../../data/backtester/csv')
      const inventory = buildCsvInventory(csvDir)
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        inventory,
        count: inventory.length,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Search symbols for TradingView chart
   * Returns symbols from config.json that match the search query
   */
  async searchSymbols(req, res) {
    try {
      const { query } = req.query
      const configPath = path.join(__dirname, '../../data/backtester/config.json')
      const csvDir = path.join(__dirname, '../../data/backtester/csv')
      
      if (!fs.existsSync(configPath)) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          symbols: {},
        })
      }

      const configData = fs.readFileSync(configPath, 'utf8')
      const config = JSON.parse(configData)
      const rawSymbols = config.symbols || {}

      const enrich = (sym, info) => ({
        ...info,
        csvResolutions: listSymbolCsvResolutions(csvDir, sym),
        supportedChartResolutions: listSymbolChartResolutions(csvDir, sym),
      })

      // If no query, return all symbols
      if (!query || query.trim() === '') {
        const symbols = {}
        for (const [sym, info] of Object.entries(rawSymbols)) {
          symbols[sym] = enrich(sym, info)
        }
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          symbols,
        })
      }

      const searchTerm = query.toUpperCase()
      const filteredSymbols = {}
      
      for (const [symbol, data] of Object.entries(rawSymbols)) {
        if (symbol.toUpperCase().includes(searchTerm)) {
          filteredSymbols[symbol] = enrich(symbol, data)
        }
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        symbols: filteredSymbols,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Initialize backtester sessions table
   */
  async initializeSessionsTable() {
    await Database.run(`
      CREATE TABLE IF NOT EXISTS backtester_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        start_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        strategy TEXT,
        testing_strategy_id TEXT,
        initial_balance REAL DEFAULT 50000,
        current_balance REAL DEFAULT 50000,
        results TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (testing_strategy_id) REFERENCES backtester_testing_strategies(id) ON DELETE SET NULL
      )
    `)
    
    // Migration: Remove end_date and status columns if they exist
    try {
      await Database.run(`ALTER TABLE backtester_sessions DROP COLUMN end_date`)
    } catch (err) {
      // Column doesn't exist, ignore
    }
    
    try {
      await Database.run(`ALTER TABLE backtester_sessions DROP COLUMN status`)
    } catch (err) {
      // Column doesn't exist, ignore
    }
    
    // Migration: Add start_time column if it doesn't exist
    try {
      await Database.run(`ALTER TABLE backtester_sessions ADD COLUMN start_time TEXT`)
    } catch (err) {
      // Column already exists, ignore
    }

    // Add balance columns if they don't exist (for existing databases)
    try {
      await Database.run(`ALTER TABLE backtester_sessions ADD COLUMN initial_balance REAL DEFAULT 50000`)
    } catch (err) {
      // Column already exists, ignore error
    }

    try {
      await Database.run(`ALTER TABLE backtester_sessions ADD COLUMN current_balance REAL DEFAULT 50000`)
    } catch (err) {
      // Column already exists, ignore error
    }

    // Add testing_strategy_id column if it doesn't exist
    try {
      await Database.run(`ALTER TABLE backtester_sessions ADD COLUMN testing_strategy_id TEXT`)
    } catch (err) {
      // Column already exists, ignore error
    }
  }

  /**
   * Initialize testing strategies tables
   */
  async initializeTestingStrategiesTable() {
    await Database.run(`
      CREATE TABLE IF NOT EXISTS backtester_testing_strategies (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await Database.run(`
      CREATE TABLE IF NOT EXISTS backtester_testing_strategy_rules (
        id TEXT PRIMARY KEY,
        strategy_id TEXT NOT NULL,
        type TEXT NOT NULL,
        timeframe TEXT,
        label TEXT,
        value TEXT,
        include_timeframe INTEGER DEFAULT 0,
        display_type TEXT DEFAULT 'text',
        rule_order INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (strategy_id) REFERENCES backtester_testing_strategies(id) ON DELETE CASCADE
      )
    `)

    // Migration: Add new columns if they don't exist
    try {
      await Database.run(`ALTER TABLE backtester_testing_strategy_rules ADD COLUMN include_timeframe INTEGER DEFAULT 0`)
    } catch (err) {
      // Column already exists, ignore error
    }

    try {
      await Database.run(`ALTER TABLE backtester_testing_strategy_rules ADD COLUMN display_type TEXT DEFAULT 'text'`)
    } catch (err) {
      // Column already exists, ignore error
    }
  }

  /**
   * Initialize testing strategy logs table
   */
  async initializeTestingStrategyLogsTable() {
    await Database.run(`
      CREATE TABLE IF NOT EXISTS backtester_testing_strategy_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        strategy_id TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        rule_index INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT,
        text_content TEXT,
        timestamp INTEGER NOT NULL,
        entry_id INTEGER,
        symbol TEXT,
        resolution TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES backtester_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (strategy_id) REFERENCES backtester_testing_strategies(id) ON DELETE CASCADE
      )
    `)

    // Add entry_id column if it doesn't exist (migration)
    try {
      await Database.run(`ALTER TABLE backtester_testing_strategy_logs ADD COLUMN entry_id INTEGER`)
    } catch (err) {
      // Column already exists, ignore
    }

    // Add text_content column if it doesn't exist (migration)
    try {
      await Database.run(`ALTER TABLE backtester_testing_strategy_logs ADD COLUMN text_content TEXT`)
    } catch (err) {
      // Column already exists, ignore
    }

    // Add symbol column if it doesn't exist (migration)
    try {
      await Database.run(`ALTER TABLE backtester_testing_strategy_logs ADD COLUMN symbol TEXT`)
    } catch (err) {
      // Column already exists, ignore
    }

    // Add resolution column if it doesn't exist (migration)
    try {
      await Database.run(`ALTER TABLE backtester_testing_strategy_logs ADD COLUMN resolution TEXT`)
    } catch (err) {
      // Column already exists, ignore
    }

    // Create index for faster queries
    try {
      await Database.run(`CREATE INDEX IF NOT EXISTS idx_logs_session_strategy ON backtester_testing_strategy_logs(session_id, strategy_id)`)
      await Database.run(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON backtester_testing_strategy_logs(timestamp)`)
    } catch (err) {
      // Indexes might already exist, ignore error
    }
  }

  /**
   * Initialize backtester trades table
   */
  async initializeTradesTable() {
    await Database.run(`
      CREATE TABLE IF NOT EXISTS backtester_trades (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        direction TEXT NOT NULL,
        entry_price REAL NOT NULL,
        exit_price REAL,
        stop_loss REAL,
        take_profit REAL,
        contracts INTEGER NOT NULL,
        entry_time INTEGER NOT NULL,
        exit_time INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES backtester_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // Add stop_loss and take_profit columns if they don't exist (migration)
    try {
      await Database.run(`ALTER TABLE backtester_trades ADD COLUMN stop_loss REAL`)
    } catch (err) {
      // Column already exists, ignore
    }

    try {
      await Database.run(`ALTER TABLE backtester_trades ADD COLUMN take_profit REAL`)
    } catch (err) {
      // Column already exists, ignore
    }

    // Create index for faster queries
    try {
      await Database.run(`CREATE INDEX IF NOT EXISTS idx_backtester_trades_session ON backtester_trades(session_id)`)
      await Database.run(`CREATE INDEX IF NOT EXISTS idx_backtester_trades_user ON backtester_trades(user_id)`)
    } catch (err) {
      // Indexes might already exist, ignore
    }
  }

  /**
   * Save a backtester trade
   */
  async saveTrade(req, res) {
    try {
      await this.initializeTradesTable()
      const userId = req.user.id
      const {
        sessionId,
        symbol,
        direction,
        entryPrice,
        exitPrice,
        stopLoss,
        takeProfit,
        contracts,
        entryTime,
        exitTime
      } = req.body

      if (!sessionId || !symbol || !direction || !entryPrice || !contracts || entryTime === undefined || entryTime === null) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Missing required fields'
        })
      }

      // Verify session belongs to user and get current balance
      const session = await Database.get(
        'SELECT id, current_balance, initial_balance FROM backtester_sessions WHERE id = ? AND user_id = ?',
        [sessionId, userId]
      )

      if (!session) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Session not found'
        })
      }

      // Store Unix timestamps (seconds) directly as INTEGER
      // Ensure entryTime is a number (Unix timestamp in seconds)
      const entryTimestamp = typeof entryTime === 'number' 
        ? entryTime
        : Math.floor(new Date(entryTime).getTime() / 1000)
      
      // Ensure exitTime is a number or null
      const exitTimestamp = (exitTime !== null && exitTime !== undefined)
        ? (typeof exitTime === 'number' ? exitTime : Math.floor(new Date(exitTime).getTime() / 1000))
        : null

      const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      await Database.run(
        `INSERT INTO backtester_trades
        (id, session_id, user_id, symbol, direction, entry_price, exit_price, stop_loss, take_profit, contracts, entry_time, exit_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tradeId,
          sessionId,
          userId,
          symbol,
          direction,
          entryPrice,
          exitPrice || null,
          stopLoss || null,
          takeProfit || null,
          contracts,
          entryTimestamp,
          exitTimestamp
        ]
      )

      // If trade is closed (has exitPrice), update session balance
      if (exitPrice !== null && exitPrice !== undefined) {
        // Get symbol config (tick size, tick value, and fees)
        const { tickSize, tickValue, totalFees } = this.getSymbolConfig(symbol)
        
        // Calculate P&L based on direction
        const contractsCount = Math.abs(contracts || 0)
        let pnl
        if (direction?.toLowerCase() === 'short') {
          const priceDiff = entryPrice - exitPrice
          const ticks = priceDiff / tickSize
          pnl = ticks * tickValue * contractsCount
        } else {
          const priceDiff = exitPrice - entryPrice
          const ticks = priceDiff / tickSize
          pnl = ticks * tickValue * contractsCount
        }
        
        // Subtract fees (fees apply per contract)
        const feesPerTrade = totalFees * contractsCount
        const netPnL = pnl - feesPerTrade
        
        // Update session balance
        const currentBalance = session.current_balance || session.initial_balance || 50000
        const newBalance = currentBalance + netPnL
        
        await Database.run(
          'UPDATE backtester_sessions SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [newBalance, sessionId, userId]
        )
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        tradeId
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Update session balance
   */
  async updateSessionBalance(req, res) {
    try {
      await this.initializeSessionsTable()
      const userId = req.user.id
      const sessionId = req.params.id
      const { balance } = req.body

      // Verify session belongs to user
      const session = await Database.get(
        'SELECT id FROM backtester_sessions WHERE id = ? AND user_id = ?',
        [sessionId, userId]
      )

      if (!session) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Session not found'
        })
      }

      await Database.run(
        'UPDATE backtester_sessions SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [balance || 0, sessionId, userId]
      )

      return res.status(HTTP_STATUS.OK).json({
        success: true
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get all backtester trades for the current user
   */
  async getTrades(req, res) {
    try {
      await this.initializeTradesTable()
      const userId = req.user.id
      const { sessionId, startDate, endDate } = req.query

      let query = 'SELECT * FROM backtester_trades WHERE user_id = ?'
      const params = [userId]

      if (sessionId) {
        query += ' AND session_id = ?'
        params.push(sessionId)
      }

      if (startDate) {
        // Compare date part of entry_time with startDate
        // entry_time is stored as Unix timestamp (seconds)
        // Convert startDate to Unix timestamp (start of day) for comparison
        const startDateObj = new Date(startDate + 'T00:00:00Z')
        const startTimestamp = Math.floor(startDateObj.getTime() / 1000)
        query += ' AND entry_time >= ?'
        params.push(startTimestamp)
      }

      if (endDate) {
        // Compare date part of entry_time with endDate
        // Include the full end date (up to 23:59:59) by using end of day timestamp
        const endDateObj = new Date(endDate + 'T23:59:59Z')
        const endTimestamp = Math.floor(endDateObj.getTime() / 1000)
        query += ' AND entry_time <= ?'
        params.push(endTimestamp)
      }

      // Validate date range - ensure startDate <= endDate (only when both dates are provided)
      if (startDate && endDate && startDate.trim() && endDate.trim()) {
        const startDateObj = new Date(startDate + 'T00:00:00Z')
        const endDateObj = new Date(endDate + 'T23:59:59Z')
        if (startDateObj > endDateObj) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Start date cannot be after end date'
          })
        }
      }

      query += ' ORDER BY entry_time DESC'

      const trades = await Database.query(query, params)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        trades
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get a single backtester trade by ID
   */
  async getTrade(req, res) {
    try {
      await this.initializeTradesTable()
      const userId = req.user.id
      const tradeId = req.params.id

      const trade = await Database.get(
        'SELECT * FROM backtester_trades WHERE id = ? AND user_id = ?',
        [tradeId, userId]
      )

      if (!trade) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Trade not found'
        })
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        trade
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Delete a backtester trade and reverse its P&L from session balance
   */
  async deleteTrade(req, res) {
    try {
      await this.initializeTradesTable()
      await this.initializeSessionsTable()
      const userId = req.user.id
      const tradeId = req.params.id

      // Get the trade first
      const trade = await Database.get(
        'SELECT * FROM backtester_trades WHERE id = ? AND user_id = ?',
        [tradeId, userId]
      )

      if (!trade) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Trade not found'
        })
      }

      // If trade is closed (has exit_price), reverse the P&L from session balance
      if (trade.exit_price !== null && trade.exit_price !== undefined) {
        // Get symbol config for P&L calculation
        const { tickSize, tickValue, totalFees } = this.getSymbolConfig(trade.symbol)
        
        // Calculate P&L (same as when trade was saved)
        const contracts = Math.abs(trade.contracts || 0)
        let pnl
        if (trade.direction?.toLowerCase() === 'short') {
          const priceDiff = trade.entry_price - trade.exit_price
          const ticks = priceDiff / tickSize
          pnl = ticks * tickValue * contracts
        } else {
          const priceDiff = trade.exit_price - trade.entry_price
          const ticks = priceDiff / tickSize
          pnl = ticks * tickValue * contracts
        }
        
        // Subtract fees (fees apply per contract)
        const feesPerTrade = totalFees * contracts
        const netPnL = pnl - feesPerTrade
        
        // Get current session balance
        const session = await Database.get(
          'SELECT current_balance, initial_balance FROM backtester_sessions WHERE id = ? AND user_id = ?',
          [trade.session_id, userId]
        )
        
        if (session) {
          // Reverse the P&L (subtract if it was added, add if it was subtracted)
          const currentBalance = session.current_balance !== null && session.current_balance !== undefined
            ? session.current_balance
            : session.initial_balance || 50000
          const newBalance = currentBalance - netPnL // Reverse: subtract the net P&L
          
          // Update session balance
          await Database.run(
            'UPDATE backtester_sessions SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            [newBalance, trade.session_id, userId]
          )
        }
      }

      // Delete the trade
      await Database.run(
        'DELETE FROM backtester_trades WHERE id = ? AND user_id = ?',
        [tradeId, userId]
      )

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Trade deleted successfully'
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get session stats (balance, P&L, etc.)
   */
  async getSessionStats(req, res) {
    try {
      await this.initializeSessionsTable()
      await this.initializeTradesTable()
      const userId = req.user.id
      const sessionId = req.params.id

      // Get session (including start_date for date filtering)
      const session = await Database.get(
        'SELECT initial_balance, current_balance, start_date FROM backtester_sessions WHERE id = ? AND user_id = ?',
        [sessionId, userId]
      )

      if (!session) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Session not found'
        })
      }

      // Use stored current_balance instead of recalculating from all trades
      const initialBalance = session.initial_balance || 50000
      const currentBalance = session.current_balance !== null && session.current_balance !== undefined
        ? session.current_balance
        : initialBalance
      
      // Calculate realized P&L as the difference between current balance and initial balance
      const cumulativeRealizedPnL = currentBalance - initialBalance

      // Build query to filter trades by date (using session's start_date) for daily RP&L display
      let dailyTradesQuery = 'SELECT * FROM backtester_trades WHERE session_id = ? AND user_id = ?'
      const dailyTradesParams = [sessionId, userId]

      // Filter trades by the session's start_date (current viewing date) for daily RP&L
      if (session.start_date) {
        // Convert start_date (YYYY-MM-DD) to Unix timestamps for start and end of day (local day)
        const [y, m, d] = String(session.start_date).split('-').map(Number)
        const startDateObj = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0)
        const endDateObj = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999)
        const startTimestamp = Math.floor(startDateObj.getTime() / 1000)
        const endTimestamp = Math.floor(endDateObj.getTime() / 1000)
        
        // Filter trades where entry_time falls within this day
        dailyTradesQuery += ' AND entry_time >= ? AND entry_time <= ?'
        dailyTradesParams.push(startTimestamp, endTimestamp)
      }

      // Get trades for this session filtered by date (for daily RP&L display)
      const dailyTrades = await Database.query(dailyTradesQuery, dailyTradesParams)

      // Calculate daily realized P&L from closed trades on current date (with fees subtracted)
      const realizedPnL = dailyTrades
        .filter(trade => trade.exit_price !== null)
        .reduce((sum, trade) => {
          // Get symbol config (tick size, tick value, and fees)
          const { tickSize, tickValue, totalFees } = this.getSymbolConfig(trade.symbol)
          
          // Calculate P&L based on direction
          const contracts = Math.abs(trade.contracts || 0)
          let pnl
          if (trade.direction?.toLowerCase() === 'short') {
            const priceDiff = trade.entry_price - trade.exit_price
            const ticks = priceDiff / tickSize
            pnl = ticks * tickValue * contracts
          } else {
            const priceDiff = trade.exit_price - trade.entry_price
            const ticks = priceDiff / tickSize
            pnl = ticks * tickValue * contracts
          }
          
          // Subtract fees (fees apply per contract)
          const feesPerTrade = totalFees * contracts
          
          return sum + pnl - feesPerTrade
        }, 0)

      // Calculate unrealized P&L from open positions (trades without exit_price) on current date
      const unrealizedPnL = dailyTrades
        .filter(trade => trade.exit_price === null)
        .reduce((sum, trade) => {
          // This would need current price - for now return 0
          // Will be calculated client-side based on current market price
          return sum
        }, 0)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        balance: currentBalance,
        realizedPnL,
        unrealizedPnL,
        initialBalance
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get all backtester sessions for the current user
   */
  async getSessions(req, res) {
    try {
      await this.initializeSessionsTable()
      const userId = req.user.id

      const sessions = await Database.query(
        'SELECT * FROM backtester_sessions WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      )

      const result = sessions.map(session => {
        // Convert timeframe from DB format to display format (TradingView compatible)
        let timeframe = session.timeframe
        if (typeof timeframe === 'number') {
          // Number represents minutes
          if (timeframe < 60) {
            timeframe = `${timeframe}m`
          } else if (timeframe === 60) {
            timeframe = '1H'
          } else if (timeframe < 1440) {
            const hours = Math.floor(timeframe / 60)
            timeframe = `${hours}H`
          } else if (timeframe < 10080) {
            // Less than 1 week (10080 minutes)
            const days = Math.floor(timeframe / 1440)
            timeframe = `${days}D`
          } else if (timeframe < 43200) {
            // Less than 1 month (approx 43200 minutes = 30 days)
            const weeks = Math.floor(timeframe / 10080)
            timeframe = `${weeks}W`
          } else if (timeframe < 525600) {
            // Less than 1 year (approx 525600 minutes = 365 days)
            const months = Math.floor(timeframe / 43200)
            timeframe = `${months}M`
          } else {
            // Years
            const years = Math.floor(timeframe / 525600)
            timeframe = `${years}Y`
          }
        } else if (typeof timeframe === 'string') {
          // Check if it's already in TradingView format or needs conversion
          if (!timeframe.match(/^[0-9]+[STmHDWMY]$/i)) {
            // Numeric string without suffix - treat as minutes
            const num = parseInt(timeframe, 10)
            if (!isNaN(num)) {
              if (num < 60) {
                timeframe = `${num}m`
              } else if (num === 60) {
                timeframe = '1H'
              } else if (num < 1440) {
                const hours = Math.floor(num / 60)
                timeframe = `${hours}H`
              } else if (num < 10080) {
                const days = Math.floor(num / 1440)
                timeframe = `${days}D`
              } else if (num < 43200) {
                const weeks = Math.floor(num / 10080)
                timeframe = `${weeks}W`
              } else if (num < 525600) {
                const months = Math.floor(num / 43200)
                timeframe = `${months}M`
              } else {
                const years = Math.floor(num / 525600)
                timeframe = `${years}Y`
              }
            }
          } else {
            // Convert lowercase h to uppercase H for TradingView compatibility
            timeframe = timeframe.replace(/h$/i, 'H')
          }
        } else {
          timeframe = '1m' // Default
        }

        return {
          id: session.id,
          name: session.name,
          symbol: session.symbol,
          timeframe: timeframe,
          startDate: session.start_date,
          startTime: session.start_time || '',
          testingStrategyId: session.testing_strategy_id || null,
          initialBalance: session.initial_balance || 50000,
          currentBalance: session.current_balance || 50000,
          results: session.results ? JSON.parse(session.results) : undefined,
          createdAt: session.created_at
        }
      })

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        sessions: result
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Save backtester session (create or update)
   */
  async saveSession(req, res) {
    try {
      await this.initializeSessionsTable()
      const userId = req.user.id
      const session = req.body

      if (!session.id || !session.name || !session.symbol || !session.timeframe || !session.startDate) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Missing required fields'
        })
      }
      
      const resultsJson = session.results ? JSON.stringify(session.results) : null
      
      // Convert timeframe from display format to DB format
      const dbTimeframe = this.convertTimeframeToDb(session.timeframe)
      
      // Get initial balance from request or use default
      const initialBalance = session.initialBalance || session.balance || 50000
      const resetBalance = session.resetBalance !== false // Default to true if not specified

      // Check if session exists
      const existing = await Database.get(
        'SELECT id FROM backtester_sessions WHERE id = ? AND user_id = ?',
        [session.id, userId]
      )

      if (existing) {
        // Update existing session
        // If resetBalance is true, reset both initial and current balance
        if (resetBalance) {
          await Database.run(
            'UPDATE backtester_sessions SET name = ?, symbol = ?, timeframe = ?, start_date = ?, start_time = ?, testing_strategy_id = ?, initial_balance = ?, current_balance = ?, results = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            [session.name, session.symbol, dbTimeframe, session.startDate, session.startTime, session.testingStrategyId || null, initialBalance, initialBalance, resultsJson, session.id, userId]
          )
        } else {
          // Update without resetting balance
          await Database.run(
          'UPDATE backtester_sessions SET name = ?, symbol = ?, timeframe = ?, start_date = ?, start_time = ?, testing_strategy_id = ?, results = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [session.name, session.symbol, dbTimeframe, session.startDate, session.startTime, session.testingStrategyId || null, resultsJson, session.id, userId]
        )
        }
      } else {
        // Create new session - always set initial and current balance
        await Database.run(
          'INSERT INTO backtester_sessions (id, user_id, name, symbol, timeframe, start_date, start_time, testing_strategy_id, initial_balance, current_balance, results) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [session.id, userId, session.name, session.symbol, dbTimeframe, session.startDate, session.startTime, session.testingStrategyId || null, initialBalance, initialBalance, resultsJson]
        )
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: resetBalance ? 'Session saved and balance reset successfully' : 'Session saved successfully'
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Update backtester session
   */
  async updateSession(req, res) {
    try {
      await this.initializeSessionsTable()
      const userId = req.user.id
      const sessionId = req.params.id
      const session = req.body

      // Check if session exists first
      const existing = await Database.get(
        'SELECT id FROM backtester_sessions WHERE id = ? AND user_id = ?',
        [sessionId, userId]
      )

      if (!existing) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Session not found'
        })
      }

      const resultsJson = session.results ? JSON.stringify(session.results) : null
      const resetBalance = session.resetBalance === true

      // Convert timeframe from display format to DB format
      const dbTimeframe = this.convertTimeframeToDb(session.timeframe)

      // If resetBalance is true, reset both initial and current balance and delete all trades
      if (resetBalance) {
        // Initialize trades table to ensure it exists
        await this.initializeTradesTable()
        
        // Delete all trades associated with this session
        await Database.run(
          'DELETE FROM backtester_trades WHERE session_id = ? AND user_id = ?',
          [sessionId, userId]
        )
        
        const initialBalance = session.initialBalance || session.balance || 50000
        await Database.run(
          'UPDATE backtester_sessions SET name = ?, symbol = ?, timeframe = ?, start_date = ?, start_time = ?, testing_strategy_id = ?, initial_balance = ?, current_balance = ?, results = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [session.name, session.symbol, dbTimeframe, session.startDate, session.startTime, session.testingStrategyId || null, initialBalance, initialBalance, resultsJson, sessionId, userId]
        )
      } else {
        await Database.run(
          'UPDATE backtester_sessions SET name = ?, symbol = ?, timeframe = ?, start_date = ?, start_time = ?, testing_strategy_id = ?, results = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [session.name, session.symbol, dbTimeframe, session.startDate, session.startTime, session.testingStrategyId || null, resultsJson, sessionId, userId]
        )
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: resetBalance ? 'Session updated and balance reset successfully' : 'Session updated successfully'
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Delete backtester session
   */
  async deleteSession(req, res) {
    try {
      await this.initializeSessionsTable()
      const userId = req.user.id
      const sessionId = req.params.id

      // Check if session exists first
      const existing = await Database.get(
        'SELECT id FROM backtester_sessions WHERE id = ? AND user_id = ?',
        [sessionId, userId]
      )

      if (!existing) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Session not found'
        })
      }

      await Database.run(
        'DELETE FROM backtester_sessions WHERE id = ? AND user_id = ?',
        [sessionId, userId]
      )

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Session deleted successfully'
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Verify token and username from query parameters
   * @param {string} clientToken - JWT token from client query param
   * @param {string} username - Username from user query param
   * @returns {Object|null} - User object if valid, null otherwise
   */
  async verifyChartStorageAuth(clientToken, username) {
    if (!clientToken || !username) {
      return null
    }

    try {
      const TokenService = (await import('../services/TokenService.js')).default
      const decoded = TokenService.verifyAuthToken(clientToken)
      
      if (!decoded || decoded.username !== username) {
        return null
      }

      const user = await Database.findUserByUsernameOrEmail(username)
      if (!user || user.username !== username) {
        return null
      }

      return user
    } catch (error) {
      return null
    }
  }

  /**
   * Handle chart storage API requests
   * GET /api/backtester/chart_storage/:version/charts
   * POST /api/backtester/chart_storage/:version/charts
   * DELETE /api/backtester/chart_storage/:version/charts
   */
  async handleChartStorage(req, res) {
    try {
      const { version } = req.params
      const { client, user: username, chart, type } = req.query
      
      // Verify authentication
      const user = await this.verifyChartStorageAuth(client, username)
      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: 'error',
          message: 'Invalid authentication'
        })
      }

      // Auto-set type to 'backtester' for backtester routes if not provided
      const chartType = type || 'backtester'

      const method = req.method

      if (method === 'GET') {
        if (chart) {
          // Get specific chart
          const chartData = await Database.getChartById(chart, user.id, chartType)
          if (!chartData) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
              status: 'error',
              message: 'Chart not found'
            })
          }
          // Convert string ID to number if it's numeric
          const chartId = /^\d+$/.test(chartData.id) ? parseInt(chartData.id, 10) : chartData.id
          return res.status(HTTP_STATUS.OK).json({
            status: 'ok',
            data: {
              id: chartId,
              name: chartData.name,
              timestamp: chartData.timestamp,
              content: chartData.content
            }
          })
        } else {
          // Get all charts filtered by type
          const charts = await Database.getChartsByUserId(user.id, chartType)
          // Convert string IDs to numbers if they're numeric
          const formattedCharts = charts.map(chart => ({
            ...chart,
            id: /^\d+$/.test(chart.id) ? parseInt(chart.id, 10) : chart.id,
            timestamp: chart.timestamp || Math.floor(Date.now() / 1000)
          }))
          return res.status(HTTP_STATUS.OK).json({
            status: 'ok',
            data: formattedCharts
          })
        }
      } else if (method === 'POST') {
        // Save chart
        const { name, content, symbol, resolution } = req.body
        
        if (!name) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: 'error',
            message: 'Chart name is required'
          })
        }

        // Parse content to extract symbol and resolution if not provided
        let chartSymbol = symbol
        let chartResolution = resolution
        let chartContent = content || '{}'
        
        try {
          if (chartContent) {
            // Content might be a JSON string, parse it
            const parsedContent = typeof chartContent === 'string' ? JSON.parse(chartContent) : chartContent
            
            // Try to extract symbol and resolution from nested content if needed
            if (parsedContent.content && typeof parsedContent.content === 'string') {
              const innerContent = JSON.parse(parsedContent.content)
              if (!chartSymbol && innerContent.symbol) {
                chartSymbol = innerContent.symbol
              }
              if (!chartResolution && innerContent.resolution) {
                chartResolution = innerContent.resolution
              }
            } else {
              if (!chartSymbol && parsedContent.symbol) {
                chartSymbol = parsedContent.symbol
              }
              if (!chartResolution && parsedContent.resolution) {
                chartResolution = parsedContent.resolution
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors, use provided values or defaults
        }

        const chartId = chart || null
        const chartData = {
          id: chartId,
          user_id: user.id,
          name,
          content: typeof chartContent === 'string' ? chartContent : JSON.stringify(chartContent),
          symbol: chartSymbol || null,
          resolution: chartResolution || null,
          type: chartType
        }

        const savedId = await Database.saveChart(chartData)
        // Convert string ID to number if it's numeric
        const formattedId = /^\d+$/.test(savedId) ? parseInt(savedId, 10) : savedId
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok',
          id: formattedId
        })
      } else if (method === 'DELETE') {
        // Delete chart
        if (!chart) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: 'error',
            message: 'Chart ID is required'
          })
        }

        await Database.deleteChart(chart, user.id, chartType)
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok'
        })
      } else {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
          status: 'error',
          message: 'Method not allowed'
        })
      }
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Handle study templates API requests
   * GET /api/backtester/chart_storage/:version/study_templates
   * POST /api/backtester/chart_storage/:version/study_templates
   * DELETE /api/backtester/chart_storage/:version/study_templates
   */
  async handleStudyTemplates(req, res) {
    try {
      const { version } = req.params
      const { client, user: username, template_name } = req.query
      
      // Verify authentication
      const user = await this.verifyChartStorageAuth(client, username)
      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: 'error',
          message: 'Invalid authentication'
        })
      }

      const method = req.method

      if (method === 'GET') {
        if (template_name) {
          // Get specific template
          const template = await Database.getStudyTemplateByName(template_name, user.id)
          if (!template) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
              status: 'error',
              message: 'Template not found'
            })
          }
          return res.status(HTTP_STATUS.OK).json({
            status: 'ok',
            data: {
              name: template.name,
              content: template.content
            }
          })
        } else {
          // Get all templates
          const templates = await Database.getStudyTemplatesByUserId(user.id)
          return res.status(HTTP_STATUS.OK).json({
            status: 'ok',
            data: templates
          })
        }
      } else if (method === 'POST') {
        // Save template
        const { name, content } = req.body
        
        if (!name) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: 'error',
            message: 'Template name is required'
          })
        }

        const templateData = {
          user_id: user.id,
          name,
          content: typeof content === 'string' ? content : (content ? JSON.stringify(content) : '{}')
        }

        await Database.saveStudyTemplate(templateData)
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok'
        })
      } else if (method === 'DELETE') {
        // Delete template
        if (!template_name) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: 'error',
            message: 'Template name is required'
          })
        }

        await Database.deleteStudyTemplate(template_name, user.id)
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok'
        })
      } else {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
          status: 'error',
          message: 'Method not allowed'
        })
      }
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Handle chart snapshot uploads
   * POST /api/backtester/chart_snapshot
   * TradingView sends snapshot images to this endpoint
   */
  async handleChartSnapshot(req, res) {
    try {
      // TradingView sends snapshot as multipart/form-data
      // The snapshot is typically in req.body or req.files depending on multer config
      const snapshot = req.body.snapshot || req.body.image || req.body.data
      
      if (!snapshot) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: 'error',
          message: 'No snapshot data provided'
        })
      }

      // For now, just return success - you can save the snapshot to storage if needed
      // The snapshot_url is mainly used by TradingView's takeScreenshot() method
      // which can return the image data directly without needing to upload it
      return res.status(HTTP_STATUS.OK).json({
        status: 'ok',
        message: 'Snapshot received'
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Handle drawing templates API requests
   * GET /api/backtester/chart_storage/:version/drawing_templates
   * POST /api/backtester/chart_storage/:version/drawing_templates
   * DELETE /api/backtester/chart_storage/:version/drawing_templates
   */
  async handleDrawingTemplates(req, res) {
    try {
      const { version } = req.params
      const { client, user: username, template_name, name, tool } = req.query

      // Verify authentication
      const user = await this.verifyChartStorageAuth(client, username)
      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: 'error',
          message: 'Invalid authentication'
        })
      }

      // Use 'name' parameter if 'template_name' is not provided
      const templateName = template_name || name

      const method = req.method

      if (method === 'GET') {
        if (templateName) {
          // Get specific template
          const template = await Database.getDrawingTemplateByNameAndTool(templateName, user.id, tool)
          if (!template) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
              status: 'error',
              message: 'Template not found'
            })
          }
          return res.status(HTTP_STATUS.OK).json({
            status: 'ok',
            data: {
              name: template.name,
              content: template.content
            }
          })
        } else {
          // Get all templates for the specified tool
          const templates = await Database.getDrawingTemplatesByUserAndTool(user.id, tool)
          return res.status(HTTP_STATUS.OK).json({
            status: 'ok',
            data: templates.map(template => template.name)
          })
        }
      } else if (method === 'POST') {
        // Save drawing template
        const { name: bodyName, content } = req.body

        // Use name from query params (templateName combines template_name and name from query)
        const templateNameToUse = bodyName || templateName

        if (!templateNameToUse || !tool) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: 'error',
            message: 'Template name and tool are required'
          })
        }

        const templateData = {
          user_id: user.id,
          name: templateNameToUse,
          tool,
          content: typeof content === 'string' ? content : (content ? JSON.stringify(content) : '{}')
        }

        await Database.saveDrawingTemplate(templateData)
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok'
        })
      } else if (method === 'DELETE') {
        // Delete drawing template
        if (!templateName || !tool) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: 'error',
            message: 'Template name and tool are required'
          })
        }

        await Database.deleteDrawingTemplate(templateName, user.id, tool)
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok'
        })
      } else {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
          status: 'error',
          message: 'Method not allowed'
        })
      }
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get all symbols from config (admin only)
   */
  async getSymbolsConfig(req, res) {
    try {
      const configPath = path.join(__dirname, '../../data/backtester/config.json')
      
      if (!fs.existsSync(configPath)) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          symbols: {},
        })
      }

      const configData = fs.readFileSync(configPath, 'utf8')
      const config = JSON.parse(configData)
      
      // Clear cache to ensure fresh data
      BacktesterController.symbolConfigCache = null
      BacktesterController.configCacheTime = null

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        symbols: config.symbols || {},
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Add or update a symbol in config (admin only)
   */
  async saveSymbolConfig(req, res) {
    try {
      const { symbol, tickSize, tickValue, exchangeFee, regulatoryFee, commissionFee, totalFees, description, type, ticker_type, tickers } = req.body

      if (!symbol) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Symbol is required',
        })
      }

      // For futures, tickSize and tickValue are required
      if (ticker_type === 'futures' && (!tickSize || !tickValue)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'TickSize and tickValue are required for futures',
        })
      }

      const configPath = path.join(__dirname, '../../data/backtester/config.json')

      // Read existing config
      let config = { symbols: {} }
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8')
        config = JSON.parse(configData)
        if (!config.symbols) {
          config.symbols = {}
        }
      }

      // Add or update symbol
      const existing = config.symbols[symbol] || {}
      const symbolConfig = {
        description: description || existing.description || symbol,
        ...(type && { type }),
        ...(ticker_type && { ticker_type }),
        ...(existing.tickers && { tickers: { ...existing.tickers } }),
      }

      if (tickers && typeof tickers === 'object') {
        symbolConfig.tickers = {
          ...(symbolConfig.tickers || {}),
          ...(typeof tickers.tradesea === 'string' ? { tradesea: tickers.tradesea.trim() } : {}),
          ...(typeof tickers.tradingview === 'string' ? { tradingview: tickers.tradingview.trim() } : {}),
        }
        if (symbolConfig.tickers.tradesea === '') delete symbolConfig.tickers.tradesea
        if (symbolConfig.tickers.tradingview === '') delete symbolConfig.tickers.tradingview
        if (!Object.keys(symbolConfig.tickers).length) delete symbolConfig.tickers
      }

      // Only include tick size/value and fees when provided (futures defaults)
      if (tickSize != null && tickValue != null) {
        // Use provided totalFees or calculate from individual fees
        const finalTotalFees = totalFees !== undefined && totalFees !== null
          ? parseFloat(totalFees)
          : (parseFloat(exchangeFee) || 0) +
            (parseFloat(regulatoryFee) || 0) +
            (parseFloat(commissionFee) || 0)

        symbolConfig.tickSize = parseFloat(tickSize)
        symbolConfig.tickValue = parseFloat(tickValue)
        symbolConfig.exchangeFee = parseFloat(exchangeFee) || 0
        symbolConfig.regulatoryFee = parseFloat(regulatoryFee) || 0
        symbolConfig.commissionFee = parseFloat(commissionFee) || 0
        symbolConfig.totalFees = finalTotalFees
      }

      config.symbols[symbol] = symbolConfig

      // Ensure directory exists
      const configDir = path.dirname(configPath)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }

      // Write back to file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
      
      // Clear cache
      BacktesterController.symbolConfigCache = null
      BacktesterController.configCacheTime = null

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Symbol ${symbol} saved successfully`,
        symbol: config.symbols[symbol],
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get CSV files list by type (admin only)
   */
  async getCSVFilesByType(req, res) {
    try {
      const { type } = req.query

      if (!type || (type !== 'topstep' && type !== 'tradingview' && type !== 'unknown')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Type must be either "topstep", "tradingview", or "unknown"',
        })
      }

      const configPath = path.join(__dirname, '../../data/backtester/config.json')
      const csvDir = path.join(__dirname, '../../data/backtester/csv')

      if (!fs.existsSync(configPath)) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          files: [],
        })
      }

      // Read config to get symbols by type
      const configData = fs.readFileSync(configPath, 'utf8')
      const config = JSON.parse(configData)
      const symbols = config.symbols || {}

      let csvFiles = []

      if (type === 'unknown') {
        const configSymbols = new Set(Object.keys(symbols))
        csvFiles = listAllCsvFiles(csvDir).filter((file) => {
          const normalizedSymbol = file.symbol.startsWith('/') ? file.symbol.slice(1) : file.symbol
          const inConfig = configSymbols.has(normalizedSymbol)
            || configSymbols.has(`/${normalizedSymbol}`)
            || configSymbols.has(file.symbol)
          return !inConfig
        })
      } else {
        const symbolsByType = Object.keys(symbols).filter((symbol) => {
          const symbolData = symbols[symbol]
          return (symbolData.type || 'topstep') === type
        })

        for (const symbol of symbolsByType) {
          csvFiles.push(...listSymbolCsvFiles(csvDir, symbol))
        }
      }

      // Sort by year (descending), then by month
      csvFiles.sort((a, b) => {
        if (b.year !== a.year) {
          return b.year - a.year
        }
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ]
        return months.indexOf(b.month) - months.indexOf(a.month)
      })

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        files: csvFiles,
        count: csvFiles.length,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Delete a symbol from config (admin only)
   */
  async deleteSymbolConfig(req, res) {
    try {
      const { symbol } = req.params

      if (!symbol) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Symbol is required',
        })
      }

      const configPath = path.join(__dirname, '../../data/backtester/config.json')
      
      if (!fs.existsSync(configPath)) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Config file not found',
        })
      }

      // Read existing config
      const configData = fs.readFileSync(configPath, 'utf8')
      const config = JSON.parse(configData)
      
      if (!config.symbols || !config.symbols[symbol]) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: `Symbol ${symbol} not found`,
        })
      }

      // Delete symbol
      delete config.symbols[symbol]

      // Ensure directory exists (should already exist, but ensure it for safety)
      const configDir = path.dirname(configPath)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }

      // Write back to file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
      
      // Clear cache
      BacktesterController.symbolConfigCache = null
      BacktesterController.configCacheTime = null

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Symbol ${symbol} deleted successfully`,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get all testing strategies for the current user
   */
  async getTestingStrategies(req, res) {
    try {
      await this.initializeTestingStrategiesTable()
      const userId = req.user.id

      const strategies = await Database.query(
        'SELECT * FROM backtester_testing_strategies WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      )

      const result = await Promise.all(strategies.map(async (strategy) => {
        const rules = await Database.query(
          'SELECT * FROM backtester_testing_strategy_rules WHERE strategy_id = ? ORDER BY rule_order ASC',
          [strategy.id]
        )

        return {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description || '',
          rules: rules.map(rule => ({
            id: rule.id,
            type: rule.type,
            timeframe: rule.timeframe || '',
            label: rule.label || '',
            value: rule.value || '',
            order: rule.rule_order
          })),
          created_at: strategy.created_at,
          updated_at: strategy.updated_at
        }
      }))

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        strategies: result
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Create a new testing strategy
   */
  async createTestingStrategy(req, res) {
    try {
      await this.initializeTestingStrategiesTable()
      const userId = req.user.id
      const { name, description, rules } = req.body

      if (!name || !name.trim()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Strategy name is required'
        })
      }

      const strategyId = `testing-strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Insert strategy
      await Database.run(
        'INSERT INTO backtester_testing_strategies (id, user_id, name, description) VALUES (?, ?, ?, ?)',
        [strategyId, userId, name.trim(), description || null]
      )

      // Insert rules
      if (rules && Array.isArray(rules)) {
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i]
          const ruleId = `rule-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`
          await Database.run(
            'INSERT INTO backtester_testing_strategy_rules (id, strategy_id, type, timeframe, label, value, include_timeframe, display_type, rule_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              ruleId,
              strategyId,
              rule.type || 'level',
              rule.timeframe || null,
              rule.label || null,
              rule.value ? String(rule.value) : null,
              rule.includeTimeframe ? 1 : 0,
              rule.displayType || 'text',
              rule.order || i
            ]
          )
        }
      }

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Testing strategy created successfully',
        strategy: { id: strategyId, name: name.trim() }
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Update a testing strategy
   */
  async updateTestingStrategy(req, res) {
    try {
      await this.initializeTestingStrategiesTable()
      const userId = req.user.id
      const strategyId = req.params.id
      const { name, description, rules } = req.body

      // Verify ownership
      const existing = await Database.get(
        'SELECT id FROM backtester_testing_strategies WHERE id = ? AND user_id = ?',
        [strategyId, userId]
      )

      if (!existing) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Testing strategy not found'
        })
      }

      // Update strategy
      if (name !== undefined) {
        await Database.run(
          'UPDATE backtester_testing_strategies SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [name.trim(), description || null, strategyId, userId]
        )
      }

      // Delete existing rules and insert new ones
      await Database.run(
        'DELETE FROM backtester_testing_strategy_rules WHERE strategy_id = ?',
        [strategyId]
      )

      if (rules && Array.isArray(rules)) {
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i]
          const ruleId = `rule-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`
          await Database.run(
            'INSERT INTO backtester_testing_strategy_rules (id, strategy_id, type, timeframe, label, value, include_timeframe, display_type, rule_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              ruleId,
              strategyId,
              rule.type || 'level',
              rule.timeframe || null,
              rule.label || null,
              rule.value ? String(rule.value) : null,
              rule.includeTimeframe ? 1 : 0,
              rule.displayType || 'text',
              rule.order || i
            ]
          )
        }
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Testing strategy updated successfully'
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Save testing strategy log entry
   */
  async saveTestingStrategyLog(req, res) {
    try {
      await this.initializeTestingStrategyLogsTable()
      const userId = req.user.id
      const { sessionId, strategyId, entries } = req.body

      if (!sessionId || !strategyId || !entries || !Array.isArray(entries)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Session ID, strategy ID, and entries array are required'
        })
      }

      // Verify session belongs to user
      const session = await Database.get(
        'SELECT id FROM backtester_sessions WHERE id = ? AND user_id = ?',
        [sessionId, userId]
      )

      if (!session) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Session not found'
        })
      }

      // Verify strategy belongs to user
      const strategy = await Database.get(
        'SELECT id FROM backtester_testing_strategies WHERE id = ? AND user_id = ?',
        [strategyId, userId]
      )

      if (!strategy) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Strategy not found'
        })
      }

      // Delete existing logs for this session and strategy
      await Database.run(
        'DELETE FROM backtester_testing_strategy_logs WHERE session_id = ? AND strategy_id = ? AND user_id = ?',
        [sessionId, strategyId, userId]
      )

      // Insert new log entries
      for (const entry of entries) {
        const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        await Database.run(
          `INSERT INTO backtester_testing_strategy_logs 
           (id, user_id, session_id, strategy_id, rule_id, rule_index, type, content, text_content, timestamp, entry_id, symbol, resolution)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            logId,
            userId,
            sessionId,
            strategyId,
            entry.ruleId || '',
            entry.ruleIndex || 0,
            entry.type || 'text',
            entry.content || null,
            entry.textContent || null,
            entry.timestamp || Date.now(),
            entry.entryId || null,
            entry.symbol || null,
            entry.resolution || null
          ]
        )
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logs saved successfully'
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get testing strategy logs
   */
  async getTestingStrategyLogs(req, res) {
    try {
      await this.initializeTestingStrategyLogsTable()
      const userId = req.user.id
      const { sessionId, strategyId } = req.query

      let query = 'SELECT * FROM backtester_testing_strategy_logs WHERE user_id = ?'
      const params = [userId]

      if (sessionId) {
        query += ' AND session_id = ?'
        params.push(sessionId)
      }

      if (strategyId) {
        query += ' AND strategy_id = ?'
        params.push(strategyId)
      }

      query += ' ORDER BY timestamp DESC'

      const logs = await Database.query(query, params)

            return res.status(HTTP_STATUS.OK).json({
              success: true,
              logs: logs.map(log => ({
                id: log.id,
                sessionId: log.session_id,
                strategyId: log.strategy_id,
                ruleId: log.rule_id,
                ruleIndex: log.rule_index,
                type: log.type,
                content: log.content,
                textContent: log.text_content || undefined,
                timestamp: log.timestamp,
                entryId: log.entry_id || undefined,
                symbol: log.symbol || undefined,
                resolution: log.resolution || undefined,
                createdAt: log.created_at
              }))
            })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Delete a testing strategy
   */
  async deleteTestingStrategy(req, res) {
    try {
      await this.initializeTestingStrategiesTable()
      const userId = req.user.id
      const strategyId = req.params.id

      // Verify ownership
      const existing = await Database.get(
        'SELECT id FROM backtester_testing_strategies WHERE id = ? AND user_id = ?',
        [strategyId, userId]
      )

      if (!existing) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Testing strategy not found'
        })
      }

      // Delete rules first (CASCADE should handle this, but explicit is better)
      await Database.run(
        'DELETE FROM backtester_testing_strategy_rules WHERE strategy_id = ?',
        [strategyId]
      )

      // Delete strategy
      await Database.run(
        'DELETE FROM backtester_testing_strategies WHERE id = ? AND user_id = ?',
        [strategyId, userId]
      )

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Testing strategy deleted successfully'
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }
}

export default new BacktesterController()

