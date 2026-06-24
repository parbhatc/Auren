import { Component } from 'react'
import Toggle from '../../common/Toggle'
import { t } from '../../../utils/translator'
import { SignupSettingsProps } from '../../../types'
import { AdminConfigSection } from '../AdminFormPrimitives'

class SignupSettings extends Component<SignupSettingsProps> {
  render() {
    const { enabled, onUpdate, isDark, embedded } = this.props

    const toggle = (
      <Toggle
        checked={enabled}
        onChange={onUpdate}
        label={t('admin.signup.enabled')}
        isDark={isDark}
        accent={embedded ? 'amber' : 'blue'}
      />
    )

    if (embedded) {
      return (
        <AdminConfigSection isDark={isDark} title={t('admin.signup.title')}>
          {toggle}
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
          {t('admin.signup.title')}
        </h2>
        {toggle}
      </div>
    )
  }
}

export default SignupSettings
