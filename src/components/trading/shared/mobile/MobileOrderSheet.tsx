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
        className={`flex h-[min(82dvh,680px)] w-full flex-col overflow-hidden rounded-t-2xl border-t ${
          isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'
        }`}
      >
        <div
          className={`flex items-center justify-between px-3 py-1.5 border-b shrink-0 ${
            isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'
          }`}
        >
          <div>
            <span className={`block text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Order entry</span>
            <span className={`block text-[10px] ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>Ticket and depth of market</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg ${
              isDark ? 'text-[#A1A1AA] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]'
            }`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 pt-0">
          <TradePanel {...padProps} hideDetach fullWidth />
        </div>
      </div>
    </MobileTradeOverlayShell>
  )
}
