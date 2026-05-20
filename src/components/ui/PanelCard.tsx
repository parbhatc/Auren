import type { ReactNode } from 'react'
import {
  fieldLabelClass,
  panelCardClass,
  panelCardDescClass,
  panelCardTitleClass,
} from '../../styles/aurenTheme'

export function PanelCard({
  isDark,
  title,
  description,
  children,
  className = '',
}: {
  isDark: boolean
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`${panelCardClass(isDark)} ${className}`}>
      <h2 className={panelCardTitleClass(isDark)}>{title}</h2>
      {description ? <p className={panelCardDescClass(isDark)}>{description}</p> : null}
      {children}
    </section>
  )
}

export function PanelField({
  label,
  isDark,
  children,
}: {
  label: string
  isDark: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label className={fieldLabelClass(isDark)}>{label}</label>
      {children}
    </div>
  )
}

export function CenteredPanel({
  children,
  maxWidth = 'max-w-2xl',
}: {
  children: ReactNode
  maxWidth?: string
}) {
  return (
    <div className="w-full flex flex-col items-center">
      <div className={`w-full ${maxWidth}`}>{children}</div>
    </div>
  )
}
