import { CloudOff, Layers, Radio, RefreshCw } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PRACTICE_PROP_FIRMS,
  getPracticePropFirmConfig,
  practiceFirmShowsOfflineModeSection,
  practiceFirmSupportsOfflineBracketWatcher,
} from '../../../../constants/practice'
import { ROUTES } from '../../../../constants/routes'
import {
  firmUsesBrokerAccounts,
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
  offlineModePositions,
  brokerAccounts,
  brokerSessionExpired,
  loadingMd,
  onPropFirmChange,
  onMarketAccountChange,
  onOfflineModeChange,
  onRefreshAccounts,
  onRefreshSession,
}: {
  isDark: boolean
  propFirmId: string
  marketAccountId: string
  marketConnected: boolean
  marketStatusLabel: string
  offlineModePositions: boolean
  brokerAccounts: BrokerAccountOption[]
  brokerSessionExpired: boolean
  loadingMd: boolean
  onPropFirmChange: (id: string) => void
  onMarketAccountChange: (accountId: string) => void
  onOfflineModeChange: (enabled: boolean) => void
  onRefreshAccounts: () => void
  onRefreshSession: () => void
}) {
  const navigate = useNavigate()
  const selectClass = selectInputClass(isDark)
  const autoRefreshAttempted = useRef(false)
  const firm = getPracticePropFirmConfig(propFirmId)
  const showOfflineSection = practiceFirmShowsOfflineModeSection(propFirmId)
  const supportsOfflineWatcher = practiceFirmSupportsOfflineBracketWatcher(propFirmId)
  const usesBrokerAccounts = firmUsesBrokerAccounts(propFirmId)
  const usesCredentialLogin = firmUsesCredentialLogin(propFirmId)
  const firmLabel = firm.displayName
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

  const cardClass = supportsOfflineWatcher
    ? offlineModePositions
      ? isDark
        ? 'border-violet-500/45 bg-gradient-to-br from-violet-950/40 to-slate-900/50 shadow-[inset_0_1px_0_0_rgba(167,139,250,0.12)]'
        : 'border-violet-300 bg-gradient-to-br from-violet-50 to-white shadow-sm'
      : isDark
        ? 'border-slate-700/70 bg-slate-900/30'
        : 'border-slate-200 bg-slate-50/90'
    : isDark
      ? 'border-slate-700/60 bg-slate-900/25'
      : 'border-slate-200 bg-slate-50/80'

  const iconWrapClass = supportsOfflineWatcher
    ? offlineModePositions
      ? isDark
        ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30'
        : 'bg-violet-100 text-violet-700 ring-1 ring-violet-200'
      : isDark
        ? 'bg-slate-800 text-slate-500 ring-1 ring-slate-600/80'
        : 'bg-slate-200/80 text-slate-500 ring-1 ring-slate-300'
    : isDark
      ? 'bg-slate-800/80 text-slate-400 ring-1 ring-slate-600/70'
      : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'

  const badgeClass = supportsOfflineWatcher
    ? offlineModePositions
      ? isDark
        ? 'bg-violet-500/25 text-violet-200 border-violet-500/35'
        : 'bg-violet-100 text-violet-800 border-violet-200'
      : isDark
        ? 'bg-slate-800 text-slate-400 border-slate-600'
        : 'bg-white text-slate-500 border-slate-300'
    : isDark
      ? 'bg-slate-800 text-slate-400 border-slate-600'
      : 'bg-white text-slate-500 border-slate-300'

  const titleClass = supportsOfflineWatcher
    ? offlineModePositions
      ? isDark
        ? 'text-slate-100'
        : 'text-slate-900'
      : isDark
        ? 'text-slate-400'
        : 'text-slate-600'
    : isDark
      ? 'text-slate-300'
      : 'text-slate-800'

  const hintClass = isDark ? 'text-slate-400' : 'text-slate-600'

  const trackClass = offlineModePositions
    ? 'bg-violet-600'
    : isDark
      ? 'bg-slate-700'
      : 'bg-slate-300'

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
          {usesBrokerAccounts ? (
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
          ) : usesCredentialLogin ? (
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

      {showOfflineSection && (
        <div className={`mt-5 rounded-xl border p-4 transition-colors duration-200 ${cardClass}`}>
          <div className="flex items-start gap-3 sm:gap-4">
            <div
              className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${iconWrapClass}`}
              aria-hidden
            >
              {supportsOfflineWatcher ? (
                offlineModePositions ? (
                  <Radio className="h-5 w-5" strokeWidth={2.25} />
                ) : (
                  <CloudOff className="h-5 w-5" strokeWidth={2.25} />
                )
              ) : (
                <Layers className="h-5 w-5" strokeWidth={2.25} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm font-semibold transition-colors ${titleClass}`}>
                  {supportsOfflineWatcher
                    ? t('practice.offlineModeTitle')
                    : t('practice.offlineModeConcurrentTitle')}
                </span>
                {supportsOfflineWatcher && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
                  >
                    {offlineModePositions
                      ? t('practice.offlineModeOnBadge')
                      : t('practice.offlineModeOffBadge')}
                  </span>
                )}
                {firm.marketDataSlotPolicy === 'exclusive' && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      isDark
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200/90'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {t('practice.offlineModeExclusiveTitle')}
                  </span>
                )}
              </div>
              <p className={`mt-2 text-xs leading-relaxed transition-colors ${hintClass}`}>
                {supportsOfflineWatcher
                  ? offlineModePositions
                    ? t('practice.offlineModeOnHintExclusive', { firm: firmLabel })
                    : t('practice.offlineModeOffHintExclusive', { firm: firmLabel })
                  : t('practice.offlineModeConcurrentHint', { firm: firmLabel })}
              </p>
            </div>

            {supportsOfflineWatcher && (
              <button
                type="button"
                role="switch"
                aria-checked={offlineModePositions}
                aria-label={t('practice.offlineModeTitle')}
                onClick={() => onOfflineModeChange(!offlineModePositions)}
                className={`relative mt-0.5 shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 ${
                  isDark ? 'focus-visible:ring-offset-slate-900' : 'focus-visible:ring-offset-white'
                } ${trackClass}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                    offlineModePositions ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            )}
          </div>
        </div>
      )}

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
    </PanelCard>
  )
}
