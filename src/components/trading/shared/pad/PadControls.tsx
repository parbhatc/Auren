import type { BracketDistanceUnit } from './types'
import { BRACKET_TICK_PRESETS } from './bracketUtils'

export function PadCheckbox({
  checked,
  onChange,
  tabIndex,
  accent = 'blue',
  isDark = true,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  tabIndex?: number
  accent?: 'blue' | 'red' | 'green'
  isDark?: boolean
}) {
  const on =
    accent === 'red'
      ? 'border-[#f85149] bg-[#f85149]'
      : accent === 'green'
        ? 'border-[#3fb950] bg-[#3fb950]'
        : 'border-[#3b82f6] bg-[#3b82f6]'

  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-[#A1A1AA] border border-transparent rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
      aria-pressed={checked}
    >
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center transition ${
          checked ? on : isDark ? 'border-[#52525B] bg-[#18181B]' : 'border-[#A1A1AA] bg-white'
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
  isDark = true,
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
  isDark?: boolean
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-x-2 gap-y-1 rounded-xl border p-2 transition ${
        isDark ? 'border-[#3F3F46] bg-[#121215]' : 'border-[#E4E4E7] bg-white'
      } ${
        dimmed ? 'opacity-55' : ''
      }`}
    >
      <label className="flex flex-col gap-1 min-w-0">
        <span className="px-0.5 text-[9px] font-medium uppercase tracking-wide text-[#71717A]">Price</span>
        <input
          type="text"
          inputMode="decimal"
          disabled={priceDisabled}
          tabIndex={priceTabIndex}
          value={priceValue}
          onChange={(e) => onPriceChange(e.target.value)}
          onFocus={onPriceFocus}
          onBlur={onPriceBlur}
          className={`no-spinner w-full rounded-lg border px-2.5 py-2 font-mono text-sm outline-none focus:border-blue-500 disabled:opacity-50 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}
        />
      </label>
      <label className="flex flex-col gap-1 min-w-0">
        <span className="px-0.5 text-[9px] font-medium uppercase tracking-wide text-[#71717A]">Distance</span>
        <div className="flex items-center gap-1 min-w-0">
          <input
            type="text"
            inputMode="numeric"
            disabled={ticksDisabled}
            tabIndex={ticksTabIndex}
            value={ticksValue}
            onChange={(e) => onTicksChange(e.target.value)}
            onFocus={onTicksFocus}
            className={`no-spinner min-w-0 flex-1 rounded-lg border px-2.5 py-2 font-mono text-sm outline-none focus:border-blue-500 disabled:opacity-50 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}
          />
          <select
            value={distanceUnit}
            disabled={ticksDisabled}
            onChange={(e) => onDistanceUnitChange(e.target.value as BracketDistanceUnit)}
            aria-label="Distance unit"
            className={`h-[38px] shrink-0 cursor-pointer rounded-lg border px-1.5 text-[10px] font-semibold outline-none focus:border-blue-500 disabled:opacity-50 ${isDark ? 'border-[#3F3F46] bg-[#27272A] text-[#A1A1AA] hover:border-[#52525B]' : 'border-[#D4D4D8] bg-white text-[#52525B] hover:border-[#A1A1AA]'}`}
          >
            <option value="ticks">Ticks</option>
            <option value="points">Pts</option>
            {dollarEnabled && <option value="dollars">$</option>}
          </select>
        </div>
      </label>
      {equivalents && (
        <p className="col-span-2 truncate px-0.5 font-mono text-[9px] tabular-nums text-[#71717A]">
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
  isDark = true,
}: {
  disabled: boolean
  variant: 'sl' | 'tp'
  activeDistance: string
  distanceUnit: BracketDistanceUnit
  tickSize: number
  tickValue?: number
  onSelect: (amount: number) => void
  isDark?: boolean
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
            className={`${color} flex h-7 min-w-[2.25rem] items-center justify-center rounded-lg border px-2 font-mono text-[10px] font-medium transition disabled:opacity-40 ${isDark ? 'border-[#3F3F46] bg-[#27272A]' : 'border-[#D4D4D8] bg-white'} ${
              isActive ? 'ring-1 ring-[#3b82f6] border-[#3b82f6]/50 bg-[#3b82f6]/10' : ''
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
