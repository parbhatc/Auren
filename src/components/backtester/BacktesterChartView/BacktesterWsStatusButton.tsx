import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

type WsState = 'connecting' | 'connected' | 'disconnected'

export default function BacktesterWsStatusButton({
  state,
  onReconnect,
  isDark,
}: {
  state: WsState
  onReconnect?: () => void
  isDark: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const connected = state === 'connected'
  const connecting = state === 'connecting'
  const stroke = connected ? '#22C55E' : connecting ? '#EAB308' : '#F85149'
  const title = connected
    ? 'Replay data connected'
    : connecting
      ? 'Connecting to replay server…'
      : 'Replay data disconnected'

  return (
    <div className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((v) => !v)}
        className={`rounded-lg transition-all duration-200 focus:outline-none flex items-center justify-center bg-transparent border border-transparent hover:bg-[#8b5cf6]/10 hover:border-[#8b5cf6]/25 focus:ring-2 focus:ring-[#8b5cf6]/40 w-7 h-7 ${
          connecting ? 'cursor-wait' : 'cursor-pointer'
        }`}
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

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[190] cursor-default"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className={`absolute right-0 top-full z-[200] mt-1 w-52 rounded-lg border p-2 shadow-xl ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <p className={`text-xs mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{title}</p>
            {onReconnect && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onReconnect()
                }}
                className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium ${
                  isDark
                    ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
