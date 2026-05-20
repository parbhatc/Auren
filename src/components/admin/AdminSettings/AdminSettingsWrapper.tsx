import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { ROUTES } from '../../../constants/routes'
import { authAPI } from '../../../api/auth.api'
import { adminAPI } from '../../../api/admin.api'
import { getThemeColors } from '../../../constants/theme'
import { t } from '../../../utils/translator'
import Loading from '../../common/Loading'
import AdminSettingsRenderer from './AdminSettingsRenderer'
import { UserData } from '../../../types/user'
import { ConfigData } from '../../../types'

/**
 * Admin Settings wrapper component
 * Uses hooks and passes props to renderer component
 */
const AdminSettingsWrapper = () => {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const colors = getThemeColors(isDark)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate(ROUTES.LOGIN)
          return
        }

        const userResponse = await authAPI.validateToken(token)
        setUser(userResponse.user)

        if (!userResponse.user.isAdmin) {
          setError(t('admin.adminRequired'))
          return
        }

        const configResponse = await adminAPI.getConfig()
        setConfig(configResponse.config)
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setError(t('admin.adminRequired'))
        } else if (err?.response?.status === 401) {
          localStorage.removeItem('token')
          navigate(ROUTES.LOGIN)
        } else {
          setError(err?.response?.data?.message || t('admin.configLoadError'))
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate])

  const handleSave = async () => {
    if (!config) return

    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const response = await adminAPI.updateConfig(config)
      if (response.success) {
        setSuccess(response.message || t('admin.configUpdateSuccess'))
        setConfig(response.config)
      } else {
        setError(response.message || t('admin.configUpdateError'))
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || t('admin.configUpdateError')
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (path: string[], value: any) => {
    if (!config) return

    const newConfig = { ...config }
    let current: any = newConfig

    for (let i = 0; i < path.length - 1; i++) {
      current[path[i]] = { ...current[path[i]] }
      current = current[path[i]]
    }

    current[path[path.length - 1]] = value
    setConfig(newConfig)
  }

  if (loading || !user) {
    return <Loading />
  }

  return (
    <AdminSettingsRenderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      user={user}
      config={config}
      colors={colors}
      navigate={navigate}
      error={error}
      success={success}
      saving={saving}
      onSave={handleSave}
      updateConfig={updateConfig}
    />
  )
}

export default AdminSettingsWrapper

