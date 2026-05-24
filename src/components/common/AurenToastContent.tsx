import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import type { AurenToastKind } from '../../types/toast'

export type { AurenToastKind } from '../../types/toast'

const META: Record<
  AurenToastKind,
  { accent: string; Icon: typeof CheckCircle2 }
> = {
  success: { accent: '#22c55e', Icon: CheckCircle2 },
  error: { accent: '#ef4444', Icon: XCircle },
  info: { accent: '#8b5cf6', Icon: Info },
  warning: { accent: '#f59e0b', Icon: AlertTriangle },
  lockout: { accent: '#f97316', Icon: Lock },
  buy: { accent: '#22c55e', Icon: TrendingUp },
  sell: { accent: '#ef4444', Icon: TrendingDown },
  pending: { accent: '#8b5cf6', Icon: Clock },
}

export function AurenToastContent({
  kind,
  title,
  subtitle,
}: {
  kind: AurenToastKind
  title: string
  subtitle?: string
}) {
  const { accent, Icon } = META[kind]

  return (
    <div className="auren-toast" style={{ ['--auren-toast-accent' as string]: accent }}>
      <span className="auren-toast__accent" aria-hidden />
      <span className="auren-toast__icon" aria-hidden>
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <span className="auren-toast__text">
        <span className="auren-toast__title">{title}</span>
        {subtitle ? <span className="auren-toast__subtitle">{subtitle}</span> : null}
      </span>
    </div>
  )
}
