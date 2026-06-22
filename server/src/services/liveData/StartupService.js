import { getLiveDataType } from '../../config/liveDataConfig.js'
import { logLiveDataInfo } from './liveDataLog.js'
import { beginRithmicLiveDataBootstrap } from './rithmicBootstrap.js'

/**
 * Boot the configured live market-data provider on server start.
 * Dispatches on `live_data.type` (rithmic, tradesea, …).
 */
export async function bootstrapLiveDataOnStartup() {
  const type = getLiveDataType() || ''

  switch (type) {
    case 'rithmic':
      return beginRithmicLiveDataBootstrap()
    case 'tradesea':
      logLiveDataInfo('Tradesea startup is not configured yet.')
      return { ok: false, skipped: true, provider: 'tradesea' }
    default:
      logLiveDataInfo(`Startup skipped — live_data.type is "${type || '(unset)'}".`)
      return { ok: false, skipped: true, provider: type || null }
  }
}
