import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react'

export type MdsConnectionToastKind =
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'disconnected'
  | 'limit'

const META: Record<
  MdsConnectionToastKind,
  { title: string; subtitle: string; accent: string; Icon: typeof Wifi }
> = {
  connecting: {
    title: 'Connecting',
    subtitle: 'Opening market data stream…',
    accent: '#8b5cf6',
    Icon: Loader2,
  },
  reconnecting: {
    title: 'Reconnecting',
    subtitle: 'Restoring live quotes & chart…',
    accent: '#eab308',
    Icon: Loader2,
  },
  connected: {
    title: 'Connected',
    subtitle: 'Market data is live',
    accent: '#22c55e',
    Icon: Wifi,
  },
  disconnected: {
    title: 'Disconnected',
    subtitle: 'Market data offline',
    accent: '#ef4444',
    Icon: WifiOff,
  },
  limit: {
    title: 'Connection limit',
    subtitle: 'Close other Tradesea / Auren tabs, then retry',
    accent: '#f97316',
    Icon: AlertTriangle,
  },
}

export function MdsConnectionToastContent({ kind }: { kind: MdsConnectionToastKind }) {
  const { title, subtitle, accent, Icon } = META[kind]
  const spin = kind === 'connecting' || kind === 'reconnecting'

  return (
    <div className="mds-connection-toast" style={{ ['--mds-accent' as string]: accent }}>
      <span className="mds-connection-toast__accent" aria-hidden />
      <span
        className={`mds-connection-toast__icon${spin ? ' mds-connection-toast__icon--spin' : ''}`}
        aria-hidden
      >
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <span className="mds-connection-toast__text">
        <span className="mds-connection-toast__title">{title}</span>
        <span className="mds-connection-toast__subtitle">{subtitle}</span>
      </span>
    </div>
  )
}

