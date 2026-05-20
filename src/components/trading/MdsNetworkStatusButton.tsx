import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Wifi, WifiOff, Loader2 } from 'lucide-react'
import type { TradeseaMdsClient, MdsConnectionState } from '../../services/tradesea/TradeseaMdsClient'

type MdsNetworkStatusButtonProps = {
  mds: TradeseaMdsClient | null | undefined
  onReconnect?: () => void
  className?: string
}

const STATUS_META: Record<
  MdsConnectionState,
  { label: string; hint: string; dot: string; Icon: typeof Wifi }
> = {
  connected: {
    label: 'Live',
    hint: 'Market data stream is active',
    dot: 'bg-[#3fb950] shadow-[0_0_8px_rgba(63,185,80,0.55)]',
    Icon: Wifi,
  },
  connecting: {
    label: 'Connecting',
    hint: 'Opening market data…',
    dot: 'bg-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.45)]',
    Icon: Loader2,
  },
  disconnected: {
    label: 'Offline',
    hint: 'Stream disconnected',
    dot: 'bg-[#f85149] shadow-[0_0_8px_rgba(248,81,73,0.45)]',
    Icon: WifiOff,
  },
}

export function MdsNetworkStatusButton({ mds, onReconnect, className = '' }: MdsNetworkStatusButtonProps) {
  const [state, setState] = useState<MdsConnectionState>(() => mds?.getConnectionState() ?? 'disconnected')
  const [menuOpen, setMenuOpen] = useState(false)
  const [autoReconnect, setAutoReconnect] = useState(() => mds?.isAutoReconnectEnabled() ?? true)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mds) {
      setState('disconnected')
      setAutoReconnect(true)
      return
    }
    setState(mds.getConnectionState())
    setAutoReconnect(mds.isAutoReconnectEnabled())
    const offConnection = mds.on('connection', (s) => setState(s))
    const offOpen = mds.on('open', () => setState('connected'))
    const offClose = mds.on('close', () => setState('disconnected'))
    const offAuto = mds.on('autoReconnect', (enabled) => setAutoReconnect(enabled))
    return () => {
      offConnection()
      offOpen()
      offClose()
      offAuto()
    }
  }, [mds])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (ev: MouseEvent) => {
      if (!rootRef.current?.contains(ev.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const connected = state === 'connected'
  const connecting = state === 'connecting'
  const meta = STATUS_META[state]
  const stroke = connected ? '#22C55E' : connecting ? '#EAB308' : '#EF4444'
  const StatusIcon = meta.Icon

  const refreshStream = useCallback(() => {
    setMenuOpen(false)
    if (onReconnect) {
      onReconnect()
      return
    }
    mds?.reconnect()
  }, [mds, onReconnect])

  const toggleAutoReconnect = useCallback(() => {
    const next = !autoReconnect
    mds?.setAutoReconnectEnabled(next)
    setAutoReconnect(next)
  }, [autoReconnect, mds])

  const title = connected
    ? 'Market data connected. Stream options.'
    : connecting
      ? 'Connecting market data…'
      : 'Market data offline. Stream options.'

  const handleButtonClick = () => {
    if (connecting) return
    setMenuOpen((open) => !open)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={handleButtonClick}
        disabled={connecting}
        className={`rounded-lg transition-all duration-200 focus:outline-none flex items-center justify-center bg-transparent border border-transparent hover:bg-[#8b5cf6]/10 hover:border-[#8b5cf6]/25 focus:ring-2 focus:ring-[#8b5cf6]/40 w-7 h-7 ${
          menuOpen ? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/30' : ''
        } ${connecting ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="18"
          height="18"
          strokeWidth="2"
          stroke={stroke}
          aria-hidden
        >
          <path d="M12 20h.01" />
          <path d="M2 8.82a15 15 0 0 1 20 0" />
          <path d="M5 12.859a10 10 0 0 1 14 0" />
          <path d="M8.5 16.429a5 5 0 0 1 7 0" />
        </svg>
      </button>

      {menuOpen && !connecting && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[200] mt-2 w-[248px] overflow-hidden rounded-2xl border border-[#475569]/90 bg-[#0f172a] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-center gap-2.5 border-b border-[#334155] bg-[#020617]/80 px-3 py-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#e6edf3] leading-tight">{meta.label}</p>
              <p className="text-[10px] text-[#7d8590] truncate">{meta.hint}</p>
            </div>
            <StatusIcon
              className={`h-4 w-4 shrink-0 text-[#7d8590] ${connecting ? 'animate-spin' : ''}`}
              aria-hidden
            />
          </div>

          <div className="p-1.5 flex flex-col gap-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={refreshStream}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]/50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#475569] bg-[#020617] text-[#a78bfa] group-hover:border-[#8b5cf6]/50 group-hover:bg-[#8b5cf6]/10">
                <RefreshCw className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[#e6edf3]">Refresh stream</span>
                <span className="block text-[10px] text-[#7d8590]">Reconnect quotes & chart</span>
              </span>
            </button>

            <div
              role="menuitem"
              className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2.5 hover:bg-[#1e293b]"
            >
              <div className="min-w-0 pr-1">
                <p className="text-sm font-medium text-[#e6edf3]">Auto-reconnect</p>
                <p className="text-[10px] text-[#7d8590] leading-snug">
                  {autoReconnect
                    ? 'Retries after drops & limits'
                    : 'Manual refresh only'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoReconnect}
                onClick={toggleAutoReconnect}
                className={`relative h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]/50 ${
                  autoReconnect
                    ? 'border-[#8b5cf6]/60 bg-[#8b5cf6]'
                    : 'border-[#475569] bg-[#334155]'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                    autoReconnect ? 'left-[1.35rem]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          <p className="border-t border-[#334155] px-3 py-2 text-[9px] leading-snug text-[#64748b]">
            Close extra Tradesea / Auren tabs if you hit connection limits.
          </p>
        </div>
      )}
    </div>
  )
}
