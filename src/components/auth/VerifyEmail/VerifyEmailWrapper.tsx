import { useForm } from 'react-hook-form'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { useAuth } from '../../../hooks/useAuth'
import { authAPI } from '../../../api/auth.api'
import { handleApiError } from '../../../utils/errorHandler'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import { VerifyEmailData } from '../../../types'
import VerifyEmailRenderer from './VerifyEmailRenderer'

const RESEND_COOLDOWN_SECONDS = 60

function resendCooldownKey(email: string): string {
  return `verifyEmailResendUntil:${email.trim().toLowerCase()}`
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
  localStorage.setItem(
    resendCooldownKey(email),
    String(Date.now() + seconds * 1000)
  )
}

const VerifyEmailWrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const { error, success, loading, verifyEmail, clearError, clearSuccess } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      navigate(ROUTES.HOME, { replace: true })
    }
  }, [navigate])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VerifyEmailData>({
    mode: 'onBlur',
    defaultValues: { email: '', code: '' },
  })

  const code = watch('code')
  const email = watch('email')

  const syncResendCooldown = useCallback((address: string) => {
    setResendCooldownSeconds(getStoredResendCooldownSeconds(address))
  }, [])

  useEffect(() => {
    syncResendCooldown(email)
  }, [email, syncResendCooldown])

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return
    const timer = window.setInterval(() => {
      const remaining = getStoredResendCooldownSeconds(email)
      setResendCooldownSeconds(remaining)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [email, resendCooldownSeconds])

  const handleVerify = async (address: string, verificationCode: string) => {
    setVerifying(true)
    clearError()
    clearSuccess()
    setResendError('')
    await verifyEmail(address.trim(), verificationCode.trim())
    setVerifying(false)
  }

  useEffect(() => {
    const urlCode = searchParams.get('code')
    const urlEmail = searchParams.get('email')

    if (urlEmail) {
      setValue('email', decodeURIComponent(urlEmail))
    }
    if (urlCode) {
      setValue('code', urlCode.replace(/\D/g, ''))
    }

    if (urlCode && urlEmail) {
      void handleVerify(decodeURIComponent(urlEmail), urlCode)
      setSearchParams({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams, setValue])

  const onSubmit = async (data: VerifyEmailData) => {
    if (data.code.length < 4) {
      return
    }
    await handleVerify(data.email, data.code)
  }

  const onCodeChange = (value: string) => {
    setValue('code', value.replace(/\D/g, ''), { shouldValidate: true })
  }

  const onResend = async () => {
    const address = email.trim()
    if (!address) {
      setResendError(t('auth.verifyEmail.resendEmailRequired'))
      return
    }

    if (getStoredResendCooldownSeconds(address) > 0) {
      syncResendCooldown(address)
      return
    }

    setResending(true)
    setResendError('')
    setResendMessage('')
    clearError()
    clearSuccess()

    try {
      const response = await authAPI.resendVerificationEmail({ email: address })
      if (response.success) {
        storeResendCooldown(address, RESEND_COOLDOWN_SECONDS)
        syncResendCooldown(address)
        setResendMessage(response.message || t('auth.verifyEmail.resendSuccess'))
      } else {
        setResendError(response.message || 'Failed to resend verification code')
      }
    } catch (err) {
      const message = handleApiError(err)
      setResendError(message)
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

  const displayError = resendError || error

  return (
    <VerifyEmailRenderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      error={displayError}
      success={success}
      resendMessage={resendMessage}
      loading={loading}
      verifying={verifying}
      resending={resending}
      resendCooldownSeconds={resendCooldownSeconds}
      register={register}
      handleSubmit={handleSubmit}
      errors={errors}
      onSubmit={onSubmit}
      onCodeChange={onCodeChange}
      onResend={onResend}
      code={code}
      email={email}
    />
  )
}

export default VerifyEmailWrapper
