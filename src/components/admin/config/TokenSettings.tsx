import { Component } from 'react'
import ConfigInput from '../../common/ConfigInput'
import { t } from '../../../utils/translator'
import { TokenSettingsProps } from '../../../types'

class TokenSettings extends Component<TokenSettingsProps> {
  render() {
    const { title, labelKey, value, type = 'text', placeholder, onUpdate, isDark } = this.props

    return (
      <div
        className={`rounded-2xl shadow-lg border p-6 ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
      >
        <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {title}
        </h2>
        <ConfigInput
          label={t(labelKey)}
          type={type as any}
          value={value}
          onChange={(value) => {
            if (type === 'number') {
              if (value === '' || value === '-') return
              const num = parseInt(value)
              if (!isNaN(num) && num > 0) onUpdate(num)
            } else {
              onUpdate(value)
            }
          }}
          placeholder={placeholder}
          isDark={isDark}
        />
      </div>
    )
  }
}

export default TokenSettings
