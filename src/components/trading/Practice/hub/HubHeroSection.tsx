import type { LucideIcon } from 'lucide-react'

type HubHeroAccent = 'violet' | 'emerald' | 'sky'

const accentStyles: Record<
  HubHeroAccent,
  { icon: string; badge: string }
> = {
  violet: {
    icon: 'text-violet-400',
    badge: 'text-violet-400/90',
  },
  emerald: {
    icon: 'text-emerald-400',
    badge: 'text-emerald-400/90',
  },
  sky: {
    icon: 'text-sky-400',
    badge: 'text-sky-400/90',
  },
}

const accentStylesLight: Record<HubHeroAccent, { icon: string; badge: string }> = {
  violet: { icon: 'text-violet-600', badge: 'text-violet-600' },
  emerald: { icon: 'text-emerald-600', badge: 'text-emerald-600' },
  sky: { icon: 'text-sky-600', badge: 'text-sky-600' },
}

export default function HubHeroSection({
  isDark,
  icon: Icon,
  badge,
  headline,
  subtitle,
  accent = 'violet',
}: {
  isDark: boolean
  icon: LucideIcon
  badge: string
  headline: string
  subtitle: string
  accent?: HubHeroAccent
}) {
  const styles = isDark ? accentStyles[accent] : accentStylesLight[accent]

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${styles.icon}`} aria-hidden />
        <span className={`text-xs font-semibold uppercase tracking-wider ${styles.badge}`}>
          {badge}
        </span>
      </div>
      <h1
        className={`text-2xl sm:text-3xl font-bold tracking-tight ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {headline}
      </h1>
      <p
        className={`mt-2 max-w-2xl text-sm sm:text-base leading-relaxed ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}
      >
        {subtitle}
      </p>
    </section>
  )
}
