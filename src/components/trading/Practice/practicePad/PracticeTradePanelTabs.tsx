import type { PadTab } from './types'
import { DetachControl } from './PracticePadControls'
import { tp } from './tradePanelTheme'

export function PracticeTradePanelTabs({
  tab,
  onTab,
  onDetach,
  hideDetach,
}: {
  tab: PadTab
  onTab: (t: PadTab) => void
  onDetach?: () => void
  hideDetach?: boolean
}) {
  const tabs: { id: PadTab; label: string }[] = [
    { id: 'quick', label: 'Quick' },
    { id: 'dom', label: 'DOM' },
    { id: 'ticket', label: 'Ticket' },
  ]

  return (
    <div className={`shrink-0 ${tp.header}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={tp.headerTitle}>Trade</span>
        {!hideDetach && onDetach ? <DetachControl onClick={onDetach} /> : null}
      </div>
      <div className={tp.tabRail} role="tablist" aria-label="Trade panel mode">
        {tabs.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTab(id)}
              className={`${tp.tabBtn} ${active ? tp.tabActive : tp.tabIdle}`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

