import type { LucideIcon } from 'lucide-react'

export function AuthCodeField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  isDark,
  icon: Icon,
  maxLength = 8,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  hint?: string
  isDark: boolean
  icon: LucideIcon
  maxLength?: number
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
      >
        {label}
      </label>
      <div className="relative group">
        <Icon
          className={`absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
            isDark ? 'text-slate-500 group-focus-within:text-violet-400' : 'text-slate-400 group-focus-within:text-violet-600'
          }`}
          aria-hidden
        />
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          className={`w-full min-w-0 rounded-xl border py-2.5 pl-11 pr-4 text-base outline-none transition-all focus:ring-2 focus:ring-violet-500/25 sm:text-sm ${
            isDark
              ? 'border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus:border-violet-500/60'
              : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-violet-500'
          }`}
          placeholder={placeholder}
          autoComplete="one-time-code"
        />
      </div>
      {hint ? (
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{hint}</p>
      ) : null}
    </div>
  )
}
