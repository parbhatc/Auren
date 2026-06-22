import { credentialsMatchLiveDataRithmic } from '../../config/liveDataConfig.js'
import { getBootstrapRithmicCredentials } from '../rithmic/RithmicBootstrapState.js'
import { withRithmicUserLock } from '../rithmic/rithmicConnect.js'
import { beginRithmicLiveDataBootstrap, whenRithmicLiveDataReady } from './rithmicBootstrap.js'
import { RITHMIC_LIVE_DATA_LOCK_ID } from './liveDataConstants.js'

export { RITHMIC_LIVE_DATA_LOCK_ID }

export function usesLiveDataRithmicSession(credentials) {
  return credentialsMatchLiveDataRithmic(credentials)
}

/** Wait for startup login and return bootstrap credentials when live_data.rithmic is active. */
export async function ensureLiveDataRithmicReady() {
  beginRithmicLiveDataBootstrap()
  const result = await whenRithmicLiveDataReady()
  if (!result.ok) {
    throw new Error(result.message || 'Live data Rithmic is not available.')
  }
  return getBootstrapRithmicCredentials()
}

export function withLiveDataRithmicLock(credentials, userId, fn) {
  const lockId = usesLiveDataRithmicSession(credentials)
    ? RITHMIC_LIVE_DATA_LOCK_ID
    : userId
  return withRithmicUserLock(lockId, fn)
}
