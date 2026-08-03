import { useEffect, useState } from 'react'
import axios from 'axios'
import { tradeseaAPI } from '../../../api/tradesea.api'
import { t } from '../../../utils/translator'
import type { TradeseaConnectPanelProps } from '../../types/tradesea'
import { SettingsDivider, SettingsSection } from '../../../components/settings/SettingsFormPrimitives'
import BasePropFirm from '../../connect/BasePropFirm'
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
  const [connectionName, setConnectionName] = useState<string | null>(null)
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
      setConnectionName(null)
      return
    }
    tradeseaAPI
      .getConnectionStatus()
      .then((status) => {
        if (status.connected) {
          setConnectionName(status.name || status.email || email || null)
        } else {
          setConnectionName(null)
        }
      })
      .catch(() => setConnectionName(null))
  }, [propFirm?.token, email])

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
        firstName: result.firstName,
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

  const connectedAs = connectionName
    ? t('props.tradesea.connectedAs', { name: connectionName })
    : null

  return (
    <BasePropFirm isDark={isDark} connectedAs={connectedAs}>
      <SettingsSection isDark={isDark} nested title={t('props.tradesea.signInSection')}>
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
      </SettingsSection>
      <SettingsDivider isDark={isDark} />
      <TradeseaAdvancedTokens
        isDark={isDark}
        accessToken={manualAccess}
        refreshToken={manualRefresh}
        saving={savingManual}
        onAccessChange={setManualAccess}
        onRefreshChange={setManualRefresh}
        onSave={() => void handleSaveManual()}
      />
    </BasePropFirm>
  )
}
