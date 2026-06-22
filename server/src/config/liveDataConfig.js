import ConfigLoader from './ConfigLoader.js'
import { parseSubscribeMessage } from '../services/rithmic/rithmicMdsWire.js'

/** @returns {{ type?: string, rithmic?: Record<string, unknown> }} */
export function getLiveDataConfig() {
  return ConfigLoader.get('live_data') || {}
}

export function getLiveDataType() {
  return String(getLiveDataConfig().type || '').trim().toLowerCase()
}

/** Rithmic block from `live_data.rithmic` (falls back to legacy top-level `rithmic`). */
export function getRithmicLiveDataConfig() {
  const live = getLiveDataConfig()
  const cfg = live.rithmic || ConfigLoader.get('rithmic') || {}
  const resolution = String(cfg.resolution || '1')
  const tickerInput = String(cfg.ticker || cfg.symbol || 'MNQ').trim()
  const sub =
    parseSubscribeMessage({
      symbol: tickerInput,
      exchange: cfg.exchange,
      resolution,
    }) || null

  return {
    enabled: cfg.enabled !== false,
    connectOnStartup: cfg.connectOnStartup !== false,
    subscribeOnStartup: cfg.subscribeOnStartup !== false,
    seedAdminCredentials: cfg.seedAdminCredentials !== false,
    username: String(cfg.username || '').trim(),
    password: String(cfg.password || ''),
    systemName: String(cfg.systemName || 'LucidTrading').trim(),
    gatewayName: String(cfg.gatewayName || 'Chicago Area').trim(),
    ticker: sub,
    resolution,
  }
}

export function isRithmicLiveData() {
  const type = getLiveDataType()
  if (type === 'rithmic') return true
  // Legacy: top-level rithmic block without live_data.type
  if (!type && ConfigLoader.get('rithmic')) return true
  return false
}

/** True when stored/browser creds are the same account as `live_data.rithmic`. */
export function credentialsMatchLiveDataRithmic(credentials) {
  if (!isRithmicLiveData()) return false
  const cfg = getRithmicLiveDataConfig()
  if (!cfg.enabled || !cfg.connectOnStartup) return false
  if (!cfg.username || !cfg.password) return false

  const user = credentials?.username?.trim()
  const pass = credentials?.password
  if (!user || !pass) return false
  if (user !== cfg.username || pass !== cfg.password) return false

  const system = credentials.systemName?.trim()
  if (system && system !== cfg.systemName) return false
  return true
}
