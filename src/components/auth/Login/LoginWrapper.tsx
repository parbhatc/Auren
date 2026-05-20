import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { useAuth } from '../../../hooks/useAuth'
import { ROUTES } from '../../../constants/routes'
import { LoginCredentials } from '../../../types'
import LoginRenderer from './LoginRenderer'

/**
 * Login page wrapper component
 * Uses hooks and passes props to renderer component
 */
const LoginWrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const { error, loading, login, clearError } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      navigate(ROUTES.HOME, { replace: true })
    }
  }, [navigate])

  const onSubmit = async (data: LoginCredentials) => {
    clearError()
    await login(data)
  }

  return (
    <LoginRenderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      error={error}
      loading={loading}
      register={register}
      handleSubmit={handleSubmit}
      errors={errors}
      onSubmit={onSubmit}
    />
  )
}

export default LoginWrapper

