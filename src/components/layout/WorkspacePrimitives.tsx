import type { CSSProperties, ReactNode } from 'react'
import ProductHeader from './ProductHeader'
import { useTheme } from '../../hooks/useTheme'

export function workspaceThemeStyle(isDark: boolean): CSSProperties {
  return {
    '--workspace-accent': 'var(--app-accent)',
    '--workspace-accent-soft': 'var(--app-accent-soft)',
    '--workspace-success': isDark ? '#34D399' : '#059669',
    '--workspace-danger': isDark ? '#F87171' : '#DC2626',
    '--workspace-warning': isDark ? '#FBBF24' : '#D97706',
    '--workspace-border': 'var(--app-border)',
    '--workspace-text': 'var(--app-text)',
    '--workspace-muted': 'var(--app-muted)',
  } as CSSProperties
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { isDark, toggleTheme } = useTheme()
  return (
    <div
      style={workspaceThemeStyle(isDark)}
      className="auren-shell-offset auren-workspace min-h-screen"
    >
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
      {children}
    </div>
  )
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  const { isDark } = useTheme()
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-8">
      <div className="max-w-3xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-accent)]">
          {eyebrow}
        </p>
        <h1
          className={`mt-2 text-[28px] font-semibold leading-tight tracking-[-0.04em] sm:text-[32px] ${isDark ? 'text-[#F7F7F8]' : 'text-[#18181B]'}`}
        >
          {title}
        </h1>
        <p
          className={`mt-2 max-w-2xl text-[13px] leading-6 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}
        >
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      ) : null}
    </header>
  )
}

export function Surface({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const { isDark } = useTheme()
  return (
    <section
      className={`auren-workspace-surface rounded-[20px] border ${isDark ? '' : 'shadow-[0_2px_8px_-5px_rgba(24,24,27,0.12)]'} ${className}`}
    >
      {children}
    </section>
  )
}

export function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
  accent = false,
}: {
  label: string
  value: string
  hint: string
  tone?: 'positive' | 'negative' | 'neutral'
  accent?: boolean
}) {
  const { isDark } = useTheme()
  const valueTone =
    tone === 'positive'
      ? isDark
        ? 'text-emerald-400'
        : 'text-emerald-600'
      : tone === 'negative'
        ? isDark
          ? 'text-red-400'
          : 'text-[#DC2626]'
        : accent
          ? 'text-[var(--app-accent)]'
          : isDark
            ? 'text-[#FAFAFA]'
            : 'text-[#18181B]'
  return (
    <Surface className="min-w-0 p-5 sm:p-6">
      <p
        className={`text-[11px] font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}
      >
        {label}
      </p>
      <p
        className={`mt-3 truncate text-[26px] font-semibold tabular-nums leading-none tracking-[-0.04em] ${valueTone}`}
      >
        {value}
      </p>
      <p
        className={`mt-3 text-[11px] leading-5 ${isDark ? 'text-[#85858E]' : 'text-[#71717A]'}`}
      >
        {hint}
      </p>
    </Surface>
  )
}

export function ProgressRow({
  label,
  value,
  detail,
  tone = 'blue',
}: {
  label: string
  value: number
  detail: string
  tone?: 'blue' | 'emerald' | 'amber' | 'red'
}) {
  const { isDark } = useTheme()
  const bar =
    tone === 'red'
      ? 'bg-red-500'
      : tone === 'emerald'
        ? 'bg-emerald-500'
        : tone === 'amber'
          ? 'bg-amber-500'
          : isDark
            ? 'bg-zinc-300'
            : 'bg-zinc-600'
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
        <span
          className={`font-medium ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}
        >
          {label}
        </span>
        <span
          className={`tabular-nums ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}
        >
          {detail}
        </span>
      </div>
      <div
        className={
          isDark
            ? 'h-1.5 overflow-hidden rounded-full bg-[#2B2B2D]'
            : 'h-1.5 overflow-hidden rounded-full bg-[var(--app-inset)]'
        }
      >
        <div
          className={`h-full rounded-full ${bar}`}
          style={{
            width: `${Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))}%`,
          }}
        />
      </div>
    </div>
  )
}
