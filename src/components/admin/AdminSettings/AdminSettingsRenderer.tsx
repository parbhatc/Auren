import { Component } from 'react'
import { Settings as SettingsIcon, ArrowLeft, AlertCircle } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import { AdminSettingsProps } from '../../../types'
import ThemeToggle from '../../common/ThemeToggle'
import Logo from '../../common/Logo'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SubmitButton from '../../common/SubmitButton'
import PasswordSettings from '../config/PasswordSettings'
import SignupSettings from '../config/SignupSettings'
import CodeSettings from '../config/CodeSettings'
import EmailSettings from '../config/EmailSettings'
import TokenSettings from '../config/TokenSettings'
import Loading from '../../common/Loading'

/**
 * Admin Settings renderer component
 * Allows admins to modify server configuration
 */
class AdminSettingsRenderer extends Component<AdminSettingsProps> {
  render() {
    const {
      isDark,
      toggleTheme,
      user,
      config,
      colors,
      navigate,
      error,
      success,
      saving,
      onSave,
      updateConfig,
    } = this.props

    if (!user.isAdmin) {
      return (
        <div
          className={`min-h-screen flex items-center justify-center transition-all duration-700 ease-in-out ${
            isDark
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
              : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
          }`}
        >
          <div
            className={`rounded-2xl shadow-2xl border p-8 max-w-md ${
              isDark
                ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                : 'bg-white/90 border-slate-200 backdrop-blur-sm'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('admin.accessDenied')}
              </h2>
            </div>
            <p className={`mb-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('admin.adminRequired')}
            </p>
            <button
              onClick={() => navigate(ROUTES.HOME)}
              className={`w-full px-4 py-2 rounded-lg transition-all duration-300 ${colors.button.primary}`}
            >
              {t('admin.goToDashboard')}
            </button>
          </div>
        </div>
      )
    }

    if (!config) {
      return <Loading />
    }

    return (
      <div
        className={`min-h-screen transition-all duration-700 ease-in-out ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
            : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        {/* Header */}
        <header
          className={`border-b ${
            isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/80'
          } backdrop-blur-sm sticky top-0 z-50`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Logo isDark={isDark} compact={true} onClick={() => navigate(ROUTES.HOME)} />
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(ROUTES.HOME)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                    isDark
                      ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-700'
                      : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('common.back')}</span>
                </button>
                <ThemeToggle isDark={isDark} onToggle={toggleTheme} fixed={false} />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <SettingsIcon className={`w-6 h-6 sm:w-8 sm:h-8 ${colors.icon.primary}`} />
              <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('admin.title')}
              </h1>
            </div>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('admin.subtitle')}
            </p>
          </div>

          <ErrorMessage message={error} isDark={isDark} className="mb-4" />
          <SuccessMessage message={success} isDark={isDark} className="mb-4" />

          <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="space-y-6">
            <PasswordSettings
              config={config.password}
              onUpdate={(field, value) => updateConfig(['password', field], value)}
              isDark={isDark}
            />

            <SignupSettings
              enabled={config.signup.enabled}
              onUpdate={(enabled) => updateConfig(['signup', 'enabled'], enabled)}
              isDark={isDark}
            />

            <CodeSettings
              title={t('admin.verificationCode.title')}
              lengthKey="admin.verificationCode.length"
              expiryKey="admin.verificationCode.expiryMinutes"
              config={config.verificationCode}
              onUpdate={(field, value) => updateConfig(['verificationCode', field], value)}
              isDark={isDark}
            />

            <CodeSettings
              title={t('admin.resetCode.title')}
              lengthKey="admin.resetCode.length"
              expiryKey="admin.resetCode.expiryMinutes"
              config={config.resetCode}
              onUpdate={(field, value) => updateConfig(['resetCode', field], value)}
              isDark={isDark}
            />

            <EmailSettings
              config={config.email}
              onUpdate={updateConfig}
              isDark={isDark}
            />

            <TokenSettings
              title={t('admin.jwt.title')}
              labelKey="admin.jwt.expiresIn"
              value={config.jwt.expiresIn}
              type="text"
              placeholder="e.g., 7d, 24h, 30m"
              onUpdate={(value) => updateConfig(['jwt', 'expiresIn'], value)}
              isDark={isDark}
            />

            <TokenSettings
              title={t('admin.resetToken.title')}
              labelKey="admin.resetToken.expiryHours"
              value={config.resetToken.expiryHours}
              type="number"
              onUpdate={(value) => updateConfig(['resetToken', 'expiryHours'], value)}
              isDark={isDark}
            />

            <div className="flex justify-end">
              <SubmitButton loading={saving}>
                {saving ? t('admin.saveButtonLoading') : t('admin.saveButton')}
              </SubmitButton>
            </div>
          </form>
        </main>
      </div>
    )
  }
}

export default AdminSettingsRenderer

