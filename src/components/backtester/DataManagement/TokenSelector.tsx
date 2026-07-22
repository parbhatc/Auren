import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Save } from 'lucide-react'
import { TokenSelectorProps } from '../../../types/backtesterDataManagement'
import { t } from '../../../utils/translator'

const TokenSelector = ({
  currentToken,
  onCurrentTokenChange,
  savedToken,
  onTokenObtained,
  onSaveToken,
  onUserLogin,
  colorScheme,
  isDark,
  source
}: TokenSelectorProps) => {
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const colorClasses = {
    blue: {
      active: isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white',
      inactive: isDark ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300',
      border: isDark ? 'border-blue-700/50' : 'border-blue-200',
      focus: isDark ? 'focus:border-blue-500' : 'focus:border-blue-500',
    },
    purple: {
      active: isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white',
      inactive: isDark ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300',
      border: isDark ? 'border-blue-700/50' : 'border-blue-200',
      focus: isDark ? 'focus:border-blue-500' : 'focus:border-blue-500',
    },
  }
  const colors = colorClasses[colorScheme]

  // Initialize currentToken with savedToken only once on mount
  const [initialized, setInitialized] = useState(false)
  
  useEffect(() => {
    // Only initialize once on mount if we have a savedToken and currentToken is empty
    if (!initialized && savedToken && currentToken === '') {
      onCurrentTokenChange(savedToken)
      setInitialized(true)
    } else if (!initialized) {
      // Mark as initialized even if no savedToken, so we don't try again
      setInitialized(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run once on mount

  // Track when user manually edits the input
  const handleTokenChange = (value: string) => {
    onCurrentTokenChange(value)
  }

  const handleSaveToken = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (onSaveToken) {
        const result = await onSaveToken(currentToken.trim(), source)
        if (result.success) {
          setSuccess(result.message || 'Token saved successfully')
          setTimeout(() => setSuccess(''), 3000)
        } else {
          setError(result.error || t('backtesterDataManagement.tokenSelector.saveFailed'))
        }
      } else {
        setError(t('backtesterDataManagement.tokenSelector.errorSaveTokenFunctionNotAvailable'))
      }
    } catch (err: any) {
      setError(err.message || t('backtesterDataManagement.tokenSelector.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleGetToken = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (onUserLogin) {
        const result = await onUserLogin(username.trim(), password.trim(), source)
        if (result.success && result.token) {
          onCurrentTokenChange(result.token)
          if (onTokenObtained) {
            onTokenObtained(result.token)
          }
          setUsername('')
          setPassword('')
          setShowLoginForm(false)
          setSuccess('Token obtained successfully')
          setTimeout(() => setSuccess(''), 3000)
        } else {
          setError(result.error || 'Login failed. Please check your credentials.')
        }
      } else {
        setError('Login function not available')
      }
    } catch (err: any) {
      setError(err.message || t('backtesterDataManagement.tokenSelector.errorGetTokenFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`rounded-2xl shadow-lg border overflow-hidden ${
        isDark
          ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
          : 'bg-white/90 border-slate-200 backdrop-blur-sm'
      }`}
    >
      <div className="p-4 sm:p-6">
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Token Selection
        </h3>
        
        {/* Current Token Input */}
        <div className="mb-4">
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Current Token:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="Enter or paste token here..."
              className={`flex-1 px-3 py-2 rounded-lg border outline-none transition-all ${
                isDark
                  ? `bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:bg-slate-800 ${colors.focus}`
                  : `bg-white/80 border-slate-300 text-slate-900 placeholder-slate-500 focus:bg-white ${colors.focus}`
              }`}
            />
            <button
              onClick={handleSaveToken}
              disabled={saving}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${colors.active} ${
                saving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Success/Error Messages - Only show outside login form if form is not visible */}
        {!showLoginForm && success && (
          <div className={`mb-3 p-2 rounded-lg text-sm ${isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'}`}>
            {success}
          </div>
        )}
        {!showLoginForm && error && (
          <div className={`mb-3 p-2 rounded-lg text-sm ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-700'}`}>
            {error}
          </div>
        )}

        {/* Login Form Toggle Button - Hide for TradingView */}
        {source !== 'tradingview' && (
          <>
            <button
              onClick={() => setShowLoginForm(!showLoginForm)}
              className={`w-full flex items-center justify-between px-4 py-2 rounded-lg border transition-all mb-3 ${
                isDark
                  ? `border-slate-700 hover:bg-slate-700/50 ${colors.border}`
                  : `border-slate-300 hover:bg-slate-100 ${colors.border}`
              }`}
            >
              <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {showLoginForm ? 'Hide Login Form' : 'Show Login Form'}
              </span>
              {showLoginForm ? (
                <ChevronUp className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
              ) : (
                <ChevronDown className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
              )}
            </button>

            {/* Login Form (shown when expanded) */}
            {showLoginForm && (
              <div className="space-y-3 border-t pt-3">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                      isDark
                        ? `bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:bg-slate-800 ${colors.focus}`
                        : `bg-white/80 border-slate-300 text-slate-900 placeholder-slate-500 focus:bg-white ${colors.focus}`
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                      isDark
                        ? `bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:bg-slate-800 ${colors.focus}`
                        : `bg-white/80 border-slate-300 text-slate-900 placeholder-slate-500 focus:bg-white ${colors.focus}`
                    }`}
                  />
                </div>
                {/* Show error and success messages inside login form when form is visible */}
                {showLoginForm && success && (
                  <div className={`p-2 rounded-lg text-sm ${isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'}`}>
                    {success}
                  </div>
                )}
                {showLoginForm && error && (
                  <div className={`p-2 rounded-lg text-sm ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-700'}`}>
                    {error}
                  </div>
                )}
                <button
                  onClick={handleGetToken}
                  disabled={loading}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-all ${colors.active} ${
                    loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                  }`}
                >
                  {loading ? 'Getting Token...' : 'Get Token'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TokenSelector
