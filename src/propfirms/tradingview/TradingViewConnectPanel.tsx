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
  const [sessionId, setSessionId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setSessionId(''), [propFirm?.tokenConfigured])

  const saveSessionId = async () => {
    const value = sessionId.trim()
    if (!value) {
      onError(t('props.tradingview.sessionIdRequired'))
      return
    }
    setSaving(true)
    onError('')
    try {
      if (!propFirm) {
        await propsAPI.savePropFirm({ type: 'tradingview', credentials: {} })
      }
      await propsAPI.updateTradingViewSession(value)
      setSessionId('')
      onRefresh()
      onSuccess(t('props.tradingview.sessionIdSaved'))
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
        ? t('props.tradingview.personalSessionActive')
        : t('props.tradingview.serverSessionActive')}
    >
      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {t('props.tradingview.sessionIdDescription')}
      </p>
      <input
        type="password"
        value={sessionId}
        onChange={(event) => setSessionId(event.target.value)}
        placeholder={t('props.tradingview.sessionIdPlaceholder')}
        autoComplete="off"
        className={settingsInputClass(isDark)}
      />
      <button
        type="button"
        disabled={saving}
        onClick={() => void saveSessionId()}
        className={`${settingsSaveButtonClass()} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {saving ? t('common.saving') : t('props.tradingview.saveSessionId')}
      </button>
    </BasePropFirm>
  )
}
