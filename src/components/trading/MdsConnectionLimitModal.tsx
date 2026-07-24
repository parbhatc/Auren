import { createPortal } from 'react-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'

type MdsConnectionLimitModalProps = {
  isOpen: boolean
  isDark: boolean
  onRefresh: () => void
}

export function MdsConnectionLimitModal({ isOpen, isDark, onRefresh }: MdsConnectionLimitModalProps) {
  if (!isOpen) return null

  const shell = isDark
    ? 'bg-[#18181B] border-[#3F3F46] shadow-[0_24px_64px_rgba(0,0,0,0.7)]'
    : 'bg-white border-slate-200 shadow-2xl shadow-slate-300/40'

  const titleClass = isDark ? 'text-[#FAFAFA]' : 'text-slate-800'
  const bodyClass = isDark ? 'text-[#A1A1AA]' : 'text-slate-500'
  const iconWrap = isDark ? 'bg-amber-500/15 ring-1 ring-amber-500/20' : 'bg-amber-50'
  const iconClass = isDark ? 'text-amber-400' : 'text-amber-600'

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mds-connection-limit-title"
      aria-describedby="mds-connection-limit-desc"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" aria-hidden />

      <div
        className={`relative z-10 w-full max-w-md rounded-2xl border p-6 sm:p-7 flex flex-col items-center gap-4 animate-slide-down ${shell}`}
      >
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full ${iconWrap}`}
          aria-hidden
        >
          <AlertTriangle className={`h-8 w-8 ${iconClass}`} strokeWidth={2} />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h2 id="mds-connection-limit-title" className={`text-lg font-semibold tracking-tight ${titleClass}`}>
            Connection Limit Reached
          </h2>
          <p id="mds-connection-limit-desc" className={`text-sm leading-relaxed max-w-[20rem] ${bodyClass}`}>
            Your account is already connected on another device or browser tab. Close other sessions, then try again.
          </p>
        </div>

        <div
          className={`w-full rounded-xl border px-3.5 py-2.5 text-xs leading-snug text-center ${
            isDark
              ? 'border-[#27272A] bg-[#09090B] text-[#71717A]'
              : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}
        >
          Tip: close extra Tradesea or Auren tabs on this account before refreshing.
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className={`mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
            isDark
              ? 'bg-[#FAFAFA] text-[#09090B] hover:bg-[#E4E4E7] focus-visible:ring-white/40'
              : 'bg-[#18181B] text-white hover:bg-[#27272A] focus-visible:ring-black/30'
          }`}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh
        </button>
      </div>
    </div>,
    document.body
  )
}
