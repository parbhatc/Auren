import { useForm } from 'react-hook-form'
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { useAuth } from '../../../hooks/useAuth'
import { ROUTES } from '../../../constants/routes'
import { RegisterData } from '../../../types'
import RegisterRenderer from './RegisterRenderer'

/**
 * Register page wrapper component
 * Uses hooks and passes props to renderer component
 */
const RegisterWrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const { error, success, loading, register: registerUser, verifyEmail, clearError, clearSuccess } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [registeredEmail, setRegisteredEmail] = useState<string>('')
  const [showVerification, setShowVerification] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      navigate(ROUTES.HOME, { replace: true })
    }
  }, [navigate])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterData>({
    mode: 'onBlur',
  })

  const password = watch('password')

  const handleVerifyEmail = async (email: string, code: string) => {
    setVerifying(true)
    clearError()
    clearSuccess()
    await verifyEmail(email, code)
    setVerifying(false)
  }

  // Check URL params for email verification (from email link)
  useEffect(() => {
    const code = searchParams.get('code')
    const email = searchParams.get('email')

    if (code && email) {
      setRegisteredEmail(email)
      setVerificationCode(code)
      setShowVerification(true)
      handleVerifyEmail(email, code)
      // Clear URL params
      setSearchParams({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams])

  const onSubmit = async (data: RegisterData) => {
    clearError()
    clearSuccess()
    const result = await registerUser(data)
    if (result) {
      setRegisteredEmail(data.email)
      setShowVerification(true)
    }
  }

  const onVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (verificationCode.length < 4) {
      return
    }
    await handleVerifyEmail(registeredEmail, verificationCode)
  }

  const onBackToRegistration = () => {
    setShowVerification(false)
    setVerificationCode('')
    clearError()
    clearSuccess()
  }

  return (
    <RegisterRenderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      error={error}
      success={success}
      loading={loading}
      showVerification={showVerification}
      registeredEmail={registeredEmail}
      verificationCode={verificationCode}
      verifying={verifying}
      register={register}
      handleSubmit={handleSubmit}
      errors={errors}
      password={password}
      onSubmit={onSubmit}
      onVerifySubmit={onVerifySubmit}
      onVerificationCodeChange={setVerificationCode}
      onBackToRegistration={onBackToRegistration}
    />
  )
}

export default RegisterWrapper

