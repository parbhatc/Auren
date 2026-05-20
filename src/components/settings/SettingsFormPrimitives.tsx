import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import {
  fieldLabelClass,
  panelCardClass,
  settingsDividerClass,
  settingsInputClass,
  settingsSaveButtonClass,
} from '../../styles/aurenTheme'

export function SettingsPanel({ isDark, children }: { isDark: boolean; children: ReactNode }) {
  return <div className={`${panelCardClass(isDark)} !p-0 overflow-hidden`}>{children}</div>
}

export function SettingsSection({
  isDark,
  title,
  hint,
  children,
}: {
  isDark: boolean
  title?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="px-5 sm:px-6 py-5">
      {title ? (
        <div className="mb-4">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
          {hint ? (
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{hint}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function SettingsDivider({ isDark }: { isDark: boolean }) {
  return <div className={`border-t ${settingsDividerClass(isDark)}`} />
}

export function SettingsReadOnlyRow({
  isDark,
  label,
  value,
  note,
}: {
  isDark: boolean
  label: string
  value: string
  note?: string
}) {
  return (
    <div>
      <p className={fieldLabelClass(isDark)}>{label}</p>
      <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{value}</p>
      {note ? <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{note}</p> : null}
    </div>
  )
}

export function SettingsField({
  isDark,
  id,
  label,
  type = 'text',
  placeholder,
  icon: Icon,
  register,
  autoComplete,
  error,
}: {
  isDark: boolean
  id: string
  label: string
  type?: string
  placeholder: string
  icon?: LucideIcon
  register: UseFormRegisterReturn
  autoComplete?: string
  error?: FieldError
}) {
  const hasError = Boolean(error?.message)
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className={fieldLabelClass(isDark)}>
        {label}
      </label>
      <div className="relative mt-1.5">
        {Icon ? (
          <Icon
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
              hasError ? 'text-red-400' : isDark ? 'text-slate-500' : 'text-slate-400'
            }`}
          />
        ) : null}
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`${settingsInputClass(isDark)} ${Icon ? 'pl-10' : ''} ${
            hasError ? 'border-red-500/60 ring-red-500/20' : ''
          }`}
          aria-invalid={hasError}
          {...register}
        />
      </div>
      {hasError ? (
        <p className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`} role="alert">
          {error?.message}
        </p>
      ) : null}
    </div>
  )
}

export function SettingsFormRow({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
      {children}
      {action ? <div className="sm:pb-0.5">{action}</div> : null}
    </div>
  )
}

export function SettingsSaveButton({
  loading,
  children,
  disabled,
}: {
  loading?: boolean
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button type="submit" disabled={disabled || loading} className={settingsSaveButtonClass()}>
      {children}
    </button>
  )
}

export function SettingsStatusPill({
  isDark,
  tone,
  children,
}: {
  isDark: boolean
  tone: 'success' | 'neutral'
  children: ReactNode
}) {
  const styles =
    tone === 'success'
      ? isDark
        ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25'
        : 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : isDark
        ? 'bg-slate-800/80 text-slate-300 ring-slate-700'
        : 'bg-slate-100 text-slate-700 ring-slate-200'
  return (
    <p className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl ring-1 ${styles}`}>
      {children}
    </p>
  )
}
