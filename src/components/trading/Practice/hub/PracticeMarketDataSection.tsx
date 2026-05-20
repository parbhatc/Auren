import { RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PRACTICE_PROP_FIRMS } from '../../../../constants/practice'
import { ROUTES } from '../../../../constants/routes'
import { TradeseaAccount } from '../../../../api/tradesea.api'
import { t } from '../../../../utils/translator'
import {
  alertBannerClass,
  ghostButtonClass,
  primaryButtonClass,
  selectInputClass,
} from '../../../../styles/aurenTheme'
import { PanelCard, PanelField } from '../../../ui/PanelCard'

export default function PracticeMarketDataSection({
  isDark,
  propFirmId,
  marketAccountId,
  tradeseaAccounts,
  tradeseaSessionExpired,
  loadingMd,
  onPropFirmChange,
  onMarketAccountChange,
  onRefreshAccounts,
  onRefreshSession,
}: {
  isDark: boolean
  propFirmId: string
  marketAccountId: string
  tradeseaAccounts: TradeseaAccount[]
  tradeseaSessionExpired: boolean
  loadingMd: boolean
  onPropFirmChange: (id: string) => void
  onMarketAccountChange: (accountId: string) => void
  onRefreshAccounts: () => void
  onRefreshSession: () => void
}) {
  const navigate = useNavigate()
  const selectClass = selectInputClass(isDark)

  return (
    <PanelCard
      isDark={isDark}
      title={t('practice.hub.marketDataTitle')}
      description={t('practice.hub.marketDataHint')}
    >
      <div className="grid sm:grid-cols-2 gap-5">
        <PanelField label={t('practice.propFirmLabel')} isDark={isDark}>
          <select value={propFirmId} onChange={(e) => onPropFirmChange(e.target.value)} className={selectClass}>
            {PRACTICE_PROP_FIRMS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.displayName}
              </option>
            ))}
          </select>
        </PanelField>
        <PanelField label={t('practice.accountLabel')} isDark={isDark}>
          <div className="flex gap-2">
            <select
              value={marketAccountId}
              onChange={(e) => onMarketAccountChange(e.target.value)}
              className={`${selectClass} flex-1 min-w-0`}
            >
              <option value="">{t('practice.selectAccount')}</option>
              {tradeseaAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onRefreshAccounts}
              disabled={loadingMd}
              className={`shrink-0 p-2.5 rounded-xl border transition-colors ${
                isDark
                  ? 'border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={t('practice.refreshAccounts')}
            >
              <RefreshCw className={`w-4 h-4 ${loadingMd ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </PanelField>
      </div>

      {tradeseaSessionExpired && (
        <div className={`mt-5 ${alertBannerClass(isDark, 'amber')}`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm flex-1 leading-relaxed">
              {t('practice.sessionExpired')} {t('practice.goToPropFirmSettings')}
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={onRefreshSession}
                disabled={loadingMd}
                className={ghostButtonClass(isDark)}
              >
                {t('practice.refreshSession')}
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.PROPS_SETTINGS)}
                className={primaryButtonClass()}
              >
                {t('settings.marketDataTab')}
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelCard>
  )
}
