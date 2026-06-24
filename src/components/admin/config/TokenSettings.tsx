import { Component } from 'react'
import ConfigInput from '../../common/ConfigInput'
import { t } from '../../../utils/translator'
import { TokenSettingsProps } from '../../../types'
import { AdminConfigSection } from '../AdminFormPrimitives'

class TokenSettings extends Component<TokenSettingsProps> {
  render() {
    const { title, labelKey, value, type = 'text', placeholder, onUpdate, isDark, embedded } = this.props
    const inputVariant = embedded ? 'admin' : 'default'

    const field = (
      <ConfigInput
        label={t(labelKey)}
        type={type as 'text' | 'number'}
        value={value}
        variant={inputVariant}
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
    )

    if (embedded) {
      return (
        <AdminConfigSection isDark={isDark} title={title}>
          {field}
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
          {title}
        </h2>
        {field}
      </div>
    )
  }
}

export default TokenSettings
