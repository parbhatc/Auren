import { useEffect } from 'react'
import { Wifi } from 'lucide-react'
import { PropsSettingsRendererProps } from '../../../types/props'
import { t } from '../../../utils/translator'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SettingsPageLayout from '../../layout/SettingsPageLayout'
import TradeseaConnectPanel from './TradeseaConnectPanel'
import HubSettingsSkeleton from '../../trading/Practice/hub/HubSettingsSkeleton'
import { SettingsPanel } from '../SettingsFormPrimitives'

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
  useEffect(() => {
    localStorage.setItem('activePropFirm', 'tradesea')
    window.dispatchEvent(new Event('activePropFirmChanged'))
  }, [])

  const tradeseaFirm = propFirms.find((f) => f.type === 'tradesea')

  if (loading) {
    return (
      <SettingsPageLayout
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        title={embedded ? t('settings.marketDataTab') : t('props.title')}
        subtitle={
          embedded ? t('practice.hub.settings.marketEmbeddedDesc') : t('practice.hub.settings.marketDesc')
        }
        icon={Wifi}
        embedded={embedded}
        onBack={onBack}
      >
        <HubSettingsSkeleton isDark rows={2} />
      </SettingsPageLayout>
    )
  }

  return (
    <SettingsPageLayout
      isDark={isDark}
      toggleTheme={toggleTheme}
      navigate={navigate}
      title={embedded ? t('settings.marketDataTab') : t('props.title')}
      subtitle={embedded ? t('practice.hub.settings.marketEmbeddedDesc') : t('practice.hub.settings.marketDesc')}
      icon={Wifi}
      embedded={embedded}
      onBack={onBack}
    >
      {error && <ErrorMessage message={error} isDark={isDark} />}
      {success && <SuccessMessage message={success} isDark={isDark} />}

      <SettingsPanel isDark={isDark}>
        <TradeseaConnectPanel
          hub={Boolean(embedded)}
          isDark={isDark}
          propFirm={tradeseaFirm}
          onRefresh={() => {
            onRefreshPropFirms?.()
            window.dispatchEvent(new CustomEvent('refreshPropFirms'))
          }}
          onSuccess={(msg) => onNotifySuccess?.(msg)}
          onError={(msg) => onNotifyError?.(msg)}
        />
        {tradeseaFirm?.token ? (
          <div className={`px-5 sm:px-6 pb-5 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => onDelete('tradesea')}
              className={`mt-4 text-sm font-medium transition-colors ${
                isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'
              }`}
            >
              {t('props.clear')}
            </button>
          </div>
        ) : null}
      </SettingsPanel>
    </SettingsPageLayout>
  )
}
