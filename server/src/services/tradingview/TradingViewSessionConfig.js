import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '../../../data/config.json')

export function readTradingViewSessionId({ sessionId, sessionIdEnv = 'TRADINGVIEW_SESSION_ID', configPath = DEFAULT_CONFIG_PATH } = {}) {
  const explicit = String(sessionId || '').trim()
  if (explicit) return explicit
  const environment = String(process.env[sessionIdEnv] || '').trim()
  if (environment) return environment
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    return String(config?.sessions?.tradingview || '').trim()
  } catch {
    return ''
  }
}
