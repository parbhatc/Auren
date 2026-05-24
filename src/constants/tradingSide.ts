import type { OrderSide } from '../types/order'

export type TradeSide = OrderSide

export type TradeButtonVariant =
  | 'compact'
  | 'market'
  | 'join'
  | 'panel'
  | 'select'
  | 'confirm'

/** TradingView order-line colors (bright green/red). */
export const TRADING_SIDE_CHART = {
  buy: {
    fill: '#00ff00',
    textOnFill: '#000000',
    textOnDarkFill: '#ffffff',
  },
  sell: {
    fill: '#ff0000',
    textOnFill: '#ffffff',
    textOnDarkFill: '#ffffff',
  },
  neutral: {
    fill: '#808080',
    textOnFill: '#000000',
  },
} as const

export const TRADING_SIDE = {
  buy: {
    label: 'Buy',
    textClass: 'text-trade-buy',
    borderClass: 'border-trade-buy',
    depthBgClass: 'bg-trade-buy-depth',
    depthTextClass: 'text-trade-buy',
  },
  sell: {
    label: 'Sell',
    textClass: 'text-trade-sell',
    borderClass: 'border-trade-sell',
    depthBgClass: 'bg-trade-sell-depth',
    depthTextClass: 'text-trade-sell',
  },
} as const

export function tradeSideMeta(side: TradeSide) {
  return TRADING_SIDE[side]
}

export function tradeSideBtnClass(
  side: TradeSide,
  variant: TradeButtonVariant,
  opts?: { active?: boolean; isDark?: boolean }
): string {
  const parts = ['trade-btn', `trade-btn--${side}`, `trade-btn--${variant}`]
  if (opts?.active) parts.push('is-active')
  if (opts?.isDark) parts.push('is-dark')
  return parts.join(' ')
}

export function pnlTextClass(pnl: number): string {
  if (Math.abs(Math.round(pnl)) < 1) return 'text-trade-muted'
  return pnl > 0 ? 'text-trade-buy' : 'text-trade-sell'
}

export function contractsToSide(contracts: number): TradeSide {
  return contracts >= 0 ? 'buy' : 'sell'
}

export function sideToChartAction(side: TradeSide): 'Buy' | 'Sell' {
  return side === 'buy' ? 'Buy' : 'Sell'
}

export function chartLineColors(profit: boolean) {
  const palette = profit ? TRADING_SIDE_CHART.buy : TRADING_SIDE_CHART.sell
  return {
    fill: palette.fill,
    text: profit ? palette.textOnFill : palette.textOnDarkFill,
  }
}

export function chartQtyColors(side: TradeSide) {
  const palette = TRADING_SIDE_CHART[side]
  return {
    fill: palette.fill,
    text: palette.textOnFill,
  }
}
