import type { PropsSettingsResponse } from '../../types/props'
import type { MarketDataConnectionContext, MarketDataConnectionState } from '../marketData/types'

export async function testBrokerAccountsMarketConnection(): Promise<PropsSettingsResponse> {
  try {
    const { tradeseaAPI } = await import('../../api/tradesea.api')
    const status = await tradeseaAPI.getConnectionStatus()
    if (status.connected) {
      const { t } = await import('../../utils/translator')
      return {
        success: true,
        message: t('props.connectionSuccessful'),
      }
    }
    return {
      success: false,
      message: 'Market data is not connected. Use email OTP or paste tokens in Market data settings.',
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
    }
  }
}

export function resolveBrokerAccountsMarketConnection(
  ctx: MarketDataConnectionContext
): MarketDataConnectionState {
  const connected =
    Boolean(ctx.marketAccountId?.trim()) &&
    !ctx.brokerSessionExpired &&
    ctx.brokerAccounts.length > 0

  const fromList = ctx.brokerAccounts.find((a) => a.id === ctx.marketAccountId)?.label

  return {
    connected,
    statusLabel: connected ? fromList || undefined : undefined,
  }
}

export function isBrokerSessionExpiredForFirm(
  connectionKind: string,
  brokerSessionExpired: boolean
): boolean {
  return connectionKind === 'broker-accounts' && brokerSessionExpired
}
