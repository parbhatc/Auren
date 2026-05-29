import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Eye, EyeOff, User } from 'lucide-react'
import { fieldLabelClass, settingsInputClass, settingsSaveButtonClass } from '../../styles/aurenTheme'
import { t } from '../../utils/translator'

export type BaseLoginFirmProps = {
  isDark: boolean
  idPrefix: string
  username: string
  password: string
  saving: boolean
  configured: boolean
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSave: () => void
  usernameLabel?: string
  usernamePlaceholder?: string
  passwordPlaceholder?: string
  /** Shown under the password field when a password is already stored (field stays empty for security). */
  passwordHint?: string
  usernameIcon?: LucideIcon
}

/** Username (or email) + password connect form. */
export default function BaseLoginFirm({
  isDark,
  idPrefix,
  username,
  password,
  saving,
  configured,
  onUsernameChange,
  onPasswordChange,
  onSave,
  usernameLabel = t('props.usernameLabel'),
  usernamePlaceholder,
  passwordPlaceholder,
  passwordHint,
  usernameIcon: UsernameIcon = User,
}: BaseLoginFirmProps) {
  const inputClass = settingsInputClass(isDark)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const resolvedPasswordPlaceholder =
    passwordPlaceholder !== undefined
      ? passwordPlaceholder
      : t('props.passwordPlaceholder', { firm: idPrefix })

  return (
    <>
      <div>
        <label className={fieldLabelClass(isDark)} htmlFor={`${idPrefix}-username`}>
          {usernameLabel}
        </label>
        <div className="relative mt-1.5">
          <UsernameIcon
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}
          />
          <input
            id={`${idPrefix}-username`}
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder={usernamePlaceholder}
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>
      <div>
        <label className={fieldLabelClass(isDark)} htmlFor={`${idPrefix}-password`}>
          {t('props.passwordLabel')}
        </label>
        <div className="relative mt-1.5">
          <input
            id={`${idPrefix}-password`}
            type={passwordVisible ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={resolvedPasswordPlaceholder}
            className={`${inputClass} pr-10`}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
          />
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md transition-colors ${
              isDark
                ? 'text-slate-500 hover:text-slate-300'
                : 'text-slate-400 hover:text-slate-600'
            }`}
            aria-label={passwordVisible ? t('props.hidePassword') : t('props.showPassword')}
            aria-pressed={passwordVisible}
          >
            {passwordVisible ? (
              <EyeOff className="w-4 h-4" aria-hidden />
            ) : (
              <Eye className="w-4 h-4" aria-hidden />
            )}
          </button>
        </div>
        {passwordHint ? (
          <p className={`mt-1.5 text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
            {passwordHint}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className={`${settingsSaveButtonClass()} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {configured ? t('props.updateCredentials') : t('props.saveCredentials')}
      </button>
    </>
  )
}
