/** Practice sim, live prop-firm execution, or historical backtest. */
export type TradingMode = 'practice' | 'live' | 'backtest'

/** URL segment id for a registered prop firm (e.g. tradesea). */
export type PropFirmId = string

export interface TradeRouteContext {
  mode: TradingMode
  /** Prop firm when mode is live; practice market-data firm when mode is practice. */
  firmId?: PropFirmId
  accountId: string
}

export const SESSION_ROUTE_BASE: Record<TradingMode, string> = {
  practice: '/practice/trade',
  live: '/trade',
  backtest: '/backtest',
}
