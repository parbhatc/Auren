import type { PropFirmCredentials } from '../../types/props'

export type BrokerAccountOption = { id: string; label: string }

export type MarketDataConnectionKind = 'broker-accounts' | 'credential-login' | 'server-managed'

export type MarketDataConnectionState = {
  connected: boolean
  statusLabel?: string
}

export type MarketDataConnectionContext = {
  firmId: string
  marketAccountId: string
  brokerAccounts: BrokerAccountOption[]
  brokerSessionExpired: boolean
  firmCredentials?: PropFirmCredentials | null
}
