import { randomUUID } from 'crypto'
import Database from '../config/Database.js'
import {
  normalizePracticePropFirmId,
  resolveMarketDataFromDb,
} from '../utils/practicePropFirms.js'
import {
  getDefaultRules,
  evaluatePracticeRules,
  getMaxContractsForSymbol,
  getCommissionPerContract,
} from '../utils/practiceRules.js'
import {
  calcPracticePnL,
  snapPracticePriceToTick,
} from '../utils/practiceInstrumentTicks.js'
import {
  evaluatePracticeLockout,
  getPracticeSessionDayKey,
  countTradesInSession,
} from '../utils/practiceLockout.js'
import {
  computeSessionDailyLossLimit,
  evaluateDailySessionReset,
  getLastResetBoundaryMs,
} from '../utils/practiceSessionReset.js'
import {
  getPracticeTradeNetPnl,
  getPracticeTradesNetPnl,
} from '../utils/practiceTradePnl.js'
import {
  broadcastOpenPosition,
  broadcastModifyPosition,
  broadcastClosePosition,
} from './practice/PracticeAccountHub.js'

function normalizeTradeSymbol(symbol) {
  let s = String(symbol || '').trim()
  if (!s) return ''
  if (s.includes(':')) {
    s = s.split(':').pop().trim()
  }
  s = s.replace(/[0-9!]+$/g, '').trim()
  return s.toUpperCase()
}

function rowToPosition(row) {
  if (!row) return null
  return {
    id: row.id,
    accountId: row.account_id,
    symbol: row.symbol,
    instrument: row.instrument,
    contracts: row.contracts,
    entry: row.entry,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    entryTime: row.entry_time,
    type: row.type,
  }
}

function newId(prefix = 'pa') {
  return `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}`
}

function practiceAccountDisplayName(mode, size, seed = randomUUID()) {
  const prefix = mode === 'funded' ? 'AUR-F' : 'AUR-E'
  const sizeCode = String(Math.round(Number(size || 0) / 1000)).padStart(3, '0')
  const source = String(seed).replace(/[^a-z0-9]/gi, '').toUpperCase()
  const token = (source.slice(-8) || randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()).padEnd(8, 'X')
  let hash = 0
  for (const char of source) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const serial = String((hash % 999) + 1).padStart(3, '0')
  return `${prefix}${sizeCode}-${token}-TEST${serial}`
}

function normalizePracticeDisplayName(value, fallback) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 64)
  const branded = normalized
    .replace(/^LFE/i, 'AUR-E')
    .replace(/^LFF/i, 'AUR-F')
  return branded || fallback
}

function parseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function rowToAccount(row) {
  if (!row) return null
  const defaults = getDefaultRules(row.size, row.mode)
  const rules = { ...defaults, ...parseJson(row.rules_json, {}) }
  return {
    id: row.id,
    displayName: normalizePracticeDisplayName(
      row.display_name,
      practiceAccountDisplayName(row.mode, row.size, row.id)
    ),
    propFirmId: normalizePracticePropFirmId(row.prop_firm_id),
    mode: row.mode,
    size: row.size,
    status: row.status,
    balance: row.balance,
    highWaterMark: row.high_water_mark,
    drawdownFloorLocked: Boolean(row.drawdown_floor_locked),
    rules,
    dayPnL: parseJson(row.day_pnl_json, []),
    marketDataAccountId: row.market_data_account_id,
    marketDataAccountLabel: row.market_data_account_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    passedAt: row.passed_at,
    blownAt: row.blown_at,
    lockoutUntil: row.lockout_until || null,
    lockoutReason: row.lockout_reason || null,
    lastResetAt: row.last_reset_at || null,
  }
}

class PracticeService {
  async uniqueDisplayName(userId, requested, fallback, excludeAccountId = null) {
    await Database.initialize()
    const base = normalizePracticeDisplayName(requested, fallback)
    for (let attempt = 1; attempt <= 999; attempt += 1) {
      const suffix = attempt === 1 ? '' : `-${attempt}`
      const candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`
      const row = await Database.get(
        `SELECT id FROM practice_accounts
         WHERE user_id = ? AND lower(display_name) = lower(?)
           AND (? IS NULL OR id != ?)
         LIMIT 1`,
        [userId, candidate, excludeAccountId, excludeAccountId]
      )
      if (!row) return candidate
    }
    return practiceAccountDisplayName('eval', 25000)
  }

  async maybeApplySessionReset(userId, account) {
    if (!account) return account

    const evalResult = evaluateDailySessionReset(account)
    if (!evalResult.shouldInit && !evalResult.shouldReset) return account

    if (evalResult.shouldInit) {
      await Database.initialize()
      await Database.run(
        `UPDATE practice_accounts SET last_reset_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [evalResult.lastResetAt, account.id, userId]
      )
      return { ...account, lastResetAt: evalResult.lastResetAt }
    }

