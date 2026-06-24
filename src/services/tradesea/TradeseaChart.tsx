/**
 * Practice chart services (MDS + datafeed). Chart UI is AurenChart (BetterweightChart).
 */
import { TradeseaDatafeed } from './TradeseaDatafeed'
import { TradeseaMdsClient } from './TradeseaMdsClient'
import { TradeseaTradesClient } from './TradeseaTradesClient'
import { getTradeseaConnectionGroupId } from './tradeseaDeviceFingerprint'
import { tradeseaAPI, TradeseaStreamConfig } from '../../api/tradesea.api'
import {
  resolveMdsSubscribeTicker,
  shouldSubscribeMdsDepth,
  shouldUseDelayedMdsSymbols,
} from './tradeseaMdsSymbols'

export type TradeseaChartServices = {
  mds?: TradeseaMdsClient
  trades?: TradeseaTradesClient
  datafeed: TradeseaDatafeed
  streamConfig: TradeseaStreamConfig | { delayed: boolean }
  accountId: string
}

export async function prepareTradeseaChartServices(
  accountId: string,
  existing?: {
    mds?: TradeseaMdsClient
    trades?: TradeseaTradesClient
    accountId?: string
    datafeed?: TradeseaDatafeed
    bootstrapSymbol?: string
    bootstrapResolution?: string
  } | null,
  options?: { connectTrades?: boolean }
): Promise<TradeseaChartServices> {
  const connectTrades = options?.connectTrades !== false
  const streamConfig = await tradeseaAPI.getStreamConfig(accountId)
  if (!streamConfig.success || !streamConfig.userId) {
    throw new Error(streamConfig.error || 'Failed to load market data stream config')
  }

  const connectionGroupId = await getTradeseaConnectionGroupId(streamConfig.userId)

  const mds = existing?.mds ?? new TradeseaMdsClient()
  mds.configureMarketDepth(shouldSubscribeMdsDepth(streamConfig))
  const useDelayedMd = shouldUseDelayedMdsSymbols(streamConfig)

  const bootstrapSymbol = existing?.bootstrapSymbol
  if (bootstrapSymbol) {
    const ticker = resolveMdsSubscribeTicker(bootstrapSymbol, useDelayedMd)
    const bootstrap = {
      symbols: [ticker],
      resolution: existing?.bootstrapResolution || '1',
    }
    if (existing?.accountId !== accountId || !mds.isConnectedOrConnecting()) {
      mds.connect(accountId, connectionGroupId, bootstrap)
    } else {
      mds.setBootstrap(bootstrap)
    }
  } else if (existing?.accountId !== accountId || !mds.isConnectedOrConnecting()) {
    mds.connect(accountId, connectionGroupId, null)
  }

  const trades = existing?.trades ?? new TradeseaTradesClient()
  if (connectTrades && streamConfig.tradesReadOrigin) {
    trades.connect(accountId)
  } else {
    trades.disconnect()
  }

  const sameAccount = existing?.accountId === accountId
  const delayedMd = useDelayedMd
  const datafeedDelayed = existing?.datafeed?.isDelayedMarketData()
  const needsNewDatafeed = !sameAccount || !existing?.datafeed || datafeedDelayed !== delayedMd
  const datafeed = needsNewDatafeed
    ? new TradeseaDatafeed({
        mds,
        accountId,
        userId: streamConfig.userId,
        connectionGroupId,
        delayed: delayedMd,
      })
    : existing!.datafeed!

  return { mds, trades, datafeed, streamConfig, accountId }
}

export function teardownTradeseaChartServices(services: TradeseaChartServices | null): void {
  if (!services?.mds) return
  services.datafeed.setChartResetCallback(null)
  services.datafeed.setChartSymbolChangeRequest(null)
  services.mds.disconnect()
  services.trades?.disconnect()
}
