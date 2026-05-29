import {
  getPracticePropFirmConfig,
  normalizePracticePropFirmId,
  PRACTICE_PROP_FIRM_CONFIGS,
  type PracticePropFirmMarketDataConfig,
} from '../constants/practicePropFirms'
import {
  isBrokerSessionExpiredForFirm,
  resolveBrokerAccountsMarketConnection,
} from './tradesea/marketData'
import type {
  MarketDataConnectionContext,
  MarketDataConnectionKind,
  MarketDataConnectionState,
} from './marketData/types'

export type {
  MarketDataConnectionContext,
  MarketDataConnectionKind,
  MarketDataConnectionState,
} from './marketData/types'

export function getDefaultPropFirmId(): string {
  return PRACTICE_PROP_FIRM_CONFIGS[0].id
}

export function getMarketDataConnectionKind(firmId?: string | null): MarketDataConnectionKind | null {
  const config = getPracticePropFirmConfig(firmId)
  return config.marketDataConnection ?? null
}

export function firmUsesBrokerAccounts(firmId?: string | null): boolean {
  return getMarketDataConnectionKind(firmId) === 'broker-accounts'
}

export function firmUsesCredentialLogin(_firmId?: string | null): boolean {
  return false
}

export function firmPersistsMarketAccountId(firmId?: string | null): boolean {
  return firmUsesBrokerAccounts(firmId)
}

export function listCredentialLoginFirmIds(): string[] {
  return []
}

export function listBrokerAccountFirmIds(): string[] {
  return PRACTICE_PROP_FIRM_CONFIGS.filter((c) => c.marketDataConnection === 'broker-accounts').map(
    (c) => c.id
  )
}

export function resolveMarketDataConnection(ctx: MarketDataConnectionContext): MarketDataConnectionState {
  const firmId = normalizePracticePropFirmId(ctx.firmId)
  const kind = getMarketDataConnectionKind(firmId)

  if (kind === 'broker-accounts') {
    return resolveBrokerAccountsMarketConnection({ ...ctx, firmId })
  }
  return { connected: false }
}

export function shouldClearMarketAccountOnFirmSwitch(
  firmId: string,
  accountId?: string,
  accountLabel?: string
): boolean {
  return !firmPersistsMarketAccountId(firmId) && Boolean(accountId || accountLabel)
}

export function isSessionExpiredBannerActive(
  firmId: string,
  brokerSessionExpired: boolean
): boolean {
  return isBrokerSessionExpiredForFirm(
    getMarketDataConnectionKind(firmId) ?? '',
    brokerSessionExpired
  )
}

export function isDisconnectedBannerActive(
  firmId: string,
  connection: MarketDataConnectionState,
  brokerSessionExpired = false
): boolean {
  if (!connection.connected) {
    if (firmUsesBrokerAccounts(firmId) && !brokerSessionExpired) return true
  }
  return false
}

/** Load saved credentials for credential-login firms (none configured). */
export async function loadCredentialLoginCredentials(): Promise<
  Record<string, import('../types/props').PropFirmCredentials | null>
> {
  return {}
}

export function getCredentialsForFirm(
  firmId: string,
  credentialsByFirm: Record<string, import('../types/props').PropFirmCredentials | null>
) {
  return credentialsByFirm[normalizePracticePropFirmId(firmId)] ?? null
}

export type { PracticePropFirmMarketDataConfig }
