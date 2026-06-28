/** BWC position / order-line pill text colors — passed to bootChart({ orderLineTheme }). */
export const CHART_ORDER_LINE_THEME = {
  positionTextColor: '#000000',
  bracketTextColor: '#000000',
  defaultTextColor: '#000000',
  axisLabelTextColor: '#000000',
} as const

export type ChartOrderLineTheme = {
  positionTextColor?: string
  bracketTextColor?: string
  defaultTextColor?: string
  axisLabelTextColor?: string
}