    const rules = { ...account.rules }
    rules.sessionDailyLossLimit = computeSessionDailyLossLimit(rules, account.balance)

    const clearLockout =
      evalResult.clearSessionLockout &&
      (account.lockoutReason === 'daily_loss' || account.lockoutReason === 'max_trades')

    if (evalResult.archivedDailyPl != null) {
      console.info('[Practice] daily session reset', {
        accountId: account.id,
        previousSession: evalResult.previousSessionKey,
        archivedDailyPl: evalResult.archivedDailyPl,
        lastResetAt: evalResult.lastResetAt,
        sessionDailyLossLimit: rules.sessionDailyLossLimit,
      })
    }

    await Database.initialize()
    await Database.run(
      `UPDATE practice_accounts SET
        last_reset_at = ?,
        rules_json = ?,
        lockout_until = ?,
        lockout_reason = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        evalResult.lastResetAt,
        JSON.stringify(rules),
        clearLockout ? null : account.lockoutUntil || null,
        clearLockout ? null : account.lockoutReason || null,
        account.id,
        userId,
      ]
    )
    return this.getAccount(userId, account.id)
  }

  async getMarketData(userId) {
    await Database.initialize()
    const row = await Database.get(
      'SELECT * FROM practice_market_data WHERE user_id = ?',
      [userId]
    )
    return resolveMarketDataFromDb(row)
  }

  async saveMarketData(userId, settings) {
    await Database.initialize()
    const propFirmId = normalizePracticePropFirmId(settings.propFirmId)
    const firmSelections =
      settings.byFirm && typeof settings.byFirm === 'object'
        ? JSON.stringify(settings.byFirm)
        : '{}'

    await Database.run(
      `INSERT INTO practice_market_data (user_id, prop_firm_id, account_id, account_label, offline_mode_positions, firm_selections, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         prop_firm_id = excluded.prop_firm_id,
         account_id = excluded.account_id,
         account_label = excluded.account_label,
         offline_mode_positions = excluded.offline_mode_positions,
         firm_selections = excluded.firm_selections,
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        propFirmId,
        settings.accountId || '',
        settings.accountLabel || '',
        0,
        firmSelections,
      ]
    )
    await Database.run(
      `UPDATE practice_accounts
       SET market_data_account_id = ?, market_data_account_label = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [settings.accountId || '', settings.accountLabel || '', userId]
    )
    return this.getMarketData(userId)
  }

  async reconcileAccountStatus(userId, account) {
    if (!account || account.status === 'passed') return account
    const rules = account.rules
    const evalResult = evaluatePracticeRules(
      { ...account, status: 'active' },
      rules,
      account.dayPnL || []
    )

    let status = account.status
    let blownAt = account.blownAt
    let passedAt = account.passedAt

    if (evalResult.blown && account.status !== 'blown') {
      status = 'blown'
      blownAt = new Date().toISOString()
      await this.clearPositions(userId, account.id)
    } else if (!evalResult.blown && account.status === 'blown') {
      status = 'active'
      blownAt = null
    } else if (evalResult.passed && account.status === 'active') {
      status = 'passed'
      passedAt = new Date().toISOString()
    }

    if (
      status === account.status &&
      blownAt === account.blownAt &&
      passedAt === account.passedAt
    ) {
      return account
    }

    await Database.initialize()
    await Database.run(
      `UPDATE practice_accounts SET status = ?, passed_at = ?, blown_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [status, passedAt || null, blownAt || null, account.id, userId]
    )
    return this.getAccount(userId, account.id)
  }

  async listAccounts(userId) {
    await Database.initialize()
    const rows = await Database.query(
      'SELECT * FROM practice_accounts WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    )
    const accounts = rows.map(rowToAccount)
    const reconciled = []
    for (const account of accounts) {
      const reset = await this.maybeApplySessionReset(userId, account)
      reconciled.push(await this.reconcileAccountStatus(userId, reset))
    }
    return reconciled
  }

  async getAccount(userId, accountId) {
    await Database.initialize()
    const row = await Database.get(
      'SELECT * FROM practice_accounts WHERE id = ? AND user_id = ?',
      [accountId, userId]
    )
    const account = rowToAccount(row)
    if (!account) return null
    return this.maybeApplySessionReset(userId, account)
  }

  async createAccount(userId, { mode, size, displayName, rules, marketData }) {
    const defaultRules = getDefaultRules(size, mode)
    const mergedRules = { ...defaultRules, ...(rules || {}) }
    const md = marketData || (await this.getMarketData(userId))
    const id = newId('pa')
    const requestedDisplayName = normalizePracticeDisplayName(
      displayName,
      practiceAccountDisplayName(mode, size, id)
    )
    const resolvedDisplayName = await this.uniqueDisplayName(
      userId,
      requestedDisplayName,
      practiceAccountDisplayName(mode, size, id)
    )
    const now = new Date().toISOString()
    const lastResetAt = new Date(getLastResetBoundaryMs()).toISOString()
    const mergedWithSessionLimit = {
      ...mergedRules,
      sessionDailyLossLimit: computeSessionDailyLossLimit(mergedRules, mergedRules.startingBalance),
    }

    await Database.initialize()
    await Database.run(
      `INSERT INTO practice_accounts (
        id, user_id, prop_firm_id, display_name, mode, size, status, balance, high_water_mark,
        drawdown_floor_locked, rules_json, day_pnl_json,
        market_data_account_id, market_data_account_label, created_at, updated_at, last_reset_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        md.propFirmId || 'tradesea',
        resolvedDisplayName,
        mode,
        size,
        mergedRules.startingBalance,
        mergedRules.startingBalance,
        mode === 'funded' ? 1 : 0,
        JSON.stringify(mergedWithSessionLimit),
        md.accountId || '',
        md.accountLabel || '',
        now,
        now,
        lastResetAt,
      ]
    )
    return this.getAccount(userId, id)
  }

  async updateAccount(userId, accountId, patch) {
    const account = await this.getAccount(userId, accountId)
    if (!account) return null

    const rules = patch.rules ? { ...account.rules, ...patch.rules } : account.rules
    const updates = []
    const params = []

    if (patch.displayName !== undefined) {
      updates.push('display_name = ?')
      params.push(
        await this.uniqueDisplayName(
          userId,
          patch.displayName,
          account.displayName,
          accountId
        )
      )
    }
    if (patch.rules) {
      updates.push('rules_json = ?')
      params.push(JSON.stringify(rules))
    }
    if (patch.status) {
      updates.push('status = ?')
      params.push(patch.status)
    }
    if (patch.balance != null) {
      updates.push('balance = ?')
      params.push(patch.balance)
    }
    if (patch.highWaterMark != null) {
      updates.push('high_water_mark = ?')
      params.push(patch.highWaterMark)
    }
    if (patch.dayPnL) {
      updates.push('day_pnl_json = ?')
      params.push(JSON.stringify(patch.dayPnL))
    }
    if (patch.passedAt !== undefined) {
      updates.push('passed_at = ?')
      params.push(patch.passedAt)
    }
    if (patch.blownAt !== undefined) {
      updates.push('blown_at = ?')
      params.push(patch.blownAt)
    }

    if (!updates.length) return account

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(accountId, userId)

    await Database.initialize()
    await Database.run(
      `UPDATE practice_accounts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    )
    return this.getAccount(userId, accountId)
  }

  async applyBalanceChange(userId, accountId, delta, recordDay = true) {
    let account = await this.getAccount(userId, accountId)
    if (!account || account.status !== 'active') return account

    account = (await this.maybeApplySessionReset(userId, account)) ?? account

    const nextBalance = account.balance + delta
    let highWaterMark = account.highWaterMark
    if (nextBalance > highWaterMark) highWaterMark = nextBalance

    const sessionDay = getPracticeSessionDayKey()
    let dayPnL = [...account.dayPnL]
    if (recordDay && delta !== 0) {
      const existing = dayPnL.find((d) => d.date === sessionDay)
      if (existing) {
        dayPnL = dayPnL.map((d) =>
          d.date === sessionDay ? { ...d, pnl: d.pnl + delta } : d
        )
      } else {
        dayPnL.push({ date: sessionDay, pnl: delta })
      }
    }

    const rules = account.rules
    const evalResult = evaluatePracticeRules(
      {
        ...account,
        balance: nextBalance,
        highWaterMark,
        status: 'active',
      },
      rules,
      dayPnL
    )

    let status = 'active'
    let passedAt = account.passedAt
    let blownAt = account.blownAt
    if (evalResult.blown) {
      status = 'blown'
      blownAt = new Date().toISOString()
      if (account.status === 'active') {
        await this.clearPositions(userId, accountId)
      }
    } else if (evalResult.passed) {
      status = 'passed'
      passedAt = new Date().toISOString()
    }

    await Database.initialize()
    await Database.run(
      `UPDATE practice_accounts SET
        balance = ?, high_water_mark = ?, day_pnl_json = ?, status = ?,
        passed_at = ?, blown_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        nextBalance,
        highWaterMark,
        JSON.stringify(dayPnL),
        status,
        passedAt || null,
        blownAt || null,
        accountId,
        userId,
      ]
    )
    return this.getAccount(userId, accountId)
  }

  async resetAccount(userId, accountId) {
    const account = await this.getAccount(userId, accountId)
    if (!account) return null
    const rules = account.rules
    const start = rules.startingBalance ?? account.size

    const resetRules = {
      ...rules,
      sessionDailyLossLimit: computeSessionDailyLossLimit(rules, start),
    }

    await Database.initialize()
    await Database.run('DELETE FROM practice_trades WHERE account_id = ?', [accountId])
    await Database.run('DELETE FROM practice_positions WHERE account_id = ?', [accountId])
    await Database.run(
      `UPDATE practice_accounts SET
        status = 'active', balance = ?, high_water_mark = ?, day_pnl_json = '[]',
        rules_json = ?,
        passed_at = NULL, blown_at = NULL, drawdown_floor_locked = ?,
        lockout_until = NULL, lockout_reason = NULL,
        last_reset_at = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        start,
        start,
        JSON.stringify(resetRules),
        account.mode === 'funded' ? 1 : 0,
        new Date(getLastResetBoundaryMs()).toISOString(),
        accountId,
        userId,
      ]
    )
    return this.getAccount(userId, accountId)
  }

  async deleteAccount(userId, accountId) {
    const account = await this.getAccount(userId, accountId)
    if (!account) return false

    await Database.initialize()
    await Database.run('DELETE FROM practice_trades WHERE account_id = ?', [accountId])
    await Database.run('DELETE FROM practice_positions WHERE account_id = ?', [accountId])
    await Database.run('DELETE FROM practice_accounts WHERE id = ? AND user_id = ?', [
      accountId,
      userId,
    ])
    return true
  }

  async deleteAllAccounts(userId) {
    const accounts = await this.listAccounts(userId)
    for (const a of accounts) {
      await this.deleteAccount(userId, a.id)
    }
    return true
  }

  async getPositions(userId, accountId) {
    const account = await this.getAccount(userId, accountId)
    if (!account) return []
    await Database.initialize()
    const rows = await Database.query(
      'SELECT * FROM practice_positions WHERE account_id = ? AND contracts != 0 ORDER BY updated_at DESC',
      [accountId]
    )
    return rows.map(rowToPosition)
  }

  async chargeFillCommission(userId, accountId, fillContracts, symbol) {
    const contracts = Math.abs(Number(fillContracts) || 0)
    if (!contracts) return this.getAccount(userId, accountId)

    const account = await this.getAccount(userId, accountId)
    if (!account) return null

    const fee = contracts * getCommissionPerContract(account.rules, symbol)
    if (fee <= 0) return account

    return this.applyBalanceChange(userId, accountId, -fee, false)
  }

  async openPosition(userId, accountId, position) {
    // Client-generated ids make retried websocket mutations idempotent. If the
    // acknowledgement was lost, replaying the same open must not charge another
    // commission or disconnect the account stream.
    if (position?.id) {
      await Database.initialize()
      const existing = await Database.get(
        'SELECT * FROM practice_positions WHERE id = ? AND account_id = ?',
        [position.id, accountId]
      )
      if (existing) {
        const saved = rowToPosition(existing)
        const account = await this.getAccount(userId, accountId)
        if (!account) {
          const err = new Error('Practice account not found')
          err.statusCode = 404
          throw err
        }
        broadcastOpenPosition(userId, accountId, account, saved)
        return saved
      }
    }
    const saved = await this._savePosition(userId, accountId, position, { requireNew: true })
    const account = await this.getAccount(userId, accountId)
    if (account) broadcastOpenPosition(userId, accountId, account, saved)
    return saved
  }

  async modifyPosition(userId, accountId, position) {
    const saved = await this._savePosition(userId, accountId, position, { requireExisting: true })
    const account = await this.getAccount(userId, accountId)
    if (account) broadcastModifyPosition(userId, accountId, account, saved)
    return saved
  }

  /** Manual close from client (market flatten / close line). */
  async closePosition(userId, accountId, positionId, { exitPrice, exitTime, fees, forcedExit } = {}) {
    const account = await this.getAccount(userId, accountId)
    if (!account || account.status !== 'active') {
      const err = new Error('Practice account is not active')
      err.statusCode = 400
      throw err
    }

    await Database.initialize()
    // Atomically claim the row. Manual close and backend bracket close can race;
    // DELETE ... RETURNING guarantees only one path records the fill.
    const row = await Database.get(
      'DELETE FROM practice_positions WHERE id = ? AND account_id = ? RETURNING *',
      [positionId, accountId]
    )
    if (!row) {
      const account = await this.getAccount(userId, accountId)
      return { trade: null, account, alreadyClosed: true }
    }

    const symbol = normalizeTradeSymbol(row.symbol)
    const contracts = Math.abs(Number(row.contracts) || 0)
    let trade = null
    if (exitPrice != null && Number.isFinite(Number(exitPrice)) && contracts) {
      const normalizedExitPrice = snapPracticePriceToTick(symbol, Number(exitPrice))
      const pnl = calcPracticePnL(Number(row.entry), normalizedExitPrice, Number(row.contracts), symbol)
      trade = await this.recordTrade(userId, accountId, {
        symbol,
        direction: row.type,
        entryPrice: row.entry,
        exitPrice: normalizedExitPrice,
        contracts,
        pnl,
        fees,
        entryTime: row.entry_time,
        exitTime: exitTime ?? Math.floor(Date.now() / 1000),
        stopLoss: row.stop_loss,
        takeProfit: row.take_profit,
        forcedExit: Boolean(forcedExit),
      })
    }

    const updatedAccount = await this.getAccount(userId, accountId)
    broadcastClosePosition(userId, accountId, {
      account: updatedAccount,
      positionId,
      symbol,
      exitPrice: exitPrice != null ? Number(exitPrice) : null,
      exitTime: exitTime ?? null,
      trade,
    })
    return { trade, account: updatedAccount }
  }

  /** REST compat — picks open vs modify from existing row. */
  async upsertPosition(userId, accountId, position) {
    await Database.initialize()
    const symbol = normalizeTradeSymbol(position.symbol || position.instrument)
    const existingRow = position.id
      ? await Database.get('SELECT * FROM practice_positions WHERE id = ? AND account_id = ?', [
          position.id,
          accountId,
        ])
      : await Database.get(
          'SELECT * FROM practice_positions WHERE account_id = ? AND symbol = ?',
          [accountId, symbol]
        )
    if (existingRow) return this.modifyPosition(userId, accountId, position)
    return this.openPosition(userId, accountId, position)
  }

  async _savePosition(userId, accountId, position, { requireNew = false, requireExisting = false } = {}) {
    const account = await this.getAccount(userId, accountId)
    if (!account || account.status !== 'active') {
      const err = new Error('Practice account is not active')
      err.statusCode = 400
      throw err
    }

    const symbol = normalizeTradeSymbol(position.symbol || position.instrument)
    const nextContracts = Number(position.contracts) || 0
    const max = getMaxContractsForSymbol(account.size, symbol)
    if (Math.abs(nextContracts) > max) {
      const err = new Error(`Max size is ${max} contracts for ${symbol}`)
      err.statusCode = 400
      throw err
    }

    await Database.initialize()
    const existingRow = position.id
      ? await Database.get('SELECT * FROM practice_positions WHERE id = ? AND account_id = ?', [
          position.id,
          accountId,
        ])
      : await Database.get(
          'SELECT * FROM practice_positions WHERE account_id = ? AND symbol = ?',
          [accountId, symbol]
        )

    if (requireNew && existingRow) {
      const err = new Error('Position already open for this symbol')
      err.statusCode = 400
      throw err
    }
    if (requireExisting && !existingRow) {
      const err = new Error('Position not found')
      err.statusCode = 404
      throw err
    }

    const prevAbs = existingRow ? Math.abs(Number(existingRow.contracts) || 0) : 0
    const nextAbs = Math.abs(nextContracts)
    const fillContracts = Math.max(0, nextAbs - prevAbs)
    if (fillContracts > 0) {
      await this.chargeFillCommission(userId, accountId, fillContracts, symbol)
    }

    const id = position.id || existingRow?.id || newId('pp')
    const instrument = normalizeTradeSymbol(position.instrument || position.symbol)
    const entry = snapPracticePriceToTick(symbol, Number(position.entry))
    const stopLoss = position.stopLoss == null
      ? null
      : snapPracticePriceToTick(symbol, Number(position.stopLoss))
    const takeProfit = position.takeProfit == null
      ? null
      : snapPracticePriceToTick(symbol, Number(position.takeProfit))
    if (![entry, stopLoss, takeProfit].filter((value) => value != null).every(Number.isFinite)) {
      const err = new Error(`Invalid ${symbol} position price`)
      err.statusCode = 400
      throw err
    }
    const entryTime = Number(position.entryTime) || existingRow?.entry_time || Math.floor(Date.now() / 1000)
    const type =
      position.type === 'short' || Number(position.contracts) < 0 ? 'short' : 'long'

    await Database.initialize()
    await Database.run(
      `INSERT INTO practice_positions (
        id, account_id, symbol, instrument, contracts, entry, stop_loss, take_profit, entry_time, type, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        symbol = excluded.symbol,
        instrument = excluded.instrument,
        contracts = excluded.contracts,
        entry = excluded.entry,
        stop_loss = excluded.stop_loss,
        take_profit = excluded.take_profit,
        entry_time = excluded.entry_time,
        type = excluded.type,
        updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        accountId,
        symbol,
        instrument,
        nextContracts,
        entry,
        stopLoss,
        takeProfit,
        entryTime,
        type,
      ]
    )
    const saved = {
      id,
      accountId,
      symbol,
      instrument,
      contracts: nextContracts,
      entry,
      stopLoss,
      takeProfit,
      entryTime,
      type,
    }
    return saved
  }

  async deletePosition(userId, accountId, positionId) {
    return this.closePosition(userId, accountId, positionId)
  }

  async clearPositions(userId, accountId) {
    await Database.initialize()
    await Database.run('DELETE FROM practice_positions WHERE account_id = ?', [accountId])
    return true
  }

  async recordTrade(userId, accountId, trade) {
    const account = await this.getAccount(userId, accountId)
    if (!account) return null

    const id = newId('pt')
    const symbol = normalizeTradeSymbol(trade.symbol)
    const contracts = Math.abs(Number(trade.contracts) || 0)
    const entryPrice = snapPracticePriceToTick(symbol, Number(trade.entryPrice))
    const exitPrice = snapPracticePriceToTick(symbol, Number(trade.exitPrice))
    const signedContracts = String(trade.direction).toLowerCase() === 'short' ? -contracts : contracts
    const pnl = Number.isFinite(entryPrice) && Number.isFinite(exitPrice) && contracts
      ? calcPracticePnL(entryPrice, exitPrice, signedContracts, symbol)
      : Number(trade.pnl) || 0
    const exitCommission =
      trade.fees != null && Number.isFinite(Number(trade.fees))
        ? Number(trade.fees)
        : contracts * getCommissionPerContract(account.rules, normalizeTradeSymbol(trade.symbol))
    await Database.initialize()
    const forcedExit = trade.forcedExit ? 1 : 0
    await Database.run(
      `INSERT INTO practice_trades (
        id, account_id, symbol, direction, entry_price, exit_price, contracts,
        pnl, fees, entry_time, exit_time, stop_loss, take_profit, forced_exit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        accountId,
        symbol,
        trade.direction,
        entryPrice,
        exitPrice,
        trade.contracts,
        pnl,
        exitCommission,
        trade.entryTime,
        trade.exitTime,
        trade.stopLoss ?? null,
        trade.takeProfit ?? null,
        forcedExit,
      ]
    )
    const updated = await this.applyBalanceChange(userId, accountId, pnl - exitCommission, true)
    if (updated) {
      await this.syncLockoutAfterTrade(userId, accountId, updated)
    }
    return { id, pnl, fees: exitCommission }
  }

  async syncLockoutAfterTrade(userId, accountId, account) {
    const trades = await Database.query(
      'SELECT exit_time FROM practice_trades WHERE account_id = ?',
      [accountId]
    )
    const lock = evaluatePracticeLockout(account, { trades })
    if (!lock.shouldPersist || !lock.until) {
      if (account.lockoutUntil && Date.parse(account.lockoutUntil) <= Date.now()) {
        await Database.run(
          `UPDATE practice_accounts SET lockout_until = NULL, lockout_reason = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ?`,
          [accountId, userId]
        )
      }
      return
    }
    await Database.run(
      `UPDATE practice_accounts SET lockout_until = ?, lockout_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [lock.until, lock.reason, accountId, userId]
    )
  }

  async setManualLockout(userId, accountId, { minutes } = {}) {
    const account = await this.getAccount(userId, accountId)
    if (!account) return null
    const mins = Math.max(1, Math.min(24 * 60, Number(minutes) || 15))
    const until = new Date(Date.now() + mins * 60_000).toISOString()
    await Database.initialize()
    await Database.run(
      `UPDATE practice_accounts SET lockout_until = ?, lockout_reason = 'manual', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [until, accountId, userId]
    )
    return this.getAccount(userId, accountId)
  }

  async clearLockout(userId, accountId) {
    const account = await this.getAccount(userId, accountId)
    if (!account) return null
    await Database.initialize()
    await Database.run(
      `UPDATE practice_accounts SET lockout_until = NULL, lockout_reason = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [accountId, userId]
    )
    return this.getAccount(userId, accountId)
  }

  async getLockoutStatus(userId, accountId) {
    const account = await this.getAccount(userId, accountId)
    if (!account) return null
    const trades = await Database.query(
      'SELECT exit_time FROM practice_trades WHERE account_id = ?',
      [accountId]
    )
    return evaluatePracticeLockout(account, { trades })
  }

  async getStats(userId, accountId) {
    const account = await this.getAccount(userId, accountId)
    if (!account) return null

    await Database.initialize()
    const trades = await Database.query(
      'SELECT * FROM practice_trades WHERE account_id = ? ORDER BY exit_time DESC',
      [accountId]
    )
    const rules = account.rules
    const rulesStatus = evaluatePracticeRules(account, rules, account.dayPnL)

    const isForcedExit = (t) => t.forced_exit === 1 || t.forced_exit === true

    let ratedTrades = trades.filter((t) => !isForcedExit(t))
    if (
      account.status === 'blown' &&
      ratedTrades.length > 0 &&
      !trades.some(isForcedExit)
    ) {
      const last = [...trades].sort((a, b) => b.exit_time - a.exit_time)[0]
      if (last && getPracticeTradeNetPnl(last) > 0) {
        ratedTrades = ratedTrades.filter((t) => t.id !== last.id)
      }
    }

    const wins = ratedTrades.filter((t) => getPracticeTradeNetPnl(t) > 0).length
    const losses = ratedTrades.filter((t) => getPracticeTradeNetPnl(t) < 0).length
    const winDenom = wins + losses
    const totalTrades = trades.length
    const totalPnl = getPracticeTradesNetPnl(trades)

    return {
      account,
      rulesStatus,
      totalTrades,
      winRate: winDenom ? (wins / winDenom) * 100 : 0,
      totalPnl,
      trades: trades.map((t) => ({
        id: t.id,
        symbol: t.symbol,
        direction: t.direction,
        entryPrice: t.entry_price,
        exitPrice: t.exit_price,
        contracts: t.contracts,
        pnl: t.pnl,
        fees: t.fees ?? 0,
        entryTime: t.entry_time,
        exitTime: t.exit_time,
      })),
    }
  }
}

export default new PracticeService()
