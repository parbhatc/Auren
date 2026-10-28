import { useEffect, useState } from 'react'
import axios from 'axios'
import { tradeseaAPI } from '../../../api/tradesea.api'
import { t } from '../../../utils/translator'
import type { TradeseaConnectPanelProps } from '../../types/tradesea'
import BaseEmailOTPFirm from '../../connect/BaseEmailOTPFirm'
import { savePropFirmCredentials, savePropFirmToken } from '../../connect/utils/savePropFirmCredentials'
import TradeseaAdvancedTokens from './TradeseaAdvancedTokens'

function connectionErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const upstream = error.response?.data as { error?: unknown; message?: unknown } | undefined
    const message = upstream?.error ?? upstream?.message
    if (typeof message === 'string' && message.trim()) return message
  }
  return error instanceof Error && error.message ? error.message : fallback
}

export default function TradeseaConnectPanel({
  isDark,
  propFirm,
  onRefresh,
  onSuccess,
  onError,
}: TradeseaConnectPanelProps) {
  const [email, setEmail] = useState(propFirm?.credentials?.email || '')
  const [deviceId, setDeviceId] = useState(propFirm?.credentials?.deviceId || '')
  const [otpStep, setOtpStep] = useState(false)
  const [otp, setOtp] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [connection, setConnection] = useState<{ connected: boolean; name: string | null }>({
    connected: false,
    name: null,
  })
  const [manualAccess, setManualAccess] = useState('')
  const [manualRefresh, setManualRefresh] = useState(propFirm?.sessionId || '')
  const [savingManual, setSavingManual] = useState(false)
  const [method, setMethod] = useState<'manual' | 'email'>('email')

  useEffect(() => {
    setEmail(propFirm?.credentials?.email || '')
    setDeviceId(propFirm?.credentials?.deviceId || '')
    setManualRefresh(propFirm?.sessionId || '')
  }, [propFirm])

  useEffect(() => {
    let active = true
    setConnection({ connected: false, name: null })
    if (!propFirm?.token) {
      return () => { active = false }
    }
    void tradeseaAPI.getConnectionStatus()
      .then((status) => {
        if (!active) return
        setConnection({
          connected: Boolean(status.connected),
          name: status.connected
            ? status.name || status.email || propFirm.credentials?.email || null
            : null,
        })
      })
      .catch(() => { if (active) setConnection({ connected: false, name: null }) })
    return () => { active = false }
  }, [propFirm?.token, propFirm?.sessionId, propFirm?.credentials?.email])

  const persistTokens = async (
    accessToken: string,
    refreshToken: string,
    creds: { email: string; deviceId?: string; firstName?: string | null }
  ) => {
    await savePropFirmCredentials('tradesea', propFirm, creds)
    await savePropFirmToken('tradesea', accessToken, refreshToken || null)
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
      onError(connectionErrorMessage(err, t('props.tradesea.otpSendFailed')))
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
      await persistTokens(result.accessToken, result.refreshToken || '', {
        email: result.email || email.trim().toLowerCase(),
        deviceId,
        ...(result.firstName != null ? { firstName: result.firstName } : {}),
      })
      setOtpStep(false)
      setOtp('')
      onSuccess(t('props.tradesea.connected'))
    } catch (err: unknown) {
      onError(connectionErrorMessage(err, t('props.tradesea.verifyFailed')))
    } finally {
      setVerifying(false)
    }
  }

  const handleSaveManual = async () => {
    const access = manualAccess.trim()
    if (!access) {
      onError(t('props.tradesea.accessTokenRequired'))
      return
    }
    setSavingManual(true)
    onError('')
    try {
      await persistTokens(access, manualRefresh.trim(), {
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

  const connectedAs = connection.connected
    ? connection.name
      ? t('props.tradesea.connectedAs', { name: connection.name })
      : 'Connected'
    : null

  const savingConnection = savingManual || sendingOtp || verifying

  return (
      <section
        className="min-w-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-5 sm:p-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:gap-8"
        aria-labelledby="tradesea-connect-heading"
      >
        <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="tradesea-connect-heading"
            className="text-lg font-semibold tracking-tight text-[var(--app-text)]"
          >
            Connect Tradesea
          </h3>
          <span className={`inline-flex items-center gap-1.5 text-[10px] ${
            connectedAs ? isDark ? 'text-emerald-400' : 'text-emerald-700' : 'text-[var(--app-muted)]'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              connectedAs ? 'bg-emerald-500' : 'bg-[var(--app-muted)]'
            }`} aria-hidden />
            {connectedAs || (propFirm?.token ? 'Session saved' : 'Not connected')}
          </span>
        </div>
        <p className="mb-5 mt-2 text-xs leading-5 text-[var(--app-muted)]">
          Sign in with your Tradesea email to connect Auren.
        </p>
        </div>
        <div className="min-w-0">
        <div
          role="group"
          aria-label="Tradesea connection method"
          className="mb-5 flex rounded-lg bg-[var(--app-inset)] p-1"
        >
          {(['email', 'manual'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={method === item}
              disabled={savingConnection}
              onClick={() => setMethod(item)}
              className={`min-h-9 flex-1 rounded-md px-2 text-xs font-semibold ${
                method === item
                  ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                  : 'text-[var(--app-muted)]'
              }`}
            >
              {item === 'manual' ? 'Advanced' : 'Email sign-in'}
            </button>
          ))}
        </div>
        {method === 'email' ? (
          <BaseEmailOTPFirm
            isDark={isDark}
            idPrefix="tradesea"
            email={email}
            otp={otp}
            otpStep={otpStep}
            sendingOtp={sendingOtp}
            verifying={verifying}
            onEmailChange={setEmail}
            onOtpChange={setOtp}
            onSendOtp={() => void handleSendOtp(false)}
            onVerifyOtp={() => void handleVerifyOtp()}
            onResendOtp={() => void handleSendOtp(true)}
            onChangeEmail={() => {
              setOtpStep(false)
              setOtp('')
            }}
          />
        ) : (
          <TradeseaAdvancedTokens
            isDark={isDark}
            accessToken={manualAccess}
            refreshToken={manualRefresh}
            saving={savingManual}
            onAccessChange={setManualAccess}
            onRefreshChange={setManualRefresh}
            onSave={() => void handleSaveManual()}
          />
        )}
        </div>
      </section>
  )
}
