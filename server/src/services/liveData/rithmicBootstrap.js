import { getRithmicLiveDataConfig } from '../../config/liveDataConfig.js'
import {
  openRithmicChartLive,
  subscribeRithmicChartLive,
} from './rithmicChartLive.js'
import { startPracticeBracketEngine } from '../practice/PracticeBracketEngine.js'
import {
  logLiveDataError,
  logLiveDataInfo,
  logLiveDataWarn,
} from './liveDataLog.js'

const PROVIDER = 'Rithmic'

/** @type {Promise<{ ok: boolean, skipped?: boolean, message?: string, provider?: string }> | null} */
let liveDataBootstrapTask = null

export function beginRithmicLiveDataBootstrap() {
  if (!liveDataBootstrapTask) {
    liveDataBootstrapTask = bootstrapRithmicLiveData()
  }
  return liveDataBootstrapTask
}

export function whenRithmicLiveDataReady() {
  return liveDataBootstrapTask ?? Promise.resolve({ ok: false, skipped: true, provider: 'rithmic' })
}

/** Connect ChartLive on server start using `live_data.rithmic` from config.json. */
export async function bootstrapRithmicLiveData() {
  const cfg = getRithmicLiveDataConfig()
  if (!cfg.enabled) {
    logLiveDataInfo(`${PROVIDER} startup disabled (live_data.rithmic.enabled=false).`)
    return { ok: false, skipped: true, provider: 'rithmic' }
  }
  if (!cfg.connectOnStartup) {
    logLiveDataInfo(`${PROVIDER} startup skipped (live_data.rithmic.connectOnStartup=false).`)
    return { ok: false, skipped: true, provider: 'rithmic' }
  }
  if (!cfg.username || !cfg.password) {
    logLiveDataWarn(
      `${PROVIDER} startup skipped — set live_data.rithmic.username and live_data.rithmic.password in config.json.`
    )
    return { ok: false, skipped: true, provider: 'rithmic' }
  }

  try {
    const openResult = await openRithmicChartLive(cfg)
    if (!openResult.ok) {
      return { ok: false, message: 'ChartLive open failed', provider: 'rithmic' }
    }

    if (cfg.subscribeOnStartup && cfg.ticker) {
      const { symbol, exchange, resolution } = cfg.ticker
      await subscribeRithmicChartLive(symbol, exchange, resolution, true)
    }

    await startPracticeBracketEngine()

    return { ok: true, provider: 'rithmic' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logLiveDataError(PROVIDER, `Connection error: ${message}`)
    return { ok: false, message, provider: 'rithmic' }
  }
}
