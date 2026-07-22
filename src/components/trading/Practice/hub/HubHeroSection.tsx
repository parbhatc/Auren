import type { LucideIcon } from 'lucide-react'

type HubHeroAccent = 'blue' | 'emerald' | 'sky' | 'amber'

const accentStyles: Record<
  HubHeroAccent,
  { icon: string; badge: string }
> = {
  blue: {
    icon: 'text-blue-400',
    badge: 'text-blue-400/90',
  },
  emerald: {
    icon: 'text-emerald-400',
    badge: 'text-emerald-400/90',
  },
  sky: {
    icon: 'text-sky-400',
    badge: 'text-sky-400/90',
  },
  amber: {
    icon: 'text-amber-400',
    badge: 'text-amber-400/90',
  },
}

const accentStylesLight: Record<HubHeroAccent, { icon: string; badge: string }> = {
  blue: { icon: 'text-blue-600', badge: 'text-blue-600' },
  emerald: { icon: 'text-emerald-600', badge: 'text-emerald-600' },
  sky: { icon: 'text-sky-600', badge: 'text-sky-600' },
  amber: { icon: 'text-amber-600', badge: 'text-amber-600' },
}

export default function HubHeroSection({
  isDark,
  icon: Icon,
  badge,
  headline,
  subtitle,
  accent = 'blue',
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
        className={`text-2xl sm:text-3xl font-semibold tracking-[-0.025em] ${
          isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'
        }`}
      >
        {headline}
      </h1>
      <p
        className={`mt-2 max-w-2xl text-sm sm:text-base leading-relaxed ${
          isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'
        }`}
      >
        {subtitle}
      </p>
    </section>
  )
}
