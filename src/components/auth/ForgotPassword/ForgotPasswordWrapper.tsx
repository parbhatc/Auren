import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { useTheme } from '../../../hooks/useTheme'
import { useAuth } from '../../../hooks/useAuth'
import { t } from '../../../utils/translator'
import { ForgotPasswordData } from '../../../types'
import ForgotPasswordRenderer from './ForgotPasswordRenderer'

/**
 * Forgot Password page wrapper component
 * Uses hooks and passes props to renderer component
 */
const ForgotPasswordWrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const { error, loading, forgotPassword, clearError } = useAuth()
  const [success, setSuccess] = useState<string>('')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordData>({
    mode: 'onBlur',
  })

  const onSubmit = async (data: ForgotPasswordData) => {
    clearError()
    setSuccess('')

    const result = await forgotPassword(data)
    if (result) {
      setSuccess(t('auth.forgotPassword.submitButtonSuccess'))
    }
  }

  return (
    <ForgotPasswordRenderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      error={error}
      success={success}
      loading={loading}
      register={register}
      handleSubmit={handleSubmit}
      errors={errors}
      onSubmit={onSubmit}
    />
  )
}

export default ForgotPasswordWrapper

