import type { BacktesterChartDataFeed } from '../../../backtester/components/chart/BacktesterChartDataFeed'
import type { BacktesterTradeHandler } from '../../../backtester/services/BacktesterTradeHandler'
import type { TradePanelProps } from '../../../types/tradePanel'
import { searchBacktesterTradeSymbols } from './backtesterSymbolSearch'

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
  const runSide = (side: 'Buy' | 'Sell') => {
    const qty = Number(contractQuantity) || 1
    const symbol = getChartSymbol()
    tradeHandler?.logButtonPress(side, { quantity: qty, symbol })
  }

  return {
    accountId: sessionId,
    mode: 'practice',
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
    onClose: () => tradeHandler?.logButtonPress('Close Position', { symbol: getChartSymbol() }),
    onReverse: () => tradeHandler?.logButtonPress('Reverse Position', { symbol: getChartSymbol() }),
    onFlatten: () => tradeHandler?.logButtonPress('Flatten All Position'),
    searchSymbols: searchBacktesterTradeSymbols,
    onChartSymbolChange,
    onDetach,
    hideTicketTab: true,
    panelUiOverrides: {
      hideJoinBidAsk: true,
      hideDomBidAsk: true,
      hideDomLadder: true,
      hideDomLtpLock: true,
    },
    tickSize: datafeed.getTickSize(activeSymbolRoot()),
    getMarketBook: () => datafeed.getMarketBookForSymbol(activeSymbolRoot()),
    subscribeMarketBook: (onUpdate) => datafeed.subscribeMarketBook(onUpdate),
    getChartPositionUpl: () => tradeHandler?.getPositionUplFor(getChartSymbol() || chartSymbol) ?? null,
    getDomPositionContext: () => tradeHandler?.getDomPositionFor(getChartSymbol() || chartSymbol) ?? null,
  }
}
