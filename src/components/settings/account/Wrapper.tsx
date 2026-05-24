import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useTheme } from '../../../hooks/useTheme'
import { ROUTES } from '../../../constants/routes'
import { authAPI } from '../../../api/auth.api'
import { t } from '../../../utils/translator'
import Loading from '../../common/Loading'
import Renderer from './Renderer'
import { UserData } from '../../../types/user'
import { PasswordFormData, NameFormData, EmailFormData } from '../../../types'

/**
 * Settings wrapper component
 * Uses hooks and passes props to renderer component
 */
type SettingsWrapperProps = {
  embedded?: boolean
  onBack?: () => void
}

const Wrapper = ({ embedded, onBack }: SettingsWrapperProps = {}) => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordError, setPasswordError] = useState<string>('')
  const [passwordSuccess, setPasswordSuccess] = useState<string>('')
  const [nameError, setNameError] = useState<string>('')
  const [nameSuccess, setNameSuccess] = useState<string>('')
  const [emailError, setEmailError] = useState<string>('')
  const [emailSuccess, setEmailSuccess] = useState<string>('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [nameLoading, setNameLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)

  const passwordForm = useForm<PasswordFormData>({ mode: 'onBlur' })
  const nameForm = useForm<NameFormData>({ mode: 'onBlur' })
  const emailForm = useForm<EmailFormData>({ mode: 'onBlur' })

  const newPassword = passwordForm.watch('newPassword')

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate(ROUTES.LOGIN)
          return
        }

        const response = await authAPI.validateToken(token)
        setUser(response.user)

        // Set initial form values
        nameForm.reset({ name: response.user.name })
        emailForm.reset({ email: response.user.email })
      } catch (error) {
        localStorage.removeItem('token')
        navigate(ROUTES.LOGIN)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [navigate, nameForm, emailForm])

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setPasswordError('')
    setPasswordSuccess('')
    setPasswordLoading(true)

    try {
      const response = await authAPI.updatePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })

      if (response.success) {
        setPasswordSuccess(response.message || t('settings.passwordUpdateSuccess'))
        passwordForm.reset()
      } else {
        setPasswordError(response.message || t('settings.passwordUpdateError'))
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || t('settings.passwordUpdateError')
      setPasswordError(errorMessage)
    } finally {
      setPasswordLoading(false)
    }
  }

  const onNameSubmit = async (data: NameFormData) => {
    setNameError('')
    setNameSuccess('')
    setNameLoading(true)

    try {
      const response = await authAPI.updateName({ name: data.name })

      if (response.success) {
        setNameSuccess(response.message || t('settings.nameUpdateSuccess'))
        // Update user state
        if (user) {
          setUser({ ...user, name: data.name })
        }
        // Refresh user data
        const token = localStorage.getItem('token')
        if (token) {
          const userResponse = await authAPI.validateToken(token)
          setUser(userResponse.user)
        }
      } else {
        setNameError(response.message || t('settings.nameUpdateError'))
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || t('settings.nameUpdateError')
      setNameError(errorMessage)
    } finally {
      setNameLoading(false)
    }
  }

  const onEmailSubmit = async (data: EmailFormData) => {
    setEmailError('')
    setEmailSuccess('')
    setEmailLoading(true)

    try {
      const response = await authAPI.updateEmail({ email: data.email })

      if (response.success) {
        setEmailSuccess(response.message || t('settings.emailUpdateSuccess'))
        // Refresh user data
        const token = localStorage.getItem('token')
        if (token) {
          const userResponse = await authAPI.validateToken(token)
          setUser(userResponse.user)
          emailForm.reset({ email: userResponse.user.email })
        }
      } else {
        setEmailError(response.message || t('settings.emailUpdateError'))
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || t('settings.emailUpdateError')
      setEmailError(errorMessage)
    } finally {
      setEmailLoading(false)
    }
  }

  if (loading || !user) {
    return <Loading />
  }

  return (
    <Renderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      user={user}
      navigate={navigate}
      passwordForm={passwordForm}
      nameForm={nameForm}
      emailForm={emailForm}
      newPassword={newPassword}
      passwordError={passwordError}
      passwordSuccess={passwordSuccess}
      passwordLoading={passwordLoading}
      nameError={nameError}
      nameSuccess={nameSuccess}
      nameLoading={nameLoading}
      emailError={emailError}
      emailSuccess={emailSuccess}
      emailLoading={emailLoading}
      onPasswordSubmit={onPasswordSubmit}
      onNameSubmit={onNameSubmit}
      onEmailSubmit={onEmailSubmit}
      embedded={embedded}
      onBack={onBack}
    />
  )
}

export default Wrapper

