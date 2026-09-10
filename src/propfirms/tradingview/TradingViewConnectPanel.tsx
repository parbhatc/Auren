import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
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
  const [sessionVisible, setSessionVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => setSessionId(propFirm?.sessionId || ''), [propFirm?.sessionId])

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
      <div className="relative">
        <input
          type={sessionVisible ? 'text' : 'password'}
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          placeholder={t('props.tradingview.sessionIdPlaceholder')}
          autoComplete="off"
          className={`${settingsInputClass(isDark)} pr-11`}
        />
        <button
          type="button"
          onClick={() => setSessionVisible((visible) => !visible)}
          aria-label={sessionVisible ? t('props.hidePassword') : t('props.showPassword')}
          className={`absolute inset-y-0 right-0 flex w-11 items-center justify-center transition-colors ${
            isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {sessionVisible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
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
