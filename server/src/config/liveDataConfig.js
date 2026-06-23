import ConfigLoader from './ConfigLoader.js'

/** @returns {{ type?: string, rithmic?: Record<string, unknown> }} */
export function getLiveDataConfig() {
  return ConfigLoader.get('live_data') || {}
}

export function getLiveDataType() {
  return String(getLiveDataConfig().type || '').trim().toLowerCase()
}

function parseStartupTicker(cfg) {
  const symbol = String(cfg.ticker || cfg.symbol || '').trim()
  if (!symbol) return null
  const exchange = String(cfg.exchange || 'CME').trim() || 'CME'
  const resolution =
    cfg.resolution != null && String(cfg.resolution).trim() !== ''
      ? String(cfg.resolution).trim()
      : '1'
  return { symbol, exchange, resolution }
}

/** Rithmic block from `live_data.rithmic`. */
export function getRithmicLiveDataConfig() {
  const live = getLiveDataConfig()
  const cfg = live.rithmic || {}
  const ticker = parseStartupTicker(cfg)

  return {
    enabled: cfg.enabled !== false,
    connectOnStartup: cfg.connectOnStartup !== false,
    subscribeOnStartup: cfg.subscribeOnStartup === true,
    username: String(cfg.username || '').trim(),
    password: String(cfg.password || ''),
    systemName: String(cfg.systemName || 'LucidTrading').trim(),
    gatewayName: String(cfg.gatewayName || 'Chicago Area').trim(),
    ticker,
  }
}

export function isRithmicLiveData() {
  return getLiveDataType() === 'rithmic'
}
