import type { PracticeTradePanelProps } from './PracticeTradePanel'
import { PracticeQuickTradeCard } from './PracticeQuickTradeCard'

/** Mobile quick-trade strip below the chart (practice mode). */
export function PracticeMobileScalpBar({
  props,
  maxQty,
  isDark,
}: {
  props: PracticeTradePanelProps
  maxQty: number
  isDark: boolean
}) {
  return (
    <div className="lg:hidden shrink-0 w-full px-1 pb-1">
      <PracticeQuickTradeCard props={props} maxQty={maxQty} isDark={isDark} />
    </div>
  )
}
