import Database from '../../config/Database.js'

export function validateAccountSettings(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Account settings must be an object.')
  const fields = ['dllEnabled', 'dllAmount', 'consistencyPercent', 'drawdownMethod', 'profitTarget', 'maxLoss']
  if (Object.keys(body).some(key => !fields.includes(key))) throw new Error('Unknown account setting.')
  const result = Object.fromEntries(fields.map(key => [key, body[key] ?? null]))
  if (result.dllEnabled !== null && typeof result.dllEnabled !== 'boolean') throw new Error('Choose whether DLL is on or off.')
  if (result.drawdownMethod !== null && !['eod', 'intraday', 'static'].includes(result.drawdownMethod)) throw new Error('Choose a valid drawdown method.')
  for (const key of ['dllAmount', 'consistencyPercent', 'profitTarget', 'maxLoss']) {
    const value = result[key]
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > (key === 'consistencyPercent' ? 100 : 10000000))) throw new Error(`Invalid ${key}.`)
  }
  if (result.maxLoss === 0 || result.dllAmount === 0) throw new Error('Loss limits must be greater than zero.')
  if (result.dllEnabled !== true) result.dllAmount = null
  return result
}

export class TradeseaAccountSettingsStore {
  constructor(db = Database) { this.db = db; this.ready = null }

  initialize() {
    if (!this.ready) this.ready = (async () => {
      await this.db.run(`CREATE TABLE IF NOT EXISTS tradesea_account_settings (
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      settings TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, account_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`)
      const columns = await this.db.query('PRAGMA table_info(tradesea_account_settings)')
      for (const [name, definition] of [['account_details', 'TEXT'], ['available', 'INTEGER NOT NULL DEFAULT 0'], ['hidden', 'INTEGER NOT NULL DEFAULT 0']]) {
        if (!columns.some(column => column.name === name)) await this.db.run(`ALTER TABLE tradesea_account_settings ADD COLUMN ${name} ${definition}`)
      }
      // The application's older SQLite connections do not enable foreign_keys.
      await this.db.run(`CREATE TRIGGER IF NOT EXISTS delete_user_tradesea_account_settings
        AFTER DELETE ON users BEGIN
          DELETE FROM tradesea_account_settings WHERE user_id = OLD.id;
        END`)
    })().catch(error => { this.ready = null; throw error })
    return this.ready
  }

  async save(userId, accountId, body) {
    const settings = validateAccountSettings(body)
    await this.initialize()
    if (Object.values(settings).every(value => value === null)) {
      await this.db.run("UPDATE tradesea_account_settings SET settings = '{}' WHERE user_id = ? AND account_id = ? AND hidden = 0", [userId, accountId])
      return null
    }
    await this.db.run('UPDATE tradesea_account_settings SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND account_id = ? AND hidden = 0',
      [JSON.stringify(settings), userId, accountId])
    return settings
  }

  // Missing provider accounts are retained until explicitly removed by the user.
  // Hidden tombstones prevent the next automatic refresh from re-adding them.
  async remember(userId, accounts, { full = true, restore = false } = {}) {
    await this.initialize()
    if (full) await this.db.run('UPDATE tradesea_account_settings SET available = 0 WHERE user_id = ?', [userId])
    for (const account of accounts) {
      const metadata = Object.fromEntries(['id', 'label', 'name', 'propFirm', 'propFirmDisplayName', 'accountType', 'externalAccountId', 'isArchived'].map(key => [key, account[key]]))
      await this.db.run(`INSERT INTO tradesea_account_settings (user_id, account_id, settings, account_details, available, hidden)
        VALUES (?, ?, '{}', ?, ?, 0) ON CONFLICT(user_id, account_id) DO UPDATE SET
        account_details = CASE WHEN hidden = 0 OR ? = 1 THEN excluded.account_details ELSE NULL END,
        available = CASE WHEN hidden = 0 OR ? = 1 THEN excluded.available ELSE 0 END,
        hidden = CASE WHEN ? = 1 THEN 0 ELSE hidden END`,
      [userId, String(account.id), JSON.stringify(metadata), account.isArchived ? 0 : 1, restore ? 1 : 0, restore ? 1 : 0, restore ? 1 : 0])
    }
    return new Map((await this.list(userId)).map(account => [account.id, account.ruleSettings]))
  }

  async list(userId) {
    await this.initialize()
    const rows = await this.db.query('SELECT account_id, account_details, settings, available FROM tradesea_account_settings WHERE user_id = ? AND hidden = 0 AND account_details IS NOT NULL ORDER BY updated_at DESC, account_id', [userId])
    return rows.map(row => ({ ...JSON.parse(row.account_details), id: row.account_id,
      ruleSettings: Object.keys(JSON.parse(row.settings)).length ? JSON.parse(row.settings) : null,
      providerAvailable: row.available === 1 }))
  }

  async remove(userId, accountId) {
    await this.initialize()
    await this.db.run("UPDATE tradesea_account_settings SET hidden = 1, account_details = NULL, settings = '{}', available = 0 WHERE user_id = ? AND account_id = ?", [userId, accountId])
  }
}

export default new TradeseaAccountSettingsStore()
