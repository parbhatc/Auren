import { useEffect, useState } from 'react'
import { ChevronDown, KeyRound, Mail, RefreshCw } from 'lucide-react'
import { tradeseaAPI } from '../../../api/tradesea.api'
import { propsAPI } from '../../../api/props.api'
import { PropFirm } from '../../../types/props'
import { t } from '../../../utils/translator'
import {
  fieldLabelClass,
  ghostButtonClass,
  primaryButtonClass,
  settingsInsetClass,
  settingsInputClass,
} from '../../../styles/aurenTheme'
import {
  SettingsDivider,
  SettingsSaveButton,
  SettingsSection,
  SettingsStatusPill,
} from '../SettingsFormPrimitives'

interface TradeseaConnectPanelProps {
  isDark: boolean
  propFirm?: PropFirm
  onRefresh: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
  hub?: boolean
}

export default function TradeseaConnectPanel({
  isDark,
  propFirm,
  onRefresh,
  onSuccess,
  onError,
  hub = false,
}: TradeseaConnectPanelProps) {
  const [email, setEmail] = useState(propFirm?.credentials?.email || '')
  const [deviceId, setDeviceId] = useState(propFirm?.credentials?.deviceId || '')
  const [otpStep, setOtpStep] = useState(false)
  const [otp, setOtp] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<{
    connected: boolean
    email?: string | null
    name?: string | null
  } | null>(null)
  const [manualAccess, setManualAccess] = useState('')
  const [manualRefresh, setManualRefresh] = useState(propFirm?.sessionId || '')
  const [savingManual, setSavingManual] = useState(false)

  useEffect(() => {
    setEmail(propFirm?.credentials?.email || '')
    setDeviceId(propFirm?.credentials?.deviceId || '')
    setManualRefresh(propFirm?.sessionId || '')
  }, [propFirm])

  useEffect(() => {
    if (!propFirm?.token) {
      setConnectionInfo(null)
      return
    }
    tradeseaAPI
      .getConnectionStatus()
      .then((status) => {
        if (status.connected) {
          setConnectionInfo({
            connected: true,
            email: status.email,
            name: status.name,
          })
        } else {
          setConnectionInfo({ connected: false })
        }
      })
      .catch(() => setConnectionInfo({ connected: false }))
  }, [propFirm?.token])

  const inputClass = settingsInputClass(isDark)
  const primaryBtn = `${primaryButtonClass()} w-full sm:w-auto min-w-[8rem]`
  const secondaryBtn = `${ghostButtonClass(isDark)} inline-flex items-center justify-center gap-2`
  const inset = settingsInsetClass(isDark)

  const saveTokens = async (
    accessToken: string,
    refreshToken: string,
    creds: { email: string; deviceId?: string; firstName?: string | null }
  ) => {
    const existing = propFirm
    if (!existing) {
      await propsAPI.savePropFirm({
        type: 'tradesea',
        credentials: creds,
      })
    } else {
      await propsAPI.updatePropFirm('tradesea', {
        credentials: { ...existing.credentials, ...creds },
      })
    }
    await propsAPI.updateToken('tradesea', accessToken, refreshToken || null, null)
    onRefresh()
  }

  const handleSendOtp = async (resend = false) => {
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      onError(t('props.tradesea.invalidEmail'))
      return
    }
    setSendingOtp(true)
    onError('')
    try {
      const result = await tradeseaAPI.sendOtp(trimmed, resend, deviceId || undefined)
      if (!result.ok && !result.success) {
        throw new Error(result.error || t('props.tradesea.otpSendFailed'))
      }
      if (result.deviceId) setDeviceId(result.deviceId)
      setOtpStep(true)
      onSuccess(resend ? t('props.tradesea.otpResent') : t('props.tradesea.otpSent'))
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : t('props.tradesea.otpSendFailed'))
    } finally {
      setSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    const code = otp.replace(/\D/g, '').slice(0, 6)
    if (code.length !== 6) {
      onError(t('props.tradesea.invalidOtp'))
      return
    }
    if (!deviceId) {
      onError(t('props.tradesea.missingDeviceId'))
      return
    }
    setVerifying(true)
    onError('')
    try {
      const result = await tradeseaAPI.verifyOtp(email.trim().toLowerCase(), code, deviceId)
      if (!result.ok || !result.accessToken) {
        throw new Error(result.error || t('props.tradesea.verifyFailed'))
      }
      await saveTokens(result.accessToken, result.refreshToken || '', {
        email: result.email || email.trim().toLowerCase(),
        deviceId,
        firstName: result.firstName,
      })
      setOtpStep(false)
      setOtp('')
      onSuccess(t('props.tradesea.connected'))
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : t('props.tradesea.verifyFailed'))
    } finally {
      setVerifying(false)
    }
  }

  const handleSaveManual = async () => {
    const access = manualAccess.trim()
    const refresh = manualRefresh.trim()
    if (!access) {
      onError(t('props.tradesea.accessTokenRequired'))
      return
    }
    setSavingManual(true)
    onError('')
    try {
      await saveTokens(access, refresh, {
        email: email.trim().toLowerCase() || propFirm?.credentials?.email || '',
        deviceId: deviceId || propFirm?.credentials?.deviceId,
      })
      setManualAccess('')
      onSuccess(t('props.tradesea.tokensSaved'))
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : t('props.connectionFailed'))
    } finally {
      setSavingManual(false)
    }
  }

  const connectedBanner = connectionInfo?.connected ? (
    <SettingsStatusPill isDark={isDark} tone="success">
      {t('props.tradesea.connectedAs', {
        name: connectionInfo.name || connectionInfo.email || email,
      })}
    </SettingsStatusPill>
  ) : null

  const signInFields = (
    <div className="space-y-3">
      {!otpStep ? (
        <>
          <div>
            <label className={fieldLabelClass(isDark)} htmlFor="tradesea-email">
              {t('props.tradesea.emailLabel')}
            </label>
            <div className="relative mt-1.5">
              <Mail
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
              <input
                id="tradesea-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('props.tradesea.emailPlaceholder')}
                className={`${inputClass} pl-10`}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={sendingOtp}
            onClick={() => handleSendOtp(false)}
            className={`${primaryBtn} ${sendingOtp ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {sendingOtp ? t('props.tradesea.sendingOtp') : t('props.tradesea.sendOtp')}
          </button>
        </>
      ) : (
        <>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('props.tradesea.otpSentTo', { email })}
          </p>
          <div>
            <label className={fieldLabelClass(isDark)} htmlFor="tradesea-otp">
              {t('props.tradesea.otpLabel')}
            </label>
            <input
              id="tradesea-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className={`${inputClass} mt-1.5 tracking-[0.3em] text-center font-mono text-lg`}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={verifying}
              onClick={handleVerifyOtp}
              className={`${primaryBtn} ${verifying ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {verifying ? t('props.tradesea.verifying') : t('props.tradesea.verifyOtp')}
            </button>
            <button
              type="button"
              disabled={sendingOtp}
              onClick={() => handleSendOtp(true)}
              className={`${secondaryBtn} ${sendingOtp ? 'opacity-50' : ''}`}
            >
              <RefreshCw className="w-4 h-4" />
              {t('props.tradesea.resendOtp')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setOtpStep(false)
              setOtp('')
            }}
            className={`text-xs font-medium ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t('props.tradesea.changeEmail')}
          </button>
        </>
      )}
    </div>
  )

  const manualFields = (
    <div className="space-y-3">
      <input
        type="text"
        value={manualAccess}
        onChange={(e) => setManualAccess(e.target.value)}
        placeholder={t('props.tradesea.accessTokenPlaceholder')}
        className={inputClass}
      />
      <input
        type="text"
        value={manualRefresh}
        onChange={(e) => setManualRefresh(e.target.value)}
        placeholder={t('props.tradesea.refreshTokenPlaceholder')}
        className={inputClass}
      />
      <SettingsSaveButton loading={savingManual} disabled={savingManual}>
        {savingManual ? t('props.tradesea.savingTokens') : t('props.tradesea.saveTokens')}
      </SettingsSaveButton>
    </div>
  )

  if (!hub) {
    return (
      <div className="space-y-4">
        {connectedBanner}
        <div className={inset}>
          <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {t('props.tradesea.signInSection')}
          </p>
          <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
            {t('props.tradesea.otpDescription')}
          </p>
          {signInFields}
        </div>
        <div className={inset}>
          <p
            className={`text-sm font-semibold mb-1 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
          >
            <KeyRound className="w-4 h-4" />
            {t('props.tradesea.advancedSection')}
          </p>
          <p className={`text-xs mb-3 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
            {t('props.tradesea.manualDescription')}
          </p>
          {manualFields}
        </div>
      </div>
    )
  }

  return (
    <>
      {connectedBanner ? <div className="px-5 sm:px-6 pt-5 pb-0">{connectedBanner}</div> : null}

      <SettingsSection
        isDark={isDark}
        title={t('props.tradesea.signInSection')}
        hint={t('props.tradesea.otpDescription')}
      >
        {signInFields}
      </SettingsSection>

      <SettingsDivider isDark={isDark} />

      <details className={`group px-5 sm:px-6 py-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
        <summary
          className={`flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold ${
            isDark ? 'text-slate-200' : 'text-slate-800'
          }`}
        >
          <span>{t('props.tradesea.advancedSection')}</span>
          <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180 text-slate-500" />
        </summary>
        <p className={`text-xs mt-3 mb-3 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          {t('props.tradesea.manualDescription')}
        </p>
        {manualFields}
      </details>
    </>
  )
}

