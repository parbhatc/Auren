import { X } from 'lucide-react'
import TradePanel, { type TradePanelProps } from '../pad/TradePanel'
import { MobileTradeOverlayShell } from './MobileTradeOverlayShell'

/** Full trade panel slide-up on mobile (DOM / ticket tabs). */
export function MobileOrderSheet({
  open,
  onClose,
  isDark,
  padProps,
}: {
  open: boolean
  onClose: () => void
  isDark: boolean
  padProps: TradePanelProps
}) {
  return (
    <MobileTradeOverlayShell open={open} onClose={onClose} ariaLabel="Trade panel">
      <div
        className={`flex flex-col h-[min(72vh,580px)] w-full rounded-t-2xl border-t shadow-2xl overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div
          className={`flex items-center justify-between px-3 py-1.5 border-b shrink-0 ${
            isDark ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Trade panel
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg ${
              isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <TradePanel {...padProps} hideDetach fullWidth />
        </div>
      </div>
    </MobileTradeOverlayShell>
  )
}
