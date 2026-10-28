import { getAuthToken } from '../../api/api'
import { tradeseaAPI } from '../../api/tradesea.api'
import {
  getPracticeMarketDataSettings, getPracticePropFirmConfig, refreshPracticeFromApi,
  PRACTICE_STORAGE_KEYS,
} from '../../constants/practice'
import { createUserMetadataCache } from '../cache/userMetadataCache'
import { subscribeAuthEvents } from '../auth/authEvents'

export type HeaderProviderStatus = { label: string; connected: boolean }
const practiceRefreshes = createUserMetadataCache({ getOwner: getAuthToken, ttlMs: 30_000, maxEntries: 1 })
const statuses = createUserMetadataCache({ getOwner: getAuthToken, ttlMs: 30_000, maxEntries: 4 })

/** Only a completed-refresh marker is retained here; financial data is not cached. */
export async function refreshHeaderPracticeCatalog(): Promise<void> {
  if (!getAuthToken()) return
  await practiceRefreshes.read('navigation-labels', async () => {
    await refreshPracticeFromApi({ strict: true })
    return true
  })
}

/** This cache supplies a navigation label, never a trading authorization check. */
export function loadHeaderProviderStatus(firmId: string): Promise<HeaderProviderStatus> {
  if (!getAuthToken()) return Promise.resolve({ label: 'Market data', connected: false })
  const config = getPracticePropFirmConfig(firmId)
  return statuses.read(config.id, async () => {
    if (config.id === 'tradesea') {
      const response = await tradeseaAPI.getConnectionStatus()
      return { label: response.connected ? 'Tradesea connected' : 'Tradesea disconnected', connected: Boolean(response.connected) }
    }
    return { label: `${config.displayName} connected`, connected: true }
  })
}

type Change = 'all' | 'status'
const listeners = new Set<(change: Change) => void>()
let stopEvents: (() => void) | null = null

function practiceSettingsKey() {
  const settings = getPracticeMarketDataSettings()
  return JSON.stringify([settings.propFirmId, settings.accountId, settings.accountLabel])
}

export function invalidateHeaderWorkspaceData(change: Change = 'all') {
  if (change === 'all') practiceRefreshes.invalidate()
  statuses.invalidate()
  for (const listener of listeners) listener(change)
}

/** One event owner avoids duplicate forced refreshes from retained/visible headers. */
export function subscribeHeaderWorkspaceData(listener: (change: Change) => void): () => void {
  listeners.add(listener)
  if (!stopEvents && typeof window !== 'undefined') {
    let settingsKey = practiceSettingsKey()
    const refresh = () => invalidateHeaderWorkspaceData()
    const provider = () => invalidateHeaderWorkspaceData('status')
    const practiceSettings = () => {
      const next = practiceSettingsKey()
      // WS balance/account patches also emit this event. Only a provider or
      // account-setting change needs a server read for the navigation labels.
      if (next !== settingsKey) { settingsKey = next; refresh() }
    }
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'token' || event.key === 'activePropFirm'
        || Object.values(PRACTICE_STORAGE_KEYS).includes(event.key as never)) refresh()
    }
    const stopAuth = subscribeAuthEvents((event) => {
      if (event.kind === 'token-change' || event.kind === 'unauthorized' && event.token === getAuthToken()) refresh()
    })
    window.addEventListener('refreshPropFirms', refresh)
    window.addEventListener('activePropFirmChanged', provider)
    window.addEventListener('practiceSettingsChanged', practiceSettings)
    window.addEventListener('storage', storage)
    stopEvents = () => {
      stopAuth()
      window.removeEventListener('refreshPropFirms', refresh)
      window.removeEventListener('activePropFirmChanged', provider)
      window.removeEventListener('practiceSettingsChanged', practiceSettings)
      window.removeEventListener('storage', storage)
    }
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) { stopEvents?.(); stopEvents = null }
  }
}
