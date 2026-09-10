import type { ReactNode } from 'react'
import ProductHeader from './ProductHeader'
import { useTheme } from '../../hooks/useTheme'

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { isDark, toggleTheme } = useTheme()
  return (
    <div
      className={`auren-shell-offset ${isDark ? 'min-h-screen bg-[#09090B]' : 'min-h-screen bg-[#FAFAFA]'}`}
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
}: {
  eyebrow: string
  title: string
  description: string
}) {
  const { isDark } = useTheme()
  return (
    <header className="mb-6 sm:mb-8">
      <p
        className={`text-xs font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-blue-400' : 'text-blue-700'}`}
      >
        {eyebrow}
      </p>
      <h1
        className={`mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
      >
        {title}
      </h1>
      <p
        className={`mt-2 max-w-3xl text-sm leading-6 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}
      >
        {description}
      </p>
    </header>
  )
}

export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { isDark } = useTheme()
  return (
    <section
      className={`rounded-xl border ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'} ${className}`}
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
}: {
  label: string
  value: string
  hint: string
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  const { isDark } = useTheme()
  const valueTone =
    tone === 'positive'
      ? 'text-emerald-500'
      : tone === 'negative'
        ? 'text-red-500'
        : isDark
          ? 'text-[#FAFAFA]'
          : 'text-[#09090B]'
  return (
    <Surface className="p-4 sm:p-5">
      <p className={`text-xs font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${valueTone}`}>
        {value}
      </p>
      <p className={`mt-2 text-xs ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>{hint}</p>
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
    tone === 'emerald'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : tone === 'red'
          ? 'bg-red-500'
          : 'bg-blue-500'
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}>{label}</span>
        <span className={`tabular-nums ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
          {detail}
        </span>
      </div>
      <div
        className={isDark ? 'h-1.5 rounded-full bg-[#27272A]' : 'h-1.5 rounded-full bg-[#E4E4E7]'}
      >
        <div
          className={`h-full rounded-full ${bar}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}
