/**
 * Props Settings Wrapper Component
 * Handles state and API calls
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { propsAPI } from '../../../api/props.api'
import { authAPI } from '../../../api/auth.api'
import { PropFirm, PropFirmFormData, PropFirmType } from '../../../types/props'
import Renderer from './Renderer'
import ConfirmDialog from '../../common/ConfirmDialog'
import { t } from '../../../utils/translator'
import { UserData } from '../../../types/user'

type PropsSettingsWrapperProps = {
  embedded?: boolean
  onBack?: () => void
}

export default function Wrapper({ embedded, onBack }: PropsSettingsWrapperProps = {}) {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [propFirms, setPropFirms] = useState<PropFirm[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [clearType, setClearType] = useState<string | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [testedCredentials, setTestedCredentials] = useState<{ type: string; credentials: { username: string; password: string } } | null>(null)
  const [user, setUser] = useState<UserData | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token')
        if (token) {
          const userResponse = await authAPI.validateToken(token)
          setUser(userResponse.user)
        }
      } catch (error) {
        // User not authenticated or token invalid
      }
    }
    fetchUser()
    loadPropFirms()

    // Listen for refresh events from child components
    const handleRefresh = () => {
      loadPropFirms()
    }
    window.addEventListener('refreshPropFirms', handleRefresh)

    return () => {
      window.removeEventListener('refreshPropFirms', handleRefresh)
    }
  }, [])

  const loadPropFirms = async () => {
    try {
      setLoading(true)
      setError('')
      // Fetch all prop firms first
      const response = await propsAPI.getPropFirms()
      let propFirmsList: PropFirm[] = response.propFirms || []
      
      // Fetch market data credentials if configured
      const tradeseaFirm = propFirmsList.find(f => f.type === 'tradesea')
      if (tradeseaFirm) {
        try {
          const firmResponse = await propsAPI.getPropFirm('tradesea')
          if (firmResponse.success && firmResponse.propFirm) {
            propFirmsList = propFirmsList.map(f =>
              f.type === 'tradesea' ? firmResponse.propFirm! : f
            )
          }
        } catch {
          // If fetching credentials fails, use the firm without credentials
        }
      }

      setPropFirms(propFirmsList)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load prop firm settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: PropFirmFormData) => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      
      // If token is provided in credentials, save it separately
      const token = data.credentials.token
      const credentialsToSave = { ...data.credentials }
      delete credentialsToSave.token // Remove token from credentials before saving
      
      const response = await propsAPI.savePropFirm({
        ...data,
        credentials: credentialsToSave
      })
      
      if (response.success) {
        // If token was provided, update it
        if (token && typeof token === 'string') {
          try {
            await propsAPI.updateToken(data.type, token)
          } catch (tokenError: any) {
            // Log but don't fail - credentials are saved
            console.warn('Failed to update token:', tokenError)
          }
        }
        
        setSuccess(response.message || 'Credentials saved successfully')
        // Update the prop firm in state without showing loading screen
        const firmResponse = await propsAPI.getPropFirm(data.type)
        if (firmResponse.success && firmResponse.propFirm) {
          setPropFirms(prev => {
            const existing = prev.find(f => f.type === data.type)
            if (existing) {
              return prev.map(f => f.type === data.type ? firmResponse.propFirm! : f)
            } else {
              return [...prev, firmResponse.propFirm!]
            }
          })
        }
      } else {
        setError(response.message || 'Failed to save credentials')
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save credentials')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (type: string) => {
    setClearType(type)
    setShowClearDialog(true)
  }

  const confirmClear = async () => {
    if (!clearType) return
    
    try {
      setError('')
      setSuccess('')
      const response = await propsAPI.deletePropFirm(clearType)
      if (response.success) {
        setSuccess(response.message || 'Credentials cleared successfully')
        await loadPropFirms()
      } else {
        setError(response.message || 'Failed to clear credentials')
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to clear credentials')
    } finally {
      setShowClearDialog(false)
      setClearType(null)
    }
  }

  const cancelClear = () => {
    setShowClearDialog(false)
    setClearType(null)
  }

  const handleTest = async (type: string, credentials: { username: string; password: string }) => {
    try {
      setError('')
      setSuccess('')
      
      // Validate credentials are provided
      if (!credentials.username || !credentials.password) {
        setError(t('props.saveCredentialsFirst'))
        return
      }

      const response = await propsAPI.testConnection(type, credentials)
      
      if (response.success) {
        // Check if credentials are different from saved ones
        const savedFirm = propFirms.find(f => f.type === type)
        const credentialsChanged = !savedFirm || 
          savedFirm.credentials.username !== credentials.username || 
          savedFirm.credentials.password !== credentials.password
        
        if (credentialsChanged) {
          // Show dialog asking if they want to save
          setTestedCredentials({ type, credentials })
          setShowSaveDialog(true)
        } else {
          // Credentials are the same, just show success and update token
          setSuccess(response.message || 'Connection test successful')
          // Update token without showing loading
          const firmResponse = await propsAPI.getPropFirm(type)
          if (firmResponse.success && firmResponse.propFirm) {
            setPropFirms(prev => {
              const existing = prev.find(f => f.type === type)
              if (existing) {
                return prev.map(f => f.type === type ? firmResponse.propFirm! : f)
              } else {
                return [...prev, firmResponse.propFirm!]
              }
            })
          }
        }
      } else {
        setError(response.message || 'Connection test failed')
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Connection test failed')
    }
  }

  const confirmSaveTestedCredentials = async () => {
    if (!testedCredentials) return
    
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      
      const response = await propsAPI.savePropFirm({
        type: testedCredentials.type as PropFirmType,
        credentials: testedCredentials.credentials
      })
      
      if (response.success) {
        setSuccess(response.message || 'Credentials saved successfully')
        // Update the prop firm in state without showing loading screen
        const firmResponse = await propsAPI.getPropFirm(testedCredentials.type)
        if (firmResponse.success && firmResponse.propFirm) {
          setPropFirms(prev => {
            const existing = prev.find(f => f.type === testedCredentials.type)
            if (existing) {
              return prev.map(f => f.type === testedCredentials.type ? firmResponse.propFirm! : f)
            } else {
              return [...prev, firmResponse.propFirm!]
            }
          })
        }
      } else {
        setError(response.message || 'Failed to save credentials')
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save credentials')
    } finally {
      setSaving(false)
      setShowSaveDialog(false)
      setTestedCredentials(null)
    }
  }

  const cancelSaveTestedCredentials = () => {
    setShowSaveDialog(false)
    setTestedCredentials(null)
    setSuccess(t('props.testSuccessfulNotSaved'))
  }

  return (
    <>
      <Renderer
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        propFirms={propFirms}
        loading={loading}
        saving={saving}
        error={error}
        success={success}
        onSave={handleSave}
        onDelete={handleDelete}
        onTest={handleTest}
        onNotifySuccess={(message) => {
          setSuccess(message)
          setError('')
        }}
        onNotifyError={(message) => {
          setError(message)
          setSuccess('')
        }}
        onRefreshPropFirms={loadPropFirms}
        user={user}
        embedded={embedded}
        onBack={onBack}
      />
      <ConfirmDialog
        isOpen={showClearDialog}
        title={t('props.clearTitle')}
        message={t('props.clearConfirm')}
        confirmText={t('props.clearButton')}
        cancelText={t('common.cancel')}
        onConfirm={confirmClear}
        onCancel={cancelClear}
        variant="warning"
        isDark={isDark}
      />
      <ConfirmDialog
        isOpen={showSaveDialog}
        title={t('props.saveTestedCredentialsTitle')}
        message={t('props.saveTestedCredentialsMessage')}
        confirmText={t('props.saveButton')}
        cancelText={t('common.cancel')}
        onConfirm={confirmSaveTestedCredentials}
        onCancel={cancelSaveTestedCredentials}
        variant="info"
        isDark={isDark}
      />
    </>
  )
}

