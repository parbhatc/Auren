import { PracticeTradeHandler } from '../../../../services/practice/PracticeTradeHandler'
import type { TradeseaDatafeed } from '../../../../services/tradesea/TradeseaDatafeed'
import { resolveTradePanelBidAsk } from '../../../../services/tradesea/tradeseaMarketBook'
import { chartSymbolToProductRoot } from '../../../../services/tradesea/tradeseaSymbolInfo'
import type { TradeseaSearchSymbolResult } from '../../../../services/tradesea/tradeseaSymbolInfo'
import { candleDebug } from '../../../../services/tradesea/candleDebug'
import { aurenToast } from '../../../../utils/aurenToast'
import { saveTradePadSymbol, getTradePadAutoChange, saveTradePadAutoChange } from '../../../../utils/tradePadSymbol'
import {
  isPracticePadDetached,
  togglePracticePadDetached,
} from '../../../../utils/practiceTradePanelPopout'
import type { TradePanelProps } from '../../../../types/tradePanel'
import type { TradeActionExtra } from './tradeActions'

export type BuildTradePadPropsContext = {
  padSessionId: string
  liveMode?: boolean
  isDark: boolean
  marketDataLive: boolean
  chartSymbolLabel: string
  chartSymbolHint?: string
  chartProductRoot: string
  padRoot: string
  contractQuantity: number | string
  activeFirm: any
  tsDatafeed?: TradeseaDatafeed
  tradeHandler: any
  tradingBlocked: boolean
  searchPadSymbols?: (query: string) => Promise<TradeseaSearchSymbolResult[]>
  onQuantityChange: (delta: number) => void
  onQuantityUpdate: (quantity: number) => void
  onQuantityInputChange: (value: string) => void
  onQuantityBlur: () => void
  onTradePadSymbolChange: (root: string) => void
  onForceUpdate: () => void
  runTrade: (action: string, extra?: TradeActionExtra) => void
}

