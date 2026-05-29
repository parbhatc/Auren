import { useCallback, useEffect, useState } from 'react'
import { Wifi } from 'lucide-react'
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
} from '../../../propfirms'
import { t } from '../../../utils/translator'
import { fieldLabelClass, selectInputClass } from '../../../styles/aurenTheme'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SettingsPageLayout from '../../layout/SettingsPageLayout'
import HubSettingsSkeleton from '../../trading/Practice/hub/HubSettingsSkeleton'
import { SettingsPanel, SettingsSection } from '../SettingsFormPrimitives'

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
    title: embedded ? t('settings.marketDataTab') : t('props.title'),
    subtitle: embedded ? t('practice.hub.settings.marketEmbeddedDesc') : t('practice.hub.settings.marketDesc'),
    icon: Wifi,
    embedded,
    onBack,
  }

  if (loading) {
    return (
      <SettingsPageLayout {...layoutProps}>
        <HubSettingsSkeleton isDark rows={2} />
      </SettingsPageLayout>
    )
  }

  return (
    <SettingsPageLayout {...layoutProps}>
      {error && <ErrorMessage message={error} isDark={isDark} />}
      {success && <SuccessMessage message={success} isDark={isDark} />}

      <SettingsPanel isDark={isDark}>
        <SettingsSection isDark={isDark} hint={providerHint}>
          <div className="mb-5">
            <label className={fieldLabelClass(isDark)} htmlFor="market-data-provider">
              {t('practice.propFirmLabel')}
            </label>
            <select
              id="market-data-provider"
              value={selectedFirm}
              onChange={(e) => void handleFirmChange(e.target.value)}
              className={selectInputClass(isDark)}
            >
              {PRACTICE_PROP_FIRMS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.displayName}
                </option>
              ))}
            </select>
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
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{providerHint}</p>
          )}

          {canClear ? (
            <div className={`mt-5 pt-4 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => onDelete(selectedFirm)}
                className={`text-sm font-medium transition-colors ${
                  isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'
                }`}
              >
                {t('props.clear')}
              </button>
            </div>
          ) : null}
        </SettingsSection>
      </SettingsPanel>
    </SettingsPageLayout>
  )
}
