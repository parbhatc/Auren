import type { OrderSide, OrderType } from './order'
import type { TradeseaMarketBook, MarketBookUpdateKind } from '../services/tradesea/tradeseaMarketBook'
import type { DomPositionContext } from '../services/tradesea/tradeseaPnL'
import type { TradeseaSearchSymbolResult } from '../services/tradesea/tradeseaSymbolInfo'
import type { TradingMode } from './tradingMode'

export type TradePanelTab = 'quick' | 'dom' | 'ticket'

/** @deprecated use TradePanelTab */
export type PadTab = TradePanelTab

/** @deprecated use TradePanelTab */
export type PracticeTradePanelTab = TradePanelTab

export type TradePanelSettings = {
  /** How the chart position line shows running P&L: $0.00 vs 3 ticks vs points. */
  positionPnlDisplay?: 'dollars' | 'ticks' | 'points'
  hideBuySell: boolean
  hideJoinBidAsk: boolean
  hideClosePosition: boolean
  hideReverse: boolean
  hideCancelAll: boolean
  hideFlattenAll: boolean
  /** Hide bid/ask row under LTP in DOM tab. */
  hideDomBidAsk?: boolean
  /** Hide depth ladder (header + scroll rows) in DOM tab. */
  hideDomLadder?: boolean
  /** Hide LTP center-lock control in DOM tab. */
  hideDomLtpLock?: boolean
}

/** @deprecated use TradePanelSettings */
export type PracticeTradePanelSettings = TradePanelSettings

export type BracketOptions = {
  stopLoss: number | null
  takeProfit: number | null
}

/** @deprecated use BracketOptions */
export type PracticeBracketOptions = BracketOptions

export type OrderSubmitOptions = {
  orderType: OrderType
  entryPrice?: number
  stopLimitPrice?: number
}

/** @deprecated use OrderSubmitOptions */
export type PracticeOrderSubmitOptions = OrderSubmitOptions

export type TradePanelProps = {
  accountId: string
  mode?: TradingMode
  isDark: boolean
  chartSymbol?: string
  /** Chart product root (e.g. MNQ) — shown in trade contract picker. */
  chartProductRoot?: string
  /** Chart ticker when it differs from the pad trade symbol (e.g. chart NQ, pad MNQ). */
  chartSymbolHint?: string
  /** Active trade contract product root (e.g. MNQ). */
  tradeProductRoot?: string
  /** When true, chart symbol changes also update the trade contract. */
  autoChangeTradeContract?: boolean
  onAutoChangeTradeContract?: (enabled: boolean) => void
  /** Change chart symbol (updates chart + state). */
  onChartProductChange?: (symbol: string) => void
  /** Change trade contract only. */
  onChartSymbolChange?: (symbol: string) => void
  /** Same Tradesea instrument search used by the chart datafeed. */
  searchSymbols?: (query: string) => Promise<TradeseaSearchSymbolResult[]>
  quantity: string | number
  onQuantityChange: (delta: number) => void
  onQuantityUpdate: (n: number) => void
  onQuantityInputChange: (v: string) => void
  onQuantityBlur: () => void
  onBuy: () => void
  onSell: () => void
  onJoinBid?: () => void
  onJoinAsk?: () => void
  onSubmitOrder?: (side: OrderSide, brackets: BracketOptions, order?: OrderSubmitOptions) => void
  onClose: () => void
  onReverse: () => void
  onFlatten: () => void
  markPrice?: number | null
  tickSize?: number
  /** $ per tick per contract — enables the $ bracket unit and risk summary. */
  tickValue?: number
  getMarketBook?: () => TradeseaMarketBook | null
  subscribeMarketBook?: (
    onUpdate: (streamId: string, kind: MarketBookUpdateKind) => void
  ) => () => void
  ensureMarketBook?: () => void
  releaseMarketBook?: () => void
  getChartPositionUpl?: () => number | null
  getDomPositionContext?: () => DomPositionContext | null
  hideDetach?: boolean
  onDetach?: () => void
  fullWidth?: boolean
  /** When false, buy/sell and order controls are disabled (MDS offline). */
  marketDataLive?: boolean
  /** Hide the Ticket tab (e.g. backtester DOM-only pad). */
  hideTicketTab?: boolean
  /** Override trade panel UI toggles (e.g. hide join bid/ask on backtester). */
  panelUiOverrides?: Partial<TradePanelSettings>
}

/** @deprecated use TradePanelProps */
export type PracticeTradePanelProps = TradePanelProps
