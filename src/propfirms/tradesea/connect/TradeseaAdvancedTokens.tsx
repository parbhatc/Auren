import { ChevronDown } from 'lucide-react'
import { settingsInputClass, settingsSaveButtonClass } from '../../../styles/aurenTheme'
import { t } from '../../../utils/translator'

type TradeseaAdvancedTokensProps = {
  isDark: boolean
  accessToken: string
  refreshToken: string
  saving: boolean
  onAccessChange: (value: string) => void
  onRefreshChange: (value: string) => void
  onSave: () => void
}

export default function TradeseaAdvancedTokens({
  isDark,
  accessToken,
  refreshToken,
  saving,
  onAccessChange,
  onRefreshChange,
  onSave,
}: TradeseaAdvancedTokensProps) {
  const inputClass = settingsInputClass(isDark)

  return (
    <details className={`group py-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold ${
          isDark ? 'text-slate-200' : 'text-slate-800'
        }`}
      >
        <span>{t('props.tradesea.advancedSection')}</span>
        <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180 text-slate-500" />
      </summary>
      <p className={`text-xs mt-3 mb-3 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        {t('props.tradesea.manualDescription')}
      </p>
      <div className="space-y-3">
        <input
          type="text"
          value={accessToken}
          onChange={(e) => onAccessChange(e.target.value)}
          placeholder={t('props.tradesea.accessTokenPlaceholder')}
          className={inputClass}
        />
        <input
          type="text"
          value={refreshToken}
          onChange={(e) => onRefreshChange(e.target.value)}
          placeholder={t('props.tradesea.refreshTokenPlaceholder')}
          className={inputClass}
        />
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className={`${settingsSaveButtonClass()} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {saving ? t('props.tradesea.savingTokens') : t('props.tradesea.saveTokens')}
        </button>
      </div>
    </details>
  )
}
