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
    <div className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
      <p className="mb-4 text-xs leading-5 text-zinc-500">
        Enter your Tradesea session tokens to connect manually.
      </p>
      <div className="space-y-3">
        <label className="block text-xs font-medium" htmlFor="tradesea-access-token">
          Access token
          <input
            id="tradesea-access-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={accessToken}
            onChange={(e) => onAccessChange(e.target.value)}
            placeholder={t('props.tradesea.accessTokenPlaceholder')}
            className={`mt-2 ${inputClass}`}
          />
        </label>
        <label className="block text-xs font-medium" htmlFor="tradesea-refresh-token">
          Refresh token <span className="font-normal text-zinc-500">(optional)</span>
          <input
            id="tradesea-refresh-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={refreshToken}
            onChange={(e) => onRefreshChange(e.target.value)}
            placeholder={t('props.tradesea.refreshTokenPlaceholder')}
            className={`mt-2 ${inputClass}`}
          />
        </label>
        <button
          type="button"
          disabled={saving || !accessToken.trim()}
          onClick={onSave}
          className={`${settingsSaveButtonClass()} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {saving ? t('props.tradesea.savingTokens') : t('props.tradesea.saveTokens')}
        </button>
      </div>
    </div>
  )
}
