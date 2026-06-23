import type { TradePanelProps } from '../types/tradePanel'

/** True when market data is connected enough to allow order entry. */
export function isTradePanelTradingEnabled(
  props: Pick<TradePanelProps, 'marketDataLive'>
): boolean {
  return props.marketDataLive !== false
}

export const TRADE_OFFLINE_DISABLED_CLASS =
  'disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed'
