import { useForm } from 'react-hook-form'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { authAPI } from '../../../api/auth.api'
import { handleApiError } from '../../../utils/errorHandler'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import { ForgotPasswordData } from '../../../types'
import Renderer from './Renderer'

const RESEND_COOLDOWN_SECONDS = 60

function resendCooldownKey(email: string): string {
  return `forgotPasswordResendUntil:${email.trim().toLowerCase()}`
}

function getStoredResendCooldownSeconds(email: string): number {
  if (!email.trim()) return 0
  const raw = localStorage.getItem(resendCooldownKey(email))
  if (!raw) return 0
  const until = Number(raw)
  if (!Number.isFinite(until)) return 0
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}

function storeResendCooldown(email: string, seconds = RESEND_COOLDOWN_SECONDS): void {
  if (!email.trim()) return
  localStorage.setItem(resendCooldownKey(email), String(Date.now() + seconds * 1000))
}

const Wrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [resending, setResending] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ForgotPasswordData>({
    mode: 'onBlur',
    defaultValues: { email: '', code: '' },
  })

  const email = watch('email')
  const code = watch('code')

  const syncResendCooldown = useCallback((address: string) => {
    setResendCooldownSeconds(getStoredResendCooldownSeconds(address))
  }, [])

  useEffect(() => {
    syncResendCooldown(email)
  }, [email, syncResendCooldown])

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldownSeconds(getStoredResendCooldownSeconds(email))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [email, resendCooldownSeconds])

  const sendResetCode = async (address: string) => {
    const response = await authAPI.forgotPassword({ email: address.trim() })
    if (response.success) {
      storeResendCooldown(address, RESEND_COOLDOWN_SECONDS)
      syncResendCooldown(address)
      setSuccess(response.message || t('auth.forgotPassword.submitButtonSuccess'))
      setResendMessage('')
      return true
    }
    setError(response.message || 'Failed to send reset code')
    return false
  }

  const onSendCode = async (data: ForgotPasswordData) => {
    if (!data.email.trim()) {
      setError(t('auth.forgotPassword.sendEmailRequired'))
      return
    }

    setError('')
    setSuccess('')
    setResendMessage('')
    setSending(true)

    try {
      await sendResetCode(data.email)
    } catch (err) {
      const message = handleApiError(err)
      setError(message)
      const match = message.match(/(\d+)\s+seconds?/i)
      if (match) {
        const seconds = Number(match[1])
        if (Number.isFinite(seconds) && seconds > 0) {
          storeResendCooldown(data.email, seconds)
          syncResendCooldown(data.email)
        }
      }
    } finally {
      setSending(false)
    }
  }

  const onResend = async () => {
    const address = email.trim()
    if (!address) {
      setError(t('auth.forgotPassword.sendEmailRequired'))
      return
    }

    if (getStoredResendCooldownSeconds(address) > 0) {
      syncResendCooldown(address)
      return
    }

    setError('')
    setSuccess('')
    setResendMessage('')
    setResending(true)

    try {
      const ok = await sendResetCode(address)
      if (ok) {
        setResendMessage(t('auth.forgotPassword.submitButtonSuccess'))
      }
    } catch (err) {
      const message = handleApiError(err)
      setError(message)
      const match = message.match(/(\d+)\s+seconds?/i)
      if (match) {
        const seconds = Number(match[1])
        if (Number.isFinite(seconds) && seconds > 0) {
          storeResendCooldown(address, seconds)
          syncResendCooldown(address)
        }
      }
    } finally {
      setResending(false)
    }
  }

  const onContinue = async () => {
    const address = email.trim()
    const resetCode = code.trim()

    if (!address) {
      setError(t('auth.forgotPassword.continueEmailRequired'))
      return
    }
    if (resetCode.length < 4) {
      setError(t('auth.forgotPassword.continueCodeRequired'))
      return
    }

    setError('')
    setSuccess('')
    setResendMessage('')
    setContinuing(true)

    try {
      const response = await authAPI.verifyResetCode({ email: address, code: resetCode })
      if (response.success) {
        navigate(
          `${ROUTES.RESET_PASSWORD}?email=${encodeURIComponent(address)}&code=${encodeURIComponent(resetCode)}`
        )
      } else {
        setError(response.message || t('auth.resetPassword.invalidLink'))
      }
    } catch (err) {
      setError(handleApiError(err))
    } finally {
      setContinuing(false)
    }
  }

  const onCodeChange = (value: string) => {
    setValue('code', value.replace(/\D/g, ''), { shouldValidate: true })
  }

  return (
    <Renderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      error={error}
      success={success}
      resendMessage={resendMessage}
      loading={sending || resending || continuing}
      sending={sending}
      resending={resending}
      continuing={continuing}
      resendCooldownSeconds={resendCooldownSeconds}
      register={register}
      handleSubmit={handleSubmit}
      errors={errors}
      onSendCode={onSendCode}
      onCodeChange={onCodeChange}
      onResend={onResend}
      onContinue={onContinue}
      code={code}
      email={email}
    />
  )
}

export default Wrapper
