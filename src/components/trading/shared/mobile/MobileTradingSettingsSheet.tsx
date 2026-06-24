import { X } from 'lucide-react'
import { t } from '../../../../utils/translator'
import { TradingLimitsSettingsPanel } from '../header/TradingLimitsSettingsPanel'
import { MobileTradeOverlayShell } from './MobileTradeOverlayShell'

export function MobileTradingSettingsSheet({
  open,
  onClose,
  practiceAccountId,
  isDark,
}: {
  open: boolean
  onClose: () => void
  practiceAccountId: string
  isDark: boolean
}) {
  const shell = isDark
    ? 'bg-slate-900 border-slate-700'
    : 'bg-white border-slate-200'

  return (
    <MobileTradeOverlayShell
      open={open}
      onClose={onClose}
      ariaLabel={t('practice.lockout.settingsTitle')}
    >
      <div
        className={`flex flex-col max-h-[min(78vh,640px)] rounded-t-2xl border-t shadow-2xl overflow-hidden ${shell}`}
      >
        <div
          className={`flex items-center justify-between px-3 py-2 border-b shrink-0 ${
            isDark ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Settings
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
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          <TradingLimitsSettingsPanel
            practiceAccountId={practiceAccountId}
            isDark={isDark}
            onDismiss={onClose}
          />
        </div>
      </div>
    </MobileTradeOverlayShell>
  )
}
