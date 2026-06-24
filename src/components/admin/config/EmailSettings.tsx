import { Component } from 'react'
import ConfigInput from '../../common/ConfigInput'
import { t } from '../../../utils/translator'
import { EmailSettingsProps } from '../../../types'
import { AdminConfigInset, AdminConfigSection } from '../AdminFormPrimitives'

class EmailSettings extends Component<EmailSettingsProps> {
  render() {
    const { config, onUpdate, isDark, embedded } = this.props
    const inputVariant = embedded ? 'admin' : 'default'
    const smtpUser = config.smtp?.user ?? ''
    const smtpPassword = config.smtp?.password ?? ''

    const fields = (
      <div className="space-y-4">
        <ConfigInput
          label={t('admin.email.from')}
          type="text"
          value={config.from}
          variant={inputVariant}
          onChange={(value) => onUpdate(['email', 'from'], value)}
          isDark={isDark}
        />
        <ConfigInput
          label={t('admin.email.appName')}
          type="text"
          value={config.appName}
          variant={inputVariant}
          onChange={(value) => onUpdate(['email', 'appName'], value)}
          isDark={isDark}
        />
        <ConfigInput
          label={t('admin.email.appUrl')}
          type="url"
          value={config.appUrl}
          variant={inputVariant}
          onChange={(value) => onUpdate(['email', 'appUrl'], value)}
          isDark={isDark}
        />
        <ConfigInput
          label={t('admin.email.supportEmail')}
          type="email"
          value={config.supportEmail}
          variant={inputVariant}
          onChange={(value) => onUpdate(['email', 'supportEmail'], value)}
          isDark={isDark}
        />
        {embedded ? (
          <AdminConfigInset isDark={isDark} title={t('admin.email.smtp.title')}>
            <div className="space-y-4">
              <ConfigInput
                label={t('admin.email.smtp.user')}
                type="email"
                value={config.smtp.user}
                variant={inputVariant}
                onChange={(value) => onUpdate(['email', 'smtp', 'user'], value)}
                isDark={isDark}
              />
              <ConfigInput
                label={t('admin.email.smtp.password')}
                type="password"
                value={smtpPassword}
                variant={inputVariant}
                onChange={(value) => onUpdate(['email', 'smtp', 'password'], value)}
                isDark={isDark}
              />
            </div>
          </AdminConfigInset>
        ) : (
          <div className={`pt-4 border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('admin.email.smtp.title')}
            </h3>
            <div className="space-y-4">
              <ConfigInput
                label={t('admin.email.smtp.user')}
                type="email"
                value={config.smtp.user}
                onChange={(value) => onUpdate(['email', 'smtp', 'user'], value)}
                isDark={isDark}
              />
              <ConfigInput
                label={t('admin.email.smtp.password')}
                type="password"
                value={smtpPassword}
                onChange={(value) => onUpdate(['email', 'smtp', 'password'], value)}
                isDark={isDark}
              />
            </div>
          </div>
        )}
      </div>
    )

    if (embedded) {
      return (
        <AdminConfigSection isDark={isDark} title={t('admin.email.title')}>
          {fields}
        </AdminConfigSection>
      )
    }

    return (
      <div
        className={`rounded-2xl shadow-lg border p-6 ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
      >
        <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('admin.email.title')}
        </h2>
        {fields}
      </div>
    )
  }
}

export default EmailSettings
