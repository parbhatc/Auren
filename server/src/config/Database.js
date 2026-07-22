import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class Database {
  constructor() {
    this.db = null
    this.dbPath = path.join(__dirname, '../../data/database.sqlite')
    this.initialized = false
  }

  async initialize() {
    if (this.initialized && this.db) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath)
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err)
          reject(err)
        } else {
          console.log('Connected to SQLite database')
          this.createTables()
            .then(() => {
              this.initialized = true
              resolve()
            })
            .catch(reject)
        }
      })
    })
  }

  async createTables() {
    const run = promisify(this.db.run.bind(this.db))

    // Create users table with email_verified and role columns
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email_verified INTEGER DEFAULT 0,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS reset_tokens (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        code TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        type TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Trading Journal Tables
    await run(`
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        timeframes TEXT,
        entry_conditions TEXT,
        invalidation_rules TEXT,
        max_risk REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        max_trades_per_day INTEGER,
        max_daily_loss REAL,
        news_filter INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        strategy_id TEXT,
        symbol TEXT NOT NULL,
        market TEXT NOT NULL,
        trade_date DATE NOT NULL,
        session TEXT,
        direction TEXT NOT NULL,
        entry_price REAL NOT NULL,
        exit_price REAL,
        stop_loss REAL,
        take_profit REAL,
        position_size INTEGER NOT NULL,
        notes TEXT,
        before_screenshot TEXT,
        after_screenshot TEXT,
        risk_per_trade REAL,
        r_multiple_planned REAL,
        r_multiple_actual REAL,
        pnl_dollars REAL,
        pnl_percent REAL,
        outcome TEXT,
        trade_duration INTEGER,
        fees REAL,
        tick_size REAL,
        mae REAL,
        mfe REAL,
        emotion_before TEXT,
        emotion_during TEXT,
        emotion_after TEXT,
        confidence INTEGER,
        fomo INTEGER DEFAULT 0,
        hesitation INTEGER DEFAULT 0,
        revenge INTEGER DEFAULT 0,
        rule_violations TEXT,
        entry_time DATETIME,
        exit_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE SET NULL
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS daily_reviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        review_date DATE NOT NULL,
        followed_rules INTEGER,
        biggest_mistake TEXT,
        best_execution TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, review_date)
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS weekly_reviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        week_start_date DATE NOT NULL,
        week_end_date DATE NOT NULL,
        best_strategy TEXT,
        worst_mistake TEXT,
        most_common_violation TEXT,
        focus_rule TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // TradingView Chart Storage Tables
    await run(`
      CREATE TABLE IF NOT EXISTS chart_storage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        symbol TEXT,
        resolution TEXT,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS study_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS drawing_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tool TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS practice_market_data (
        user_id TEXT PRIMARY KEY,
        prop_firm_id TEXT NOT NULL DEFAULT 'tradesea',
        account_id TEXT NOT NULL DEFAULT '',
        account_label TEXT NOT NULL DEFAULT '',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS practice_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        prop_firm_id TEXT NOT NULL DEFAULT 'tradesea',
        display_name TEXT NOT NULL DEFAULT '',
        mode TEXT NOT NULL,
        size INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        balance REAL NOT NULL,
        high_water_mark REAL NOT NULL,
        drawdown_floor_locked INTEGER NOT NULL DEFAULT 0,
        rules_json TEXT NOT NULL,
        day_pnl_json TEXT NOT NULL DEFAULT '[]',
        market_data_account_id TEXT NOT NULL DEFAULT '',
        market_data_account_label TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        passed_at DATETIME,
        blown_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS practice_positions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        instrument TEXT NOT NULL,
        contracts INTEGER NOT NULL,
        entry REAL NOT NULL,
        stop_loss REAL,
        take_profit REAL,
        entry_time INTEGER NOT NULL,
        type TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES practice_accounts(id) ON DELETE CASCADE
      )
    `)

    await run(`
      CREATE TABLE IF NOT EXISTS practice_trades (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        direction TEXT NOT NULL,
        entry_price REAL NOT NULL,
        exit_price REAL NOT NULL,
        contracts INTEGER NOT NULL,
        pnl REAL NOT NULL,
        fees REAL NOT NULL DEFAULT 0,
        entry_time INTEGER NOT NULL,
        exit_time INTEGER NOT NULL,
        stop_loss REAL,
        take_profit REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES practice_accounts(id) ON DELETE CASCADE
      )
    `)

    // Add email_verified column if it doesn't exist (for existing databases)
    try {
      await run(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`)
    } catch (err) {
      // Column already exists, ignore error
    }

    // Add tick_size column to trades table if it doesn't exist (for existing databases)
    try {
      await run(`ALTER TABLE trades ADD COLUMN tick_size REAL`)
    } catch (err) {
      // Column already exists, ignore error
    }

    // Add role column if it doesn't exist (for existing databases)
    try {
      await run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`)
    } catch (err) {
      // Column already exists, ignore error
    }

    // Add name column if it doesn't exist (for existing databases)
    try {
      await run(`ALTER TABLE users ADD COLUMN name TEXT DEFAULT ''`)
    } catch (err) {
      // Column already exists, ignore error
    }

    // Add type column to chart_storage if it doesn't exist (for existing databases)
    try {
      await run(`ALTER TABLE chart_storage ADD COLUMN type TEXT NOT NULL DEFAULT 'backtester'`)
    } catch (err) {
      // Column already exists, ignore error
    }

    await run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_reset_tokens_email ON reset_tokens(email)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(trade_date)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_strategies_user_id ON strategies(user_id)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_rules_user_id ON rules(user_id)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_date ON daily_reviews(user_id, review_date)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_date ON weekly_reviews(user_id, week_start_date)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_chart_storage_user_id ON chart_storage(user_id)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_study_templates_user_id ON study_templates(user_id)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_drawing_templates_user_tool ON drawing_templates(user_id, tool)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_practice_accounts_user ON practice_accounts(user_id)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_practice_positions_account ON practice_positions(account_id)`)
    await run(`CREATE INDEX IF NOT EXISTS idx_practice_trades_account ON practice_trades(account_id)`)

    try {
      await run(`ALTER TABLE practice_positions ADD COLUMN bracket_snapshot TEXT`)
    } catch (err) {
      // Column already exists
    }

    try {
      await run(
        `ALTER TABLE practice_market_data ADD COLUMN offline_mode_positions INTEGER NOT NULL DEFAULT 0`
      )
    } catch (err) {
      // Column already exists
    }

    try {
      await run(
        `ALTER TABLE practice_market_data ADD COLUMN firm_selections TEXT NOT NULL DEFAULT '{}'`
      )
    } catch (err) {
      // Column already exists
    }

    try {
      await run(`ALTER TABLE practice_accounts ADD COLUMN lockout_until TEXT`)
    } catch (err) {
      // Column already exists
    }

    try {
      await run(`ALTER TABLE practice_accounts ADD COLUMN lockout_reason TEXT`)
    } catch (err) {
      // Column already exists
    }

    try {
      await run(`ALTER TABLE practice_accounts ADD COLUMN last_reset_at TEXT`)
    } catch (err) {
      // Column already exists
    }

    try {
      await run(`ALTER TABLE practice_accounts ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`)
    } catch (err) {
      // Column already exists
    }

    await run(`
      UPDATE practice_accounts
      SET display_name =
        CASE WHEN mode = 'funded' THEN 'AUR-F' ELSE 'AUR-E' END ||
        printf('%03d', CAST(size / 1000 AS INTEGER)) || '-' ||
        upper(substr(replace(replace(id, '_', ''), '-', ''), -8)) || '-TEST' ||
        printf('%03d', (abs(rowid) % 999) + 1)
      WHERE trim(display_name) = ''
    `)

    await run(`
      UPDATE practice_accounts
      SET display_name =
        CASE
          WHEN upper(substr(display_name, 1, 3)) = 'LFF' THEN 'AUR-F'
          ELSE 'AUR-E'
        END || substr(display_name, 4)
      WHERE upper(substr(display_name, 1, 3)) IN ('LFE', 'LFF')
    `)

    try {
      await run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_accounts_user_display_name
        ON practice_accounts(user_id, display_name COLLATE NOCASE)
      `)
    } catch (err) {
      console.warn('Could not create unique practice account name index:', err.message)
    }

    try {
      await run(`ALTER TABLE practice_trades ADD COLUMN forced_exit INTEGER DEFAULT 0`)
    } catch (err) {
      // Column already exists
    }
  }

  // User operations
  async findUserByUsernameOrEmail(usernameOrEmail) {
    const get = promisify(this.db.get.bind(this.db))
    return get('SELECT * FROM users WHERE username = ? OR email = ?', [usernameOrEmail, usernameOrEmail])
  }

  async findUserByEmail(email) {
    const get = promisify(this.db.get.bind(this.db))
    return get('SELECT * FROM users WHERE email = ?', [email])
  }

  async findUserById(id) {
    const get = promisify(this.db.get.bind(this.db))
    return get('SELECT * FROM users WHERE id = ?', [id])
  }

  async createUser(userData) {
    const run = promisify(this.db.run.bind(this.db))
    await run(
      'INSERT INTO users (id, name, username, email, password, email_verified, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userData.id, userData.name || '', userData.username, userData.email, userData.password, userData.email_verified || 0, userData.role || 'user']
    )
    return this.findUserById(userData.id)
  }

  async updateUserPassword(email, hashedPassword) {
    const run = promisify(this.db.run.bind(this.db))
    await run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email])
  }

  async updateUserName(userId, name) {
    const run = promisify(this.db.run.bind(this.db))
    await run('UPDATE users SET name = ? WHERE id = ?', [name, userId])
  }

  async updateUserEmail(userId, email) {
    const run = promisify(this.db.run.bind(this.db))
    await run('UPDATE users SET email = ? WHERE id = ?', [email, userId])
  }

  async verifyUserEmail(email) {
    const run = promisify(this.db.run.bind(this.db))
    await run('UPDATE users SET email_verified = 1 WHERE email = ?', [email])
  }

  async updateUserRole(userId, role) {
    const run = promisify(this.db.run.bind(this.db))
    await run('UPDATE users SET role = ? WHERE id = ?', [role, userId])
  }

  async userExists(username, email) {
    const get = promisify(this.db.get.bind(this.db))
    const user = await get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email])
    return !!user
  }

  async getUserCount() {
    const get = promisify(this.db.get.bind(this.db))
    const result = await get('SELECT COUNT(*) as count FROM users')
    return result ? result.count : 0
  }

  async getAllUsers() {
    const all = promisify(this.db.all.bind(this.db))
    return all('SELECT * FROM users ORDER BY created_at DESC')
  }

  async findUsersByRole(role) {
    const all = promisify(this.db.all.bind(this.db))
    return all('SELECT * FROM users WHERE role = ?', [role])
  }

  async deleteUser(userId) {
    const run = promisify(this.db.run.bind(this.db))
    await run('DELETE FROM users WHERE id = ?', [userId])
  }

  // Reset token operations
  async storeResetToken(token, email) {
    const run = promisify(this.db.run.bind(this.db))
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour from now
    await run(
      'INSERT OR REPLACE INTO reset_tokens (token, email, expires_at) VALUES (?, ?, ?)',
      [token, email, expiresAt.toISOString()]
    )
  }

  async getEmailByResetToken(token) {
    const get = promisify(this.db.get.bind(this.db))
    const result = await get('SELECT email FROM reset_tokens WHERE token = ? AND expires_at > datetime("now")', [token])
    return result ? result.email : null
  }

  async deleteResetToken(token) {
    const run = promisify(this.db.run.bind(this.db))
    await run('DELETE FROM reset_tokens WHERE token = ?', [token])
  }

  async cleanExpiredTokens() {
    const run = promisify(this.db.run.bind(this.db))
    await run('DELETE FROM reset_tokens WHERE expires_at < datetime("now")')
  }

  // Verification code operations
  async storeVerificationCode(code, email, type, expiresAt = null) {
    const run = promisify(this.db.run.bind(this.db))
    const expiry = expiresAt || new Date(Date.now() + 900000).toISOString()
    await run(
      'INSERT OR REPLACE INTO verification_codes (code, email, type, expires_at) VALUES (?, ?, ?, ?)',
      [code, email, type, expiry]
    )
  }

  async deleteVerificationCodesForEmail(email, type) {
    const run = promisify(this.db.run.bind(this.db))
    await run('DELETE FROM verification_codes WHERE email = ? AND type = ?', [email, type])
  }

  async getVerificationCode(code, type) {
    const get = promisify(this.db.get.bind(this.db))
    return get('SELECT * FROM verification_codes WHERE code = ? AND type = ? AND expires_at > datetime("now")', [code, type])
  }

  async getEmailByVerificationCode(code, type) {
    const get = promisify(this.db.get.bind(this.db))
    const result = await get('SELECT email FROM verification_codes WHERE code = ? AND type = ? AND expires_at > datetime("now")', [code, type])
    return result ? result.email : null
  }

  async deleteVerificationCode(code) {
    const run = promisify(this.db.run.bind(this.db))
    await run('DELETE FROM verification_codes WHERE code = ?', [code])
  }

  async cleanExpiredCodes() {
    const run = promisify(this.db.run.bind(this.db))
    await run('DELETE FROM verification_codes WHERE expires_at < datetime("now")')
  }

  // Generic query methods
  async query(sql, params = []) {
    const all = promisify(this.db.all.bind(this.db))
    return all(sql, params)
  }

  async get(sql, params = []) {
    const get = promisify(this.db.get.bind(this.db))
    return get(sql, params)
  }

  async run(sql, params = []) {
    const run = promisify(this.db.run.bind(this.db))
    return run(sql, params)
  }

  // Chart Storage operations
  async getChartsByUserId(userId, type) {
    const all = promisify(this.db.all.bind(this.db))
    return all(
      'SELECT id, name, timestamp, symbol, resolution FROM chart_storage WHERE user_id = ? AND type = ? ORDER BY timestamp DESC',
      [userId, type]
    )
  }

  async getChartById(chartId, userId, type) {
    const get = promisify(this.db.get.bind(this.db))
    return get(
      'SELECT id, name, timestamp, content FROM chart_storage WHERE id = ? AND user_id = ? AND type = ?',
      [chartId, userId, type]
    )
  }

  async saveChart(chartData) {
    const run = promisify(this.db.run.bind(this.db))
    const timestamp = Math.floor(Date.now() / 1000)
    
    if (chartData.id) {
      // Update existing chart
      await run(
        'UPDATE chart_storage SET name = ?, content = ?, symbol = ?, resolution = ?, type = ?, timestamp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [chartData.name, chartData.content, chartData.symbol, chartData.resolution, chartData.type, timestamp, chartData.id, chartData.user_id]
      )
      return chartData.id
    } else {
      // Create new chart
      const id = Date.now().toString()
      await run(
        'INSERT INTO chart_storage (id, user_id, name, content, symbol, resolution, type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, chartData.user_id, chartData.name, chartData.content, chartData.symbol, chartData.resolution, chartData.type, timestamp]
      )
      return id
    }
  }

  async deleteChart(chartId, userId, type) {
    const run = promisify(this.db.run.bind(this.db))
    await run('DELETE FROM chart_storage WHERE id = ? AND user_id = ? AND type = ?', [chartId, userId, type])
  }

  // Study Templates operations
  async getStudyTemplatesByUserId(userId) {
    const all = promisify(this.db.all.bind(this.db))
    return all('SELECT name FROM study_templates WHERE user_id = ? ORDER BY created_at DESC', [userId])
  }

  async getStudyTemplateByName(templateName, userId) {
    const get = promisify(this.db.get.bind(this.db))
    return get(
      'SELECT name, content FROM study_templates WHERE name = ? AND user_id = ?',
      [templateName, userId]
    )
  }

  async saveStudyTemplate(templateData) {
    const run = promisify(this.db.run.bind(this.db))
    
    // Check if template exists
    const existing = await this.getStudyTemplateByName(templateData.name, templateData.user_id)
    
    if (existing) {
      // Update existing template
      await run(
        'UPDATE study_templates SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ? AND user_id = ?',
        [templateData.content, templateData.name, templateData.user_id]
      )
    } else {
      // Create new template
      const id = Date.now().toString()
      await run(
        'INSERT INTO study_templates (id, user_id, name, content) VALUES (?, ?, ?, ?)',
        [id, templateData.user_id, templateData.name, templateData.content]
      )
    }
  }

  async deleteStudyTemplate(templateName, userId) {
    const run = promisify(this.db.run.bind(this.db))
    await run('DELETE FROM study_templates WHERE name = ? AND user_id = ?', [templateName, userId])
  }

  // Drawing Templates operations
  async getDrawingTemplatesByUserAndTool(userId, tool) {
    const all = promisify(this.db.all.bind(this.db))
    return all('SELECT name FROM drawing_templates WHERE user_id = ? AND tool = ? ORDER BY created_at DESC', [userId, tool])
  }

  async getDrawingTemplateByNameAndTool(templateName, userId, tool) {
    const get = promisify(this.db.get.bind(this.db))
    return get(
      'SELECT name, content FROM drawing_templates WHERE name = ? AND user_id = ? AND tool = ?',
      [templateName, userId, tool]
    )
  }

  async saveDrawingTemplate(templateData) {
    const run = promisify(this.db.run.bind(this.db))

    // Check if template exists
    const existing = await this.getDrawingTemplateByNameAndTool(templateData.name, templateData.user_id, templateData.tool)

    if (existing) {
      // Update existing template
      await run(
        'UPDATE drawing_templates SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ? AND user_id = ? AND tool = ?',
        [templateData.content, templateData.name, templateData.user_id, templateData.tool]
      )
    } else {
      // Create new template
      const id = Date.now().toString()
      await run(
        'INSERT INTO drawing_templates (id, user_id, name, tool, content) VALUES (?, ?, ?, ?, ?)',
        [id, templateData.user_id, templateData.name, templateData.tool, templateData.content]
      )
    }
  }

  async deleteDrawingTemplate(templateName, userId, tool) {
    const run = promisify(this.db.run.bind(this.db))
    await run('DELETE FROM drawing_templates WHERE name = ? AND user_id = ? AND tool = ?', [templateName, userId, tool])
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err)
        } else {
          console.log('Database connection closed')
        }
      })
    }
  }
}

export default new Database()
