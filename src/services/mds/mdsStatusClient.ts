import type { MdsConnectionState } from '../tradesea/TradeseaMdsClient'

/** Shared MDS status / reconnect controls (Tradesea). */
export type MdsStatusClient = {
  getConnectionState(): MdsConnectionState
  isAutoReconnectEnabled(): boolean
  setAutoReconnectEnabled(enabled: boolean): void
  reconnect(): void
  on(event: 'connection', handler: (state: MdsConnectionState) => void): () => void
  on(event: 'open', handler: () => void): () => void
  on(event: 'close', handler: () => void): () => void
  on(event: 'autoReconnect', handler: (enabled: boolean) => void): () => void
  on(event: 'connectionsLimitBlocked', handler: () => void): () => void
}

export function asMdsStatusClient(mds: MdsStatusClient): MdsStatusClient {
  return mds
}
