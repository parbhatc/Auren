import type { BacktesterChartDataFeed } from '../../../backtester/components/chart/BacktesterChartDataFeed'
import type { BacktesterTradeHandler } from '../../../backtester/services/BacktesterTradeHandler'
import type { TradePanelProps } from '../../../types/tradePanel'
import { searchBacktesterTradeSymbols } from './backtesterSymbolSearch'
import { practiceMicroRoot } from '../../../services/practice/practiceContractFamily'

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
    onClose: () => tradeHandler?.logButtonPress('Close Position', { symbol: getChartSymbol() }),
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
    showAutoPositionPreview:
      tradeHandler && typeof tradeHandler.showAutoPositionPreview === 'function'
        ? (options) => tradeHandler.showAutoPositionPreview(options)
        : undefined,
    getMarketBook: () => datafeed.getMarketBookForSymbol(activeSymbolRoot()),
    subscribeMarketBook: (onUpdate) => datafeed.subscribeMarketBook(onUpdate),
    getChartPositionUpl: () => tradeHandler?.getPositionUplFor(getChartSymbol() || chartSymbol) ?? null,
    getDomPositionContext: () => tradeHandler?.getDomPositionFor(getChartSymbol() || chartSymbol) ?? null,
  }
}
