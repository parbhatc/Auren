import { useEffect, useState } from 'react'
import {
  getPositionPnlDisplay,
  getShowMicroPositionsOnMiniCharts,
  setPositionPnlDisplay,
  setShowMicroPositionsOnMiniCharts,
} from '../../../../constants/tradePanelSettings'
import { TRADE_PANEL_SETTINGS_CHANGED_EVENT } from '../../../../constants/tradePanel'
import Switch from '../../Practice/Switch'

type PnlDisplayMode = 'dollars' | 'ticks' | 'points'

const OPTIONS: Array<{ value: PnlDisplayMode; label: string }> = [
  { value: 'dollars', label: '$' },
  { value: 'ticks', label: 'Ticks' },
  { value: 'points', label: 'Points' },
]

/**
 * How the chart position line shows running P&L — $0.00, 3 ticks, or points.
 * Applies to live, practice, and backtester charts.
 */
export default function PositionPnlDisplaySetting({ isDark }: { isDark: boolean }) {
  const [mode, setMode] = useState<PnlDisplayMode>(() => getPositionPnlDisplay())
  const [showMicroPositions, setShowMicroPositions] = useState(
    getShowMicroPositionsOnMiniCharts
  )

  useEffect(() => {
    const onChange = () => {
      setMode(getPositionPnlDisplay())
      setShowMicroPositions(getShowMicroPositionsOnMiniCharts())
    }
    window.addEventListener(TRADE_PANEL_SETTINGS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(TRADE_PANEL_SETTINGS_CHANGED_EVENT, onChange)
  }, [])

  const apply = (next: PnlDisplayMode) => {
    setMode(next)
    setPositionPnlDisplay(next)
  }

  return (
    <div className="px-3 py-2.5">
      <p className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
        Position P&L display
      </p>
      <div
        className={`flex rounded-lg border p-0.5 ${
          isDark ? 'border-slate-700 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
        }`}
        role="radiogroup"
        aria-label="Position P&L display"
      >
        {OPTIONS.map(({ value, label }) => {
          const active = mode === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => apply(value)}
              className={`flex-1 h-7 rounded-md text-xs font-semibold transition ${
                active
                  ? 'bg-violet-600 text-white'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <p className={`text-[11px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        How the position line on the chart shows P&L — e.g. +$50.00, +10 ticks, or +2.5 pts.
      </p>

      <div className={`mt-3 border-t pt-3 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <Switch
          checked={showMicroPositions}
          onChange={(enabled) => {
            setShowMicroPositions(enabled)
            setShowMicroPositionsOnMiniCharts(enabled)
          }}
          isDark={isDark}
          label="Show micro positions on mini charts"
        />
        <p className={`mt-1.5 text-[10px] leading-4 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          Shows MNQ on NQ, MES on ES, MYM on YM, M2K on RTY, MGC on GC, and MCL on CL.
        </p>
      </div>
    </div>
  )
}
