import { Component } from 'react'
import ConfigInput from '../../common/ConfigInput'
import { t } from '../../../utils/translator'
import { PasswordSettingsProps } from '../../../types'

class PasswordSettings extends Component<PasswordSettingsProps> {
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
          {t('admin.password.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConfigInput
            label={t('admin.password.minLength')}
            type="number"
            value={config.minLength}
            onChange={(value) => {
              if (value === '' || value === '-') return
              const num = parseInt(value)
              if (!isNaN(num) && num > 0) onUpdate('minLength', num)
            }}
            isDark={isDark}
          />
          <ConfigInput
            label={t('admin.password.maxLength')}
            type="number"
            value={config.maxLength}
            onChange={(value) => {
              if (value === '' || value === '-') return
              const num = parseInt(value)
              if (!isNaN(num) && num > 0) onUpdate('maxLength', num)
            }}
            isDark={isDark}
          />
        </div>
      </div>
    )
  }
}

export default PasswordSettings
