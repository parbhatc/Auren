import type { PropsSettingsResponse } from '../types/props'
import { getMarketDataConnectionKind } from './MarketDataConnection'
import { testCredentialLoginMarketConnection } from './rithmic/marketData'
import { testBrokerAccountsMarketConnection } from './tradesea/marketData'

export async function testPropFirmMarketConnection(
  type: string,
  credentials: { username: string; password: string }
): Promise<PropsSettingsResponse> {
  const kind = getMarketDataConnectionKind(type)

  if (kind === 'broker-accounts') {
    return testBrokerAccountsMarketConnection()
  }
  if (kind === 'credential-login') {
    return testCredentialLoginMarketConnection(type, credentials)
  }

  return {
    success: false,
    message: 'Test connection is only supported for the market data provider',
  }
}
