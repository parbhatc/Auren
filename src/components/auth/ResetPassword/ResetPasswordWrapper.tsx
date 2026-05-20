import { useForm } from 'react-hook-form'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTheme } from '../../../hooks/useTheme'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import { authAPI } from '../../../api/auth.api'
import { ResetPasswordFormData } from '../../../types'
import ResetPasswordRenderer from './ResetPasswordRenderer'

/**
 * Reset Password page wrapper component
 * Uses hooks and passes props to renderer component
 */
const ResetPasswordWrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [codeValid, setCodeValid] = useState(false)

  const code = searchParams.get('code')
  const email = searchParams.get('email')

  // Verify code when component mounts
  useEffect(() => {
    const verifyCode = async () => {
      if (!code || !email) {
        setError(t('auth.resetPassword.invalidLink'))
        setVerifying(false)
        return
      }

      setVerifying(true)
      setError('')

      try {
        const response = await authAPI.verifyResetCode({
          email: decodeURIComponent(email),
          code,
        })

        if (response.success) {
          setCodeValid(true)
        } else {
          setError(response.message || t('auth.resetPassword.invalidLink'))
          setCodeValid(false)
        }
      } catch (err: any) {
        const errorMessage = err?.response?.data?.message || err?.message || t('auth.resetPassword.invalidLink')
        setError(errorMessage)
        setCodeValid(false)
      } finally {
        setVerifying(false)
      }
    }

    verifyCode()
  }, [code, email])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    mode: 'onBlur',
  })

  const password = watch('password')

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!code || !email) {
      setError(t('auth.resetPassword.invalidLink'))
      return
    }

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await authAPI.resetPassword({
        email: decodeURIComponent(email),
        code,
        password: data.password,
      })

      if (response.success) {
        setSuccess(response.message || t('auth.resetPassword.submitButtonSuccess'))
        // Navigate to login after 2 seconds
        setTimeout(() => {
          navigate(ROUTES.LOGIN)
        }, 2000)
      } else {
        setError(response.message || t('auth.resetPassword.submitButtonLoading'))
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || t('auth.resetPassword.submitButtonLoading')
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ResetPasswordRenderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      error={error}
      success={success}
      loading={loading}
      verifying={verifying}
      codeValid={codeValid}
      code={code}
      email={email}
      register={register}
      handleSubmit={handleSubmit}
      errors={errors}
      password={password}
      onSubmit={onSubmit}
    />
  )
}

export default ResetPasswordWrapper

