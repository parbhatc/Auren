import { Component } from 'react'
import { Settings as SettingsIcon, AlertCircle, Database, ChevronRight } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import { AdminSettingsProps } from '../../../types'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SubmitButton from '../../common/SubmitButton'
import PasswordSettings from '../config/PasswordSettings'
import SignupSettings from '../config/SignupSettings'
import CodeSettings from '../config/CodeSettings'
import EmailSettings from '../config/EmailSettings'
import TokenSettings from '../config/TokenSettings'
import Loading from '../../common/Loading'
import { AdminEmbeddedShell } from '../../trading/Practice/hub/AdminEmbeddedShell'
import { AdminConfigPanel, AdminConfigSaveBar } from '../AdminFormPrimitives'

/**
 * Admin Settings renderer component
 * Allows admins to modify server configuration
 */
class Renderer extends Component<AdminSettingsProps> {
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
      embedded,
    } = this.props

    if (!user?.isAdmin) {
      if (embedded) {
        return (
          <AdminEmbeddedShell>
            <ErrorMessage message={error || t('admin.adminRequired')} isDark={isDark} />
          </AdminEmbeddedShell>
        )
      }
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
      return embedded ? null : <Loading />
    }

    const settingsFields = (
      <>
        {embedded && (
          <div className="px-5 sm:px-6 pt-5 sm:pt-6">
            <button
              type="button"
              onClick={() => navigate(ROUTES.BACKTESTER_DATA_MANAGEMENT)}
              className={`w-full flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors ${
                isDark
                  ? 'border-slate-700/80 bg-slate-800/40 hover:bg-slate-800/70'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`shrink-0 rounded-lg p-2 ${isDark ? 'bg-violet-600/20 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>
                  <Database className="w-5 h-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {t('admin.backtesterData')}
                  </p>
                  <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t('admin.backtesterDataDescription')}
                  </p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} aria-hidden />
            </button>
          </div>
        )}

        <PasswordSettings
          embedded={embedded}
          config={config.password}
          onUpdate={(field, value) => updateConfig(['password', field], value)}
          isDark={isDark}
        />

        <SignupSettings
          embedded={embedded}
          enabled={config.signup.enabled}
          onUpdate={(enabled) => updateConfig(['signup', 'enabled'], enabled)}
          isDark={isDark}
        />

        <CodeSettings
          embedded={embedded}
          title={t('admin.verificationCode.title')}
          lengthKey="admin.verificationCode.length"
          expiryKey="admin.verificationCode.expiryMinutes"
          config={config.verificationCode}
          onUpdate={(field, value) => updateConfig(['verificationCode', field], value)}
          isDark={isDark}
        />

        <CodeSettings
          embedded={embedded}
          title={t('admin.resetCode.title')}
          lengthKey="admin.resetCode.length"
          expiryKey="admin.resetCode.expiryMinutes"
          config={config.resetCode}
          onUpdate={(field, value) => updateConfig(['resetCode', field], value)}
          isDark={isDark}
        />

        <EmailSettings embedded={embedded} config={config.email} onUpdate={updateConfig} isDark={isDark} />

        <TokenSettings
          embedded={embedded}
          title={t('admin.jwt.title')}
          labelKey="admin.jwt.expiresIn"
          value={config.jwt.expiresIn}
          type="text"
          placeholder="e.g., 7d, 24h, 30m"
          onUpdate={(value) => updateConfig(['jwt', 'expiresIn'], value)}
          isDark={isDark}
        />

        <TokenSettings
          embedded={embedded}
          title={t('admin.resetToken.title')}
          labelKey="admin.resetToken.expiryHours"
          value={config.resetToken.expiryHours}
          type="number"
          onUpdate={(value) => updateConfig(['resetToken', 'expiryHours'], value)}
          isDark={isDark}
        />
      </>
    )

    const form = (
      <>
        {(error || success) && (
          <div className={`space-y-3 ${embedded ? 'px-5 sm:px-6 pt-5 sm:pt-6' : 'mb-4'}`}>
            <ErrorMessage message={error} isDark={isDark} />
            <SuccessMessage message={success} isDark={isDark} />
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave()
          }}
          className={embedded ? 'space-y-0' : 'space-y-6'}
        >
          {embedded ? (
            <AdminConfigPanel isDark={isDark} embedded>
              {settingsFields}
            </AdminConfigPanel>
          ) : (
            settingsFields
          )}

          {embedded ? (
            <AdminConfigSaveBar isDark={isDark} loading={saving}>
              {saving ? t('admin.saveButtonLoading') : t('admin.saveButton')}
            </AdminConfigSaveBar>
          ) : (
            <div className="flex justify-end">
              <SubmitButton loading={saving}>
                {saving ? t('admin.saveButtonLoading') : t('admin.saveButton')}
              </SubmitButton>
            </div>
          )}
        </form>
      </>
    )

    if (embedded) {
      return <AdminEmbeddedShell>{form}</AdminEmbeddedShell>
    }

    return (
      <div
        className={`min-h-screen transition-all duration-700 ease-in-out ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
            : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
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

          {form}
        </main>
      </div>
    )
  }
}

export default Renderer

