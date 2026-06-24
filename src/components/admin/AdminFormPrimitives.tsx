import type { ReactNode } from 'react'
import {
  adminDividerClass,
  adminInsetClass,
  adminPrimaryButtonClass,
  adminSaveButtonClass,
  adminSectionHintClass,
  adminSectionTitleClass,
  panelCardClass,
} from '../../styles/aurenTheme'

export function AdminEmbeddedBody({ children }: { children: ReactNode }) {
  return <div className="px-5 sm:px-6 py-5 sm:py-6">{children}</div>
}

export function AdminToolbar({
  isDark,
  hint,
  action,
}: {
  isDark: boolean
  hint?: string
  action: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      {hint ? <p className={`text-sm leading-relaxed ${adminSectionHintClass(isDark)}`}>{hint}</p> : null}
      <div className="shrink-0 w-full sm:w-auto">{action}</div>
    </div>
  )
}

export function AdminListEmpty({ isDark, children }: { isDark: boolean; children: ReactNode }) {
  return (
    <div className={`rounded-xl px-6 py-10 text-center ${adminInsetClass(isDark)}`}>
      <p className={`text-sm ${adminSectionHintClass(isDark)}`}>{children}</p>
    </div>
  )
}

export { adminPrimaryButtonClass, adminSaveButtonClass }

export function AdminConfigPanel({
  isDark,
  embedded,
  children,
}: {
  isDark: boolean
  embedded?: boolean
  children: ReactNode
}) {
  if (embedded) {
    return <div className={`divide-y ${adminDividerClass(isDark)}`}>{children}</div>
  }

  return (
    <div className={`${panelCardClass(isDark)} !p-0 overflow-hidden divide-y ${adminDividerClass(isDark)}`}>
      {children}
    </div>
  )
}

export function AdminConfigSection({
  isDark,
  title,
  hint,
  children,
}: {
  isDark: boolean
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="px-5 sm:px-6 py-5 sm:py-6 first:pt-5 sm:first:pt-6">
      <div className="mb-4">
        <h3 className={adminSectionTitleClass(isDark)}>{title}</h3>
        {hint ? <p className={adminSectionHintClass(isDark)}>{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function AdminConfigInset({
  isDark,
  title,
  children,
}: {
  isDark: boolean
  title?: string
  children: ReactNode
}) {
  return (
    <div className={`mt-4 ${adminInsetClass(isDark)}`}>
      {title ? <h4 className={`${adminSectionTitleClass(isDark)} mb-3`}>{title}</h4> : null}
      {children}
    </div>
  )
}

export function AdminConfigSaveBar({
  isDark,
  loading,
  children,
}: {
  isDark: boolean
  loading?: boolean
  children: ReactNode
}) {
  return (
    <div className={`pt-5 sm:pt-6 px-5 sm:px-6 pb-5 sm:pb-6 flex justify-end border-t ${adminDividerClass(isDark)}`}>
      <button type="submit" disabled={loading} className={adminSaveButtonClass()}>
        {children}
      </button>
    </div>
  )
}
