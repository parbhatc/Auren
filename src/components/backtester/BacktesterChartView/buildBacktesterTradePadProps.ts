import type { BacktesterChartDataFeed } from '../../../backtester/components/chart/BacktesterChartDataFeed'
import type { BacktesterTradeHandler } from '../../../backtester/services/BacktesterTradeHandler'
import type { TradePanelProps } from '../../../types/tradePanel'
import { searchBacktesterTradeSymbols } from './backtesterSymbolSearch'
import { practiceMicroRoot } from '../../../services/practice/practiceContractFamily'
import { resolvePracticeInstrumentTicks } from '../../../services/practice/practiceInstrumentTicks'

function resolveBacktesterSymbolRoot(symbol: string): string {
  const s = String(symbol || '').trim().toUpperCase()
  return s.includes(':') ? s.split(':')[1]! : s
}

export function buildBacktesterTradePadProps({
  sessionId,
  isDark,
  marketDataLive,
  contractQuantity,
  chartSymbol,
  tradeHandler,
  datafeed,
  getChartSymbol,
  onQuantityChange,
  onQuantityUpdate,
  onQuantityInputChange,
  onQuantityBlur,
  onChartSymbolChange,
  onDetach,
}: {
  sessionId: string
  isDark: boolean
  marketDataLive: boolean
  contractQuantity: number | string
  chartSymbol: string
  tradeHandler: BacktesterTradeHandler | null
  datafeed: BacktesterChartDataFeed
  getChartSymbol: () => string
  onQuantityChange: (delta: number) => void
  onQuantityUpdate: (n: number) => void
  onQuantityInputChange: (v: string) => void
  onQuantityBlur: () => void
  onChartSymbolChange?: (symbol: string) => void
  onDetach?: () => void
}): TradePanelProps {
  const activeSymbolRoot = () => resolveBacktesterSymbolRoot(getChartSymbol() || chartSymbol)
  const riskExecutionRoot = practiceMicroRoot(activeSymbolRoot()) || activeSymbolRoot()
  const runSide = (side: 'Buy' | 'Sell') => {
    const qty = Number(contractQuantity) || 1
    const symbol = getChartSymbol()
    tradeHandler?.logButtonPress(side, { quantity: qty, symbol })
  }

  return {
    accountId: sessionId,
    mode: 'backtest',
    isDark,
    marketDataLive,
    chartSymbol,
    chartProductRoot: chartSymbol,
    tradeProductRoot: chartSymbol,
    quantity: contractQuantity,
    onQuantityChange,
    onQuantityUpdate,
    onQuantityInputChange,
    onQuantityBlur,
    onBuy: () => runSide('Buy'),
    onSell: () => runSide('Sell'),
    onSubmitOrder: (side, brackets, order) => {
      const qty = Number(contractQuantity) || 1
      tradeHandler?.submitBracketOrder(
        side,
        qty,
        getChartSymbol(),
        brackets,
        order?.executionSymbol || getChartSymbol()
      )
    },
    onClose: (quantity, symbol) => tradeHandler?.logButtonPress('Close Position', {
      quantity:
        Number.isFinite(Number(quantity)) && Number(quantity) > 0
          ? Number(quantity)
          : Number(contractQuantity) || 1,
      symbol: symbol || getChartSymbol(),
    }),
    onReverse: () => tradeHandler?.logButtonPress('Reverse Position', { symbol: getChartSymbol() }),
    onFlatten: () => tradeHandler?.logButtonPress('Flatten All Position'),
    searchSymbols: searchBacktesterTradeSymbols,
    onChartSymbolChange,
    onDetach,
    panelUiOverrides: {
      hideJoinBidAsk: true,
      hideDomBidAsk: false,
      hideDomLadder: false,
      hideDomLtpLock: false,
    },
    tickSize: datafeed.getTickSize(activeSymbolRoot()),
    tickValue: datafeed.getTickValue(activeSymbolRoot()),
    autoRiskContractRouting: true,
    riskExecutionProductRoot: riskExecutionRoot,
    getMaxQuantityForSymbol: () => 100,
    pickChartPriceOnce:
      tradeHandler && typeof tradeHandler.pickChartPriceOnce === 'function'
        ? (onPrice) => tradeHandler.pickChartPriceOnce(onPrice)
        : undefined,
    getActiveChartResolution:
      tradeHandler && typeof tradeHandler.getActiveChartResolution === 'function'
        ? () => tradeHandler.getActiveChartResolution()
        : undefined,
    getAutoOrderSizingContext: (context) => {
      const chartRoot = resolveBacktesterSymbolRoot(context.symbol || activeSymbolRoot())
      const executionSymbol = practiceMicroRoot(chartRoot) || chartRoot
      const entry = tradeHandler?.getMarkPrice(context.symbol || chartRoot)
        ?? datafeed.getLastBarForSymbol(chartRoot)?.close
        ?? null
      if (entry == null || !Number.isFinite(entry)) return null
      const ticks = resolvePracticeInstrumentTicks(executionSymbol)
      return {
        entry,
        executionSymbol,
        tickSize: ticks.tickSize,
        tickValue: ticks.tickValue,
        maxQuantity: 100,
      }
    },
    showAutoPositionPreview:
      tradeHandler && typeof tradeHandler.showAutoPositionPreview === 'function'
        ? (options) => tradeHandler.showAutoPositionPreview(options)
        : undefined,
    getMarketBook: () => datafeed.getMarketBookForSymbol(activeSymbolRoot()),
    subscribeMarketBook: (onUpdate) => datafeed.subscribeMarketBook(onUpdate),
    getChartPositionUpl: () => tradeHandler?.getPositionUplFor(getChartSymbol() || chartSymbol) ?? null,
    getDomPositionContext: () => tradeHandler?.getDomPositionFor(getChartSymbol() || chartSymbol) ?? null,
    getPositionFamilySummary: () =>
      tradeHandler?.getPositionFamilySummaryFor(getChartSymbol() || chartSymbol) ?? null,
  }
}
