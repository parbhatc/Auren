import { X } from 'lucide-react'
import PracticeTradePanel, { type PracticeTradePanelProps } from './PracticeTradePanel'

/** Full trade panel slide-up on mobile (DOM / ticket tabs). */
export function PracticeMobileOrderSheet({
  open,
  onClose,
  isDark,
  padProps,
}: {
  open: boolean
  onClose: () => void
  isDark: boolean
  padProps: PracticeTradePanelProps
}) {
  if (!open) return null

  return (
    <div className="lg:hidden fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal>
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close order panel"
        onClick={onClose}
      />
      <div
        className={`relative flex flex-col max-h-[min(78vh,640px)] rounded-t-2xl border-t shadow-2xl overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div
          className={`flex items-center justify-between px-3 py-2 border-b shrink-0 ${
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
        <div className="flex-1 min-h-0 overflow-hidden max-w-none w-full">
          <PracticeTradePanel {...padProps} hideDetach fullWidth />
        </div>
      </div>
    </div>
  )
}
