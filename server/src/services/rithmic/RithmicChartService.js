import { barsToHistoryPayload } from 'rithmic-api'
import { getRithmicCredentials } from './RithmicCredentialsStore.js'
import { findRithmicSymbol } from './RithmicSymbolsService.js'
import { resolveChartConnect, withRithmicUserLock } from './rithmicConnect.js'
import { replayHistoryBars } from './RithmicHistoryReplay.js'
import { logRithmicHistory } from './rithmicChartDebug.js'

/**
 * @param {string} userId
 * @param {{ symbol: string, exchange: string, resolution?: string|number, from?: number, to?: number, countback?: number }} query
 */
export async function fetchRithmicChartHistory(userId, query) {
  return withRithmicUserLock(userId, async () => {
    const credentials = await getRithmicCredentials(userId)
    if (!credentials) {
      throw new Error('Rithmic market data is not connected.')
    }
    const connect = await resolveChartConnect(credentials)
    const symbol = String(query.symbol || 'NQ').trim().toUpperCase()
    const catalog = findRithmicSymbol(symbol) || findRithmicSymbol(`${query.exchange || 'CME'}:${symbol}`)
    const exchange = String(query.exchange || catalog?.exchange || 'CME')
      .trim()
      .toUpperCase()
    const chartSymbol = catalog?.symbol || symbol

    const bars = await replayHistoryBars({
      connect,
      symbol: chartSymbol,
      exchange,
      resolution: query.resolution ?? 1,
      from: query.from,
      to: query.to,
      countback: query.countback,
    })

    logRithmicHistory(`${exchange}:${chartSymbol}`, bars)

    return barsToHistoryPayload(bars, { timeOffset: 0, compat: true })
  })
}
