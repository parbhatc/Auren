import { Clock, TrendingDown, TrendingUp } from 'lucide-react'

export type PracticeOrderToastKind = 'buy' | 'sell' | 'pending'

const META: Record<
  PracticeOrderToastKind,
  { accent: string; Icon: typeof TrendingUp }
> = {
  buy: { accent: '#22c55e', Icon: TrendingUp },
  sell: { accent: '#ef4444', Icon: TrendingDown },
  pending: { accent: '#8b5cf6', Icon: Clock },
}

export function PracticeOrderToastContent({
  kind,
  title,
  subtitle,
}: {
  kind: PracticeOrderToastKind
  title: string
  subtitle?: string
}) {
  const { accent, Icon } = META[kind]

  return (
    <div className="mds-connection-toast" style={{ ['--mds-accent' as string]: accent }}>
      <span className="mds-connection-toast__accent" aria-hidden />
      <span className="mds-connection-toast__icon" aria-hidden>
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <span className="mds-connection-toast__text">
        <span className="mds-connection-toast__title">{title}</span>
        {subtitle ? (
          <span className="mds-connection-toast__subtitle">{subtitle}</span>
        ) : null}
      </span>
    </div>
  )
}
