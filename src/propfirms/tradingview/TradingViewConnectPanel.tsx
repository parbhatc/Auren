import { useEffect, useState } from 'react'
import { propsAPI } from '../../api/props.api'
import { settingsInputClass, settingsSaveButtonClass } from '../../styles/aurenTheme'
import { t } from '../../utils/translator'
import type { PropFirmSettingsPanelProps } from '../connect/settingsPanels'
import BasePropFirm from '../connect/BasePropFirm'

export default function TradingViewConnectPanel({
  isDark,
  propFirm,
  onRefresh,
  onSuccess,
  onError,
}: PropFirmSettingsPanelProps) {
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setToken(''), [propFirm?.tokenConfigured])

  const saveToken = async () => {
    const value = token.trim()
    if (!value) {
      onError(t('props.tradingview.tokenRequired'))
      return
    }
    setSaving(true)
    onError('')
    try {
      if (!propFirm) {
        await propsAPI.savePropFirm({ type: 'tradingview', credentials: {} })
      }
      await propsAPI.updateToken('tradingview', value)
      setToken('')
      onRefresh()
      onSuccess(t('props.tradingview.tokenSaved'))
    } catch (error) {
      onError(error instanceof Error ? error.message : t('props.connectionFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BasePropFirm
      isDark={isDark}
      connectedAs={propFirm?.tokenConfigured
        ? t('props.tradingview.personalTokenActive')
        : t('props.tradingview.serverTokenActive')}
    >
      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {t('props.tradingview.tokenDescription')}
      </p>
      <input
        type="password"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder={t('props.tradingview.tokenPlaceholder')}
        autoComplete="off"
        className={settingsInputClass(isDark)}
      />
      <button
        type="button"
        disabled={saving}
        onClick={() => void saveToken()}
        className={`${settingsSaveButtonClass()} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {saving ? t('props.tradingview.savingToken') : t('props.tradingview.saveToken')}
      </button>
    </BasePropFirm>
  )
}
