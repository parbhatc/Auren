import Database from '../../config/Database.js'
import PropsController from '../../controllers/PropsController.js'
import { getRithmicLiveDataConfig } from '../../config/liveDataConfig.js'
import { testRithmicLogin } from '../rithmic/RithmicLoginService.js'
import { upsertRithmicCredentials } from '../rithmic/RithmicCredentialsStore.js'
import { setBootstrapRithmicCredentials } from '../rithmic/RithmicBootstrapState.js'
import { startRithmicLiveTicker } from './rithmicLiveTickerHub.js'
import {
  logLiveDataConnected,
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

async function seedBootstrapCredentialsToAdmins(credentials) {
  await PropsController.initializeTable()
  const admins = await Database.findUsersByRole('admin')
  if (!admins.length) return
  for (const admin of admins) {
    await upsertRithmicCredentials(admin.id, credentials)
  }
}

/** Connect Rithmic on server start using `live_data.rithmic` from config.json. */
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
    const login = await testRithmicLogin({
      username: cfg.username,
      password: cfg.password,
      systemName: cfg.systemName,
      gatewayName: cfg.gatewayName,
    })

    if (!login.passed) {
      logLiveDataError(PROVIDER, `Connection failed: ${login.message}`)
      setBootstrapRithmicCredentials(null)
      return { ok: false, message: login.message, provider: 'rithmic' }
    }

    const credentials = {
      username: cfg.username,
      password: cfg.password,
      systemName: login.system_name || cfg.systemName,
      gatewayName: login.gateway_name || cfg.gatewayName,
      gatewayUri: login.gateway_uri || null,
      loginPassed: true,
      fcmId: login.fcm_id || undefined,
      ibId: login.ib_id || undefined,
      uniqueUserId: login.unique_user_id || undefined,
    }

    setBootstrapRithmicCredentials(credentials)
    logLiveDataConnected(PROVIDER)

    if (cfg.seedAdminCredentials) {
      await seedBootstrapCredentialsToAdmins(credentials)
    }

    if (cfg.subscribeOnStartup && cfg.ticker) {
      const tickerResult = await startRithmicLiveTicker(credentials, cfg.ticker)
      if (!tickerResult.ok) {
        logLiveDataError(PROVIDER, `Ticker subscribe failed: ${tickerResult.message || 'unknown'}`)
        return { ok: false, message: tickerResult.message, provider: 'rithmic' }
      }
    }

    return { ok: true, provider: 'rithmic' }
  } catch (error) {
    setBootstrapRithmicCredentials(null)
    const message = error instanceof Error ? error.message : String(error)
    logLiveDataError(PROVIDER, `Connection error: ${message}`)
    return { ok: false, message, provider: 'rithmic' }
  }
}
