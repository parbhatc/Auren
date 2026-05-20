import { Component } from 'react'
import ConfigInput from '../../common/ConfigInput'
import { t } from '../../../utils/translator'
import { EmailSettingsProps } from '../../../types'

class EmailSettings extends Component<EmailSettingsProps> {
  render() {
    const { config, onUpdate, isDark } = this.props

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
        <div className="space-y-4">
          <ConfigInput
            label={t('admin.email.from')}
            type="text"
            value={config.from}
            onChange={(value) => onUpdate(['email', 'from'], value)}
            isDark={isDark}
          />
          <ConfigInput
            label={t('admin.email.appName')}
            type="text"
            value={config.appName}
            onChange={(value) => onUpdate(['email', 'appName'], value)}
            isDark={isDark}
          />
          <ConfigInput
            label={t('admin.email.appUrl')}
            type="url"
            value={config.appUrl}
            onChange={(value) => onUpdate(['email', 'appUrl'], value)}
            isDark={isDark}
          />
          <ConfigInput
            label={t('admin.email.supportEmail')}
            type="email"
            value={config.supportEmail}
            onChange={(value) => onUpdate(['email', 'supportEmail'], value)}
            isDark={isDark}
          />
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
                value={config.smtp.password}
                onChange={(value) => onUpdate(['email', 'smtp', 'password'], value)}
                isDark={isDark}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default EmailSettings
