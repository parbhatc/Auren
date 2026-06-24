import { RefreshCw } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PRACTICE_PROP_FIRMS,
  getPracticePropFirmConfig,
} from '../../../../constants/practice'
import { ROUTES } from '../../../../constants/routes'
import {
  firmPersistsMarketAccountId,
  firmUsesCredentialLogin,
  isDisconnectedBannerActive,
  isSessionExpiredBannerActive,
} from '../../../../propfirms'
import type { BrokerAccountOption } from '../../../../propfirms/marketData/types'
import { t } from '../../../../utils/translator'
import {
  alertBannerClass,
  ghostButtonClass,
  primaryButtonClass,
  selectInputClass,
} from '../../../../styles/aurenTheme'
import { PanelCard, PanelField } from '../../../ui/PanelCard'

export default function MarketDataSection({
  isDark,
  propFirmId,
  marketAccountId,
  marketConnected,
  marketStatusLabel,
  brokerAccounts,
  brokerSessionExpired,
  loadingMd,
  onPropFirmChange,
  onMarketAccountChange,
  onRefreshAccounts,
  onRefreshSession,
  embedded = false,
}: {
  isDark: boolean
  propFirmId: string
  marketAccountId: string
  marketConnected: boolean
  marketStatusLabel: string
  brokerAccounts: BrokerAccountOption[]
  brokerSessionExpired: boolean
  loadingMd: boolean
  onPropFirmChange: (id: string) => void
  onMarketAccountChange: (accountId: string) => void
  onRefreshAccounts: () => void
  onRefreshSession: () => void
  embedded?: boolean
}) {
  const navigate = useNavigate()
  const selectClass = selectInputClass(isDark)
  const autoRefreshAttempted = useRef(false)
  const firm = getPracticePropFirmConfig(propFirmId)
  const usesAccountPicker = firmPersistsMarketAccountId(propFirmId)
  const usesCredentialLoginOnly = firmUsesCredentialLogin(propFirmId) && !usesAccountPicker
  const firmLabel = firm.displayName
  const hintClass = isDark ? 'text-slate-400' : 'text-slate-600'
  const showSessionExpiredBanner = isSessionExpiredBannerActive(propFirmId, brokerSessionExpired)
  const showDisconnectedBanner = isDisconnectedBannerActive(
    propFirmId,
    {
      connected: marketConnected,
      statusLabel: marketStatusLabel,
    },
    brokerSessionExpired
  )

  useEffect(() => {
    if (!showSessionExpiredBanner || loadingMd) return
    if (autoRefreshAttempted.current) return
    autoRefreshAttempted.current = true
    void onRefreshSession()
  }, [showSessionExpiredBanner, loadingMd, onRefreshSession])

  useEffect(() => {
    if (!showSessionExpiredBanner) {
      autoRefreshAttempted.current = false
    }
  }, [showSessionExpiredBanner])

  const fields = (
    <>
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
          {usesAccountPicker ? (
            <div className="flex gap-2">
              <select
                value={marketAccountId}
                onChange={(e) => onMarketAccountChange(e.target.value)}
                className={`${selectClass} flex-1 min-w-0`}
              >
                <option value="">{t('practice.selectAccount')}</option>
                {brokerAccounts.map((a) => (
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
                } disabled:opacity-40 disabled:pointer-events-none`}
                title={t('practice.refreshAccounts')}
              >
                <RefreshCw className={`w-4 h-4 ${loadingMd ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : usesCredentialLoginOnly ? (
            <div
              className={`rounded-xl border px-3 py-2.5 ${
                marketConnected
                  ? isDark
                    ? 'border-emerald-500/35 bg-emerald-500/10'
                    : 'border-emerald-200 bg-emerald-50'
                  : isDark
                    ? 'border-amber-500/35 bg-amber-500/10'
                    : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  marketConnected
                    ? isDark
                      ? 'text-emerald-300'
                      : 'text-emerald-800'
                    : isDark
                      ? 'text-amber-200'
                      : 'text-amber-900'
                }`}
              >
                {marketConnected
                  ? t('practice.hub.nav.connected')
                  : t('practice.hub.nav.disconnected')}
              </p>
              {marketConnected && marketStatusLabel ? (
                <p className={`mt-1 text-xs ${hintClass}`}>{marketStatusLabel}</p>
              ) : null}
            </div>
          ) : (
            <p className={`text-xs ${hintClass}`}>
              {t('practice.hub.marketDataComingSoon', { firm: firmLabel }, `${firmLabel} market data setup is coming soon.`)}
            </p>
          )}
        </PanelField>
      </div>

      {showDisconnectedBanner && (
        <div className={`mt-5 ${alertBannerClass(isDark, 'amber')}`}>
          <p className="text-sm leading-relaxed">{t('practice.notConnected')}</p>
          <button
            type="button"
            onClick={() => navigate(`${ROUTES.PRACTICE}?tab=settings&section=market`)}
            className={`${primaryButtonClass()} mt-3`}
          >
            {t('settings.marketDataTab')}
          </button>
        </div>
      )}

      {showSessionExpiredBanner && (
        <div className={`mt-5 ${alertBannerClass(isDark, 'amber')}`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm flex-1 leading-relaxed">
              {t('practice.sessionExpired')} {loadingMd ? t('practice.refreshingSession') : ''}{' '}
              {!loadingMd ? t('practice.goToPropFirmSettings') : ''}
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
                onClick={() => navigate(`${ROUTES.PRACTICE}?tab=settings&section=market`)}
                className={primaryButtonClass()}
              >
                {t('settings.marketDataTab')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (embedded) {
    return (
      <div className="pt-4">
        <p className={`text-sm mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {t('practice.hub.marketDataHint')}
        </p>
        {fields}
      </div>
    )
  }

  return (
    <PanelCard
      isDark={isDark}
      title={t('practice.hub.marketDataTitle')}
      description={t('practice.hub.marketDataHint')}
    >
      {fields}
    </PanelCard>
  )
}