export function buildTradePadProps(ctx: BuildTradePadPropsContext): TradePanelProps {
  const {
    padSessionId,
    liveMode,
    isDark,
    marketDataLive,
    chartSymbolLabel,
    chartSymbolHint,
    chartProductRoot,
    padRoot,
    contractQuantity,
    activeFirm,
    tsDatafeed,
    tradeHandler,
    tradingBlocked,
    searchPadSymbols,
    onQuantityChange,
    onQuantityUpdate,
    onQuantityInputChange,
    onQuantityBlur,
    onTradePadSymbolChange,
    onForceUpdate,
    runTrade,
  } = ctx

  const resolvePracticeBook = () => {
    if (tradeHandler && 'getActiveMarketBook' in tradeHandler) {
      return (
        tradeHandler as {
          getActiveMarketBook: (
            symbol?: string
          ) => ReturnType<TradeseaDatafeed['getMarketBookForChart']>
        }
      ).getActiveMarketBook(chartSymbolLabel)
    }
    return tsDatafeed?.getMarketBookForChart?.(chartSymbolLabel) ?? null
  }

  const runJoinLimit = (side: 'buy' | 'sell') => {
    if (tradingBlocked) {
      aurenToast.warning('Market data offline', 'Reconnect the stream before trading')
      return
    }
    const book = resolvePracticeBook()
    const { bid, ask } = resolveTradePanelBidAsk(book)
    const price = side === 'buy' ? bid : ask
    if (price == null || !Number.isFinite(price)) {
      aurenToast.warning(
        side === 'buy' ? 'Waiting for bid' : 'Waiting for ask',
        'Market book not ready yet'
      )
      return
    }
    if (tradeHandler instanceof PracticeTradeHandler) {
      void tradeHandler.placeLimitOrder(
        side,
        Number(contractQuantity) || 1,
        price,
        undefined,
        padRoot
      )
      return
    }
    runTrade(side === 'buy' ? 'Buy' : 'Sell', { entryPrice: price })
  }

  return {
    accountId: padSessionId,
    mode: (liveMode ? 'live' : 'practice') as 'live' | 'practice',
    isDark,
    marketDataLive,
    chartSymbol: chartSymbolLabel,
    chartProductRoot,
    tradeProductRoot: padRoot,
    chartSymbolHint,
    autoChangeTradeContract: getTradePadAutoChange(padSessionId),
    onAutoChangeTradeContract: (enabled: boolean) => {
      saveTradePadAutoChange(padSessionId, enabled)
      if (enabled && chartProductRoot) {
        saveTradePadSymbol(padSessionId, chartProductRoot)
        onTradePadSymbolChange(chartProductRoot)
      }
    },
    searchSymbols: tsDatafeed ? searchPadSymbols : undefined,
    onChartProductChange: (sym: string) => {
      const root = chartSymbolToProductRoot(sym)
      if (!root) return
      const firm = activeFirm as { requestChartSymbolChange?: (r: string) => void } | undefined
      if (typeof firm?.requestChartSymbolChange === 'function') {
        firm.requestChartSymbolChange(root)
        return
      }
      void tsDatafeed?.ensureMarketBookSubscription?.(
        tsDatafeed.resolveStreamInstrument?.(`CME:${root}`) ?? `CME:${root}`
      )
    },
    onChartSymbolChange: (sym: string) => {
      const root = chartSymbolToProductRoot(sym)
      if (!root) return
      candleDebug.tradePadChartPick(root)
      const label =
        activeFirm?.chartServices?.datafeed?.resolveStreamInstrument?.(`CME:${root}`) ??
        `CME:${root}`
      void activeFirm?.chartServices?.datafeed?.ensureMarketBookSubscription?.(label)
      if (padSessionId) saveTradePadSymbol(padSessionId, root)
      onTradePadSymbolChange(root)
    },
    quantity: contractQuantity,
    onQuantityChange,
    onQuantityUpdate,
    onQuantityInputChange,
    onQuantityBlur,
    markPrice: (() => {
      if (!tradeHandler || !('getActiveMarkPrice' in tradeHandler)) return null
      try {
        return (
          tradeHandler as { getActiveMarkPrice: (symbol?: string) => number | null }
        ).getActiveMarkPrice(chartSymbolLabel)
      } catch {
        return null
      }
    })(),
    getMarketBook: () => {
      if (tradeHandler && 'getActiveMarketBook' in tradeHandler) {
        const fromHandler = (
          tradeHandler as {
            getActiveMarketBook: (
              symbol?: string
            ) => ReturnType<TradeseaDatafeed['getMarketBookForChart']>
          }
        ).getActiveMarketBook(chartSymbolLabel)
        if (fromHandler) return fromHandler
      }
      return tsDatafeed?.getMarketBookForChart?.(chartSymbolLabel) ?? null
    },
    subscribeMarketBook: tsDatafeed?.subscribeMarketBook
      ? (onUpdate) => tsDatafeed.subscribeMarketBook!(onUpdate)
      : undefined,
    ensureMarketBook: tsDatafeed?.ensureMarketBookSubscription
      ? () => tsDatafeed.ensureMarketBookSubscription!(chartSymbolLabel)
      : undefined,
    releaseMarketBook: tsDatafeed?.releaseMarketBookSubscription
      ? () => tsDatafeed.releaseMarketBookSubscription!(chartSymbolLabel)
      : undefined,
    getChartPositionUpl:
      tradeHandler instanceof PracticeTradeHandler
        ? () => tradeHandler.getPositionUplFor(chartSymbolLabel)
        : undefined,
    getDomPositionContext:
      tradeHandler instanceof PracticeTradeHandler
        ? () => tradeHandler.getDomPositionFor(chartSymbolLabel)
        : undefined,
    tickSize: activeFirm?.chartServices?.datafeed?.getTickSize?.(padRoot) ?? 0.25,
    tickValue: activeFirm?.chartServices?.datafeed?.getTickValue?.(padRoot) ?? 0,
    onDetach: () => {
      togglePracticePadDetached(padSessionId)
      onForceUpdate()
    },
    onBuy: () => runTrade('Buy'),
    onSell: () => runTrade('Sell'),
    onJoinBid: () => runJoinLimit('buy'),
    onJoinAsk: () => runJoinLimit('sell'),
    onSubmitOrder: (side, brackets, order) => {
      const qty = Number(contractQuantity) || 1
      if (
        tradeHandler instanceof PracticeTradeHandler &&
        order?.orderType !== 'market' &&
        order.entryPrice != null
      ) {
        void tradeHandler.placeLimitOrder(
          side === 'buy' ? 'buy' : 'sell',
          qty,
          order.entryPrice,
          {
            stopLoss: brackets.stopLoss,
            takeProfit: brackets.takeProfit,
          },
          padRoot
        )
        return
      }
      runTrade(side === 'buy' ? 'Buy' : 'Sell', {
        stopLoss: brackets.stopLoss,
        takeProfit: brackets.takeProfit,
        orderType: order?.orderType,
        entryPrice: order?.orderType === 'market' ? undefined : order?.entryPrice,
      })
    },
    onClose: () => runTrade('Close Position'),
    onReverse: () => runTrade('Reverse Position'),
    onFlatten: () => runTrade('Flatten All Position'),
  }
}

export { isPracticePadDetached }
