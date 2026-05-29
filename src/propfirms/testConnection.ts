import type { PropsSettingsResponse } from '../types/props'
import { getMarketDataConnectionKind } from './MarketDataConnection'
import { testBrokerAccountsMarketConnection } from './tradesea/marketData'

export async function testPropFirmMarketConnection(
  type: string,
  _credentials: { username: string; password: string }
): Promise<PropsSettingsResponse> {
  const kind = getMarketDataConnectionKind(type)

  if (kind === 'broker-accounts') {
    return testBrokerAccountsMarketConnection()
  }

  return {
    success: false,
    message: 'Test connection is only supported for the market data provider',
  }
}
