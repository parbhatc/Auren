/** Compact on/off switch for practice forms and header panels. */
export default function PracticeSwitch({
  checked,
  onChange,
  isDark,
  label,
  disabled = false,
  id,
}: {
  checked: boolean
  onChange: (on: boolean) => void
  isDark: boolean
  label?: string
  disabled?: boolean
  id?: string
}) {
  const track = checked
    ? 'bg-violet-600'
    : isDark
      ? 'bg-slate-700'
      : 'bg-slate-300'

  const switchEl = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-40 ${track}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )

  if (!label) return switchEl

  return (
    <label
      htmlFor={id}
      className={`flex items-center justify-between gap-3 cursor-pointer ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
        {label}
      </span>
      {switchEl}
    </label>
  )
}
