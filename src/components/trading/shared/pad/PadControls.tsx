import type { BracketDistanceUnit } from './types'
import { BRACKET_TICK_PRESETS } from './bracketUtils'

export function PadCheckbox({
  checked,
  onChange,
  tabIndex,
  accent = 'violet',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  tabIndex?: number
  accent?: 'violet' | 'red' | 'green'
}) {
  const on =
    accent === 'red'
      ? 'border-[#f85149] bg-[#f85149]'
      : accent === 'green'
        ? 'border-[#3fb950] bg-[#3fb950]'
        : 'border-[#8b5cf6] bg-[#8b5cf6]'

  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-[#7d8590] border border-transparent rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]/40"
      aria-pressed={checked}
    >
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center transition ${
          checked ? on : 'border-[#6e7681] bg-[#020617]'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 10 8" width="8" height="6" fill="none" aria-hidden>
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </button>
  )
}

export function BracketPriceTicksRow({
  priceDisabled,
  ticksDisabled,
  priceValue,
  ticksValue,
  onPriceChange,
  onTicksChange,
  onPriceFocus,
  onTicksFocus,
  onPriceBlur,
  distanceUnit,
  onDistanceUnitChange,
  priceTabIndex,
  ticksTabIndex,
  dimmed = false,
  dollarEnabled = false,
  equivalents,
}: {
  priceDisabled: boolean
  ticksDisabled: boolean
  priceValue: string
  ticksValue: string
  onPriceChange: (v: string) => void
  onTicksChange: (v: string) => void
  onPriceFocus?: () => void
  onTicksFocus?: () => void
  onPriceBlur?: () => void
  distanceUnit: BracketDistanceUnit
  onDistanceUnitChange: (unit: BracketDistanceUnit) => void
  priceTabIndex?: number
  ticksTabIndex?: number
  dimmed?: boolean
  /** Enable the $ distance unit (requires a known tickValue). */
  dollarEnabled?: boolean
  /** Live "10t = 2.5pt = $50/ct" line rendered under the row. */
  equivalents?: string | null
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-x-2 gap-y-1 rounded-xl border border-[#334155] bg-[#020617]/80 p-2 transition ${
        dimmed ? 'opacity-55' : ''
      }`}
    >
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[9px] font-medium uppercase tracking-wide text-[#64748b] px-0.5">Price</span>
        <input
          type="text"
          inputMode="decimal"
          disabled={priceDisabled}
          tabIndex={priceTabIndex}
          value={priceValue}
          onChange={(e) => onPriceChange(e.target.value)}
          onFocus={onPriceFocus}
          onBlur={onPriceBlur}
          className="no-spinner font-mono text-[#e6edf3] w-full text-sm rounded-lg border border-[#475569] bg-[#0f172a] px-2.5 py-2 outline-none focus:border-[#a78bfa] disabled:opacity-50"
        />
      </label>
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[9px] font-medium uppercase tracking-wide text-[#64748b] px-0.5">Distance</span>
        <div className="flex items-center gap-1 min-w-0">
          <input
            type="text"
            inputMode="numeric"
            disabled={ticksDisabled}
            tabIndex={ticksTabIndex}
            value={ticksValue}
            onChange={(e) => onTicksChange(e.target.value)}
            onFocus={onTicksFocus}
            className="no-spinner font-mono text-[#e6edf3] flex-1 min-w-0 text-sm rounded-lg border border-[#475569] bg-[#0f172a] px-2.5 py-2 outline-none focus:border-[#a78bfa] disabled:opacity-50"
          />
          <select
            value={distanceUnit}
            disabled={ticksDisabled}
            onChange={(e) => onDistanceUnitChange(e.target.value as BracketDistanceUnit)}
            aria-label="Distance unit"
            className="shrink-0 h-[38px] px-1.5 rounded-lg border border-[#475569] bg-[#1e293b] text-[10px] font-semibold text-[#94a3b8] hover:border-[#64748b] focus:border-[#a78bfa] outline-none disabled:opacity-50 cursor-pointer"
          >
            <option value="ticks">Ticks</option>
            <option value="points">Pts</option>
            {dollarEnabled && <option value="dollars">$</option>}
          </select>
        </div>
      </label>
      {equivalents && (
        <p className="col-span-2 font-mono text-[9px] text-[#64748b] tabular-nums px-0.5 truncate">
          {equivalents}
        </p>
      )}
    </div>
  )
}

export function TickPresetChips({
  disabled,
  variant,
  activeDistance,
  distanceUnit,
  tickSize,
  tickValue = 0,
  onSelect,
}: {
  disabled: boolean
  variant: 'sl' | 'tp'
  activeDistance: string
  distanceUnit: BracketDistanceUnit
  tickSize: number
  tickValue?: number
  onSelect: (amount: number) => void
}) {
  const color =
    variant === 'sl'
      ? 'text-[#f85149] hover:bg-[#f85149]/10'
      : 'text-[#3fb950] hover:bg-[#3fb950]/10'

  return (
    <div className="flex gap-1.5 flex-wrap">
      {BRACKET_TICK_PRESETS.map((n) => {
        const presetValue =
          distanceUnit === 'ticks'
            ? n
            : distanceUnit === 'dollars'
              ? Math.round(n * tickValue * 100) / 100
              : Math.round(n * tickSize * 100) / 100
        const label =
          distanceUnit === 'ticks'
            ? String(n)
            : presetValue % 1 === 0
              ? String(presetValue)
              : presetValue.toFixed(2)
        const isActive = activeDistance === label || activeDistance === String(presetValue)
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(presetValue)}
            className={`${color} font-mono text-[10px] font-medium flex h-7 min-w-[2.25rem] items-center justify-center rounded-lg border border-[#475569] bg-[#1e293b]/80 px-2 disabled:opacity-40 transition ${
              isActive ? 'ring-1 ring-[#8b5cf6] border-[#8b5cf6]/50 bg-[#8b5cf6]/10' : ''
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
