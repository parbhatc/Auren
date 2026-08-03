import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_STATE_PATH = '/root/live_models/model_3f/custom_setups_account.json'
const DEFAULT_TRADE_LOG_PATH = '/root/live_models/model_3f/custom_setups_live_trades.csv'
const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_HISTORICAL_PATH = path.resolve(
  SERVICE_DIR,
  '../../../../testingdata/outputs/custom_setups_time_filtered_update/accepted_trades_available_candidate_replay.csv'
)
const PRIORITY = Object.freeze([2, 1, 3, 4, 5, 6, 7, 8])

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }
  if (rows.length < 2) return []
  const headers = rows[0]
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ''])))
}

function finiteNumber(value) {
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}

function isoTime(value) {
  if (value == null || value === '') return ''
  const numeric = Number(value)
  const timestamp = Number.isFinite(numeric)
    ? numeric * (Math.abs(numeric) < 100_000_000_000 ? 1000 : 1)
    : Date.parse(String(value))
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : ''
}

function normalizePosition(row, completed = false) {
  if (!row) return null
  const setupId = finiteNumber(row.setupId ?? row.setup_id ?? row.setup)
  const entry = finiteNumber(row.entry)
  const stop = finiteNumber(row.stop)
  const target = finiteNumber(row.target)
  const entryTime = isoTime(row.entryTime ?? row.entry_time)
  if (!setupId || entry == null || stop == null || target == null || !entryTime) return null
  return {
    setupId,
    side: String(row.side ?? row.direction ?? '').toUpperCase(),
    entry,
    stop,
    target,
    qty: finiteNumber(row.initialQty ?? row.qty ?? row.contracts),
    riskUsd: finiteNumber(row.riskUsd ?? row.risk_usd ?? row.riskUsd),
    entryTime,
    exit: completed ? finiteNumber(row.exit) : null,
    exitTime: completed ? isoTime(row.exitTime ?? row.exit_time) || null : null,
    reason: completed
      ? String(row.reason ?? (finiteNumber(row.netPnl) >= 0 ? 'HISTORICAL_WIN' : 'HISTORICAL_LOSS'))
      : null,
    pnl: completed ? finiteNumber(row.pnl ?? row.netPnl) : null,
    confluences: completed
      ? String(row.confluences ?? '').split(' | ').filter(Boolean)
      : Array.isArray(row.confluences) ? row.confluences.map(String) : [],
    status: completed ? 'CLOSED' : 'OPEN',
  }
}

export class CustomSetupsPaperService {
  constructor({
    statePath = process.env.CUSTOM_SETUPS_STATE_PATH || DEFAULT_STATE_PATH,
    tradeLogPath = process.env.CUSTOM_SETUPS_TRADE_LOG_PATH || DEFAULT_TRADE_LOG_PATH,
    historicalPath = process.env.CUSTOM_SETUPS_HISTORICAL_PATH || DEFAULT_HISTORICAL_PATH,
  } = {}) {
    this.statePath = statePath
    this.tradeLogPath = tradeLogPath
    this.historicalPath = historicalPath
    this.cacheKey = ''
    this.cache = null
  }

  fileVersion(file) {
    try {
      const stat = fs.statSync(file)
      return `${stat.mtimeMs}:${stat.size}`
    } catch {
      return 'missing'
    }
  }

  snapshot(limit = 1000) {
    const normalizedLimit = Math.max(1, Math.min(5000, Number(limit) || 1000))
    const key = `${this.fileVersion(this.statePath)}|${this.fileVersion(this.tradeLogPath)}|${this.fileVersion(this.historicalPath)}|${normalizedLimit}`
    if (this.cache && this.cacheKey === key) return this.cache

    let state = null
    let completed = []
    try {
      state = JSON.parse(fs.readFileSync(this.statePath, 'utf8'))
    } catch {
      state = null
    }
    try {
      const rows = parseCsv(fs.readFileSync(this.tradeLogPath, 'utf8'))
      completed = rows.map((row) => normalizePosition(row, true)).filter(Boolean).slice(-normalizedLimit)
    } catch {
      completed = []
    }

    let source = 'LIVE_PAPER_VPS'
    if (completed.length === 0) {
      try {
        const rows = parseCsv(fs.readFileSync(this.historicalPath, 'utf8'))
        completed = rows.map((row) => normalizePosition(row, true)).filter(Boolean).slice(-normalizedLimit)
        if (completed.length > 0) source = 'AUDITED_HISTORICAL_FALLBACK'
      } catch {
        completed = []
      }
    }

    const openPosition = normalizePosition(state?.openPosition, false)
    this.cacheKey = key
    this.cache = {
      available: state != null || completed.length > 0,
      operatingMode: source,
      priority: PRIORITY,
      updatedAt: state?.updatedAt ?? null,
      openPosition,
      trades: completed,
    }
    return this.cache
  }
}

export { normalizePosition, parseCsv }
export default new CustomSetupsPaperService()
