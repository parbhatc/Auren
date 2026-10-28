import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Cable } from 'lucide-react'
import { PropsSettingsRendererProps } from '../../../types/props'
import {
  PRACTICE_PROP_FIRMS,
  applyActiveFirmToMarketDataSettings,
  getPracticeMarketDataSettings,
  normalizePracticePropFirmId,
  savePracticeMarketDataSettings,
  type PracticePropFirmId,
} from '../../../constants/practice'
import {
  canClearPropFirmSettings,
  getPropFirmSettingsDescription,
  getPropFirmSettingsPanel,
} from '../../../propfirms/connect/settingsPanels'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SettingsPageLayout from '../../layout/SettingsPageLayout'
import HubSettingsSkeleton from '../../trading/Practice/hub/HubSettingsSkeleton'
import PlatformLogo from '../../common/PlatformLogo'

export default function Renderer({
  isDark,
  toggleTheme,
  navigate,
  propFirms,
  loading,
  error,
  success,
  onDelete,
  onNotifySuccess,
  onNotifyError,
  onRefreshPropFirms,
  embedded,
  onBack,
}: PropsSettingsRendererProps) {
  const [selectedFirm, setSelectedFirm] = useState<PracticePropFirmId>(() =>
    normalizePracticePropFirmId(getPracticeMarketDataSettings().propFirmId)
  )

  useEffect(() => {
    setSelectedFirm(normalizePracticePropFirmId(getPracticeMarketDataSettings().propFirmId))
  }, [propFirms])

  const propFirm = propFirms.find((f) => f.type === selectedFirm)
  const panel = getPropFirmSettingsPanel(selectedFirm)
  const ConnectPanel = panel?.ConnectPanel

  const refresh = useCallback(() => {
    onRefreshPropFirms?.()
    window.dispatchEvent(new CustomEvent('refreshPropFirms'))
  }, [onRefreshPropFirms])

  const handleFirmChange = async (nextId: string) => {
    const firmId = normalizePracticePropFirmId(nextId)
    if (firmId === selectedFirm) return
    setSelectedFirm(firmId)
    localStorage.setItem('activePropFirm', firmId)
    window.dispatchEvent(new Event('activePropFirmChanged'))

    const md = applyActiveFirmToMarketDataSettings(getPracticeMarketDataSettings(), firmId)
    try {
      await savePracticeMarketDataSettings(md)
    } catch {
      /* local cache still updated via save helper */
    }
  }

  const providerHint = getPropFirmSettingsDescription(selectedFirm)
  const canClear = canClearPropFirmSettings(selectedFirm, propFirm)

  const layoutProps = {
    isDark,
    toggleTheme,
    navigate,
    title: 'Platform connections',
    subtitle: 'Select Tradesea or TradingView to manage your connection.',
    icon: Cable,
    embedded,
    onBack,
  }

  if (loading) {
    return (
      <SettingsPageLayout {...layoutProps}>
        <HubSettingsSkeleton isDark={isDark} rows={2} />
      </SettingsPageLayout>
    )
  }

  return (
    <SettingsPageLayout {...layoutProps}>
      {error && <ErrorMessage message={error} isDark={isDark} />}
      {success && <SuccessMessage message={success} isDark={isDark} />}

      <div className="mb-6 grid gap-3 sm:grid-cols-2" role="group" aria-label="Platform">
        {PRACTICE_PROP_FIRMS.map((firm) => {
          const selected = selectedFirm === firm.id
          return (
            <button
              key={firm.id}
              type="button"
              aria-pressed={selected}
              aria-label={firm.displayName}
              onClick={() => void handleFirmChange(firm.id)}
              className={`flex min-w-0 items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                  : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:border-[var(--app-accent)]'
              }`}
            >
              <PlatformLogo
                brand={firm.id === 'tradesea' ? 'tradesea' : 'tradingview'}
                isDark={isDark}
                className="h-11 w-32"
              />
              <span className="min-w-0 text-[11px] leading-5 text-[var(--app-muted)]">
                {firm.id === 'tradesea' ? 'Trading & market data' : 'Market data'}
              </span>
              {selected ? (
                <ArrowRight
                  className="ml-auto h-4 w-4 shrink-0 text-[var(--app-accent)]"
                  aria-hidden
                />
              ) : null}
            </button>
          )
        })}
      </div>

          {ConnectPanel ? (
            <ConnectPanel
              isDark={isDark}
              propFirm={propFirm}
              onRefresh={refresh}
              onSuccess={(msg) => onNotifySuccess?.(msg)}
              onError={(msg) => onNotifyError?.(msg)}
            />
          ) : (
            <p className="text-sm text-[var(--app-muted)]">{providerHint}</p>
          )}

          {canClear ? (
            <div className="mt-6 border-t border-[var(--app-border)] pt-4">
              <button
                type="button"
                onClick={() => onDelete(selectedFirm)}
                className={`text-sm font-medium transition-colors ${
                  isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'
                }`}
              >
                Disconnect {selectedFirm === 'tradesea' ? 'Tradesea' : 'TradingView'}
              </button>
            </div>
          ) : null}
    </SettingsPageLayout>
  )
}
