/**
 * Trading Layout Types
 */
export type LayoutType = 'chart-left' | 'chart-right' | 'chart-top' | 'chart-bottom' | 'chart-full'

export interface TradingLayout {
  type: LayoutType
  chartSize: number
  panelSize: number
  chartHeight?: number
}

export type StorageLayoutType = 'trading' | 'backtester'

export const DEFAULT_LAYOUT: TradingLayout = {
  type: 'chart-left',
  chartSize: 66,
  panelSize: 34,
}
