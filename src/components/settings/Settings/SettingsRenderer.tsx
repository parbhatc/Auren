import { Component } from 'react'
import { Lock, Mail, User } from 'lucide-react'
import { ERROR_MESSAGES } from '../../../constants/messages'
import { t } from '../../../utils/translator'
import { SettingsProps } from '../../../types'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SettingsPageLayout from '../../layout/SettingsPageLayout'
import {
  SettingsDivider,
  SettingsField,
  SettingsFormRow,
  SettingsPanel,
  SettingsReadOnlyRow,
  SettingsSaveButton,
  SettingsSection,
} from '../SettingsFormPrimitives'

class SettingsRenderer extends Component<SettingsProps> {
  render() {
    const {
      isDark,
      toggleTheme,
      user,
      navigate,
      passwordForm,
      nameForm,
      emailForm,
      newPassword,
      passwordError,
      passwordSuccess,
      passwordLoading,
      nameError,
      nameSuccess,
      nameLoading,
      emailError,
      emailSuccess,
      emailLoading,
      onPasswordSubmit,
      onNameSubmit,
      onEmailSubmit,
      embedded,
      onBack,
    } = this.props

    return (
      <SettingsPageLayout
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        title={embedded ? t('settings.accountTab') : t('settings.title')}
        subtitle={embedded ? t('practice.hub.settings.accountEmbeddedDesc') : t('settings.subtitle')}
        icon={User}
        embedded={embedded}
        onBack={onBack}
      >
        {(nameError || emailError || passwordError) && (
          <div className="space-y-2 mb-1">
            <ErrorMessage message={nameError || emailError || passwordError} isDark={isDark} />
          </div>
        )}
        {(nameSuccess || emailSuccess || passwordSuccess) && (
          <div className="mb-1">
            <SuccessMessage message={nameSuccess || emailSuccess || passwordSuccess} isDark={isDark} />
          </div>
        )}

        <SettingsPanel isDark={isDark}>
          <SettingsSection isDark={isDark}>
            <SettingsReadOnlyRow
              isDark={isDark}
              label={t('settings.username')}
              value={user.username}
              note={t('settings.usernameNote')}
            />
          </SettingsSection>

          <SettingsDivider isDark={isDark} />

          <SettingsSection isDark={isDark} title={t('settings.profileSection')}>
            <form onSubmit={nameForm.handleSubmit(onNameSubmit)}>
              <SettingsFormRow
                action={
                  <SettingsSaveButton loading={nameLoading}>
                    {nameLoading ? t('settings.saving') : t('settings.save')}
                  </SettingsSaveButton>
                }
              >
                <SettingsField
                  isDark={isDark}
                  id="name"
                  label={t('settings.nameLabel')}
                  placeholder={t('settings.namePlaceholder')}
                  icon={User}
                  register={nameForm.register('name', {
                    required: ERROR_MESSAGES.REQUIRED_FIELD,
                    minLength: { value: 2, message: 'Name must be at least 2 characters' },
                  })}
                  autoComplete="name"
                  error={nameForm.formState.errors.name}
                />
              </SettingsFormRow>
            </form>
          </SettingsSection>

          <SettingsDivider isDark={isDark} />

          <SettingsSection isDark={isDark} title={t('settings.emailSection')}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-3">
              <SettingsFormRow
                action={
                  <SettingsSaveButton loading={emailLoading}>
                    {emailLoading ? t('settings.saving') : t('settings.save')}
                  </SettingsSaveButton>
                }
              >
                <SettingsField
                  isDark={isDark}
                  id="email"
                  label={t('settings.emailLabel')}
                  type="email"
                  placeholder={t('settings.emailPlaceholder')}
                  icon={Mail}
                  register={emailForm.register('email', {
                    required: ERROR_MESSAGES.REQUIRED_FIELD,
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: ERROR_MESSAGES.INVALID_EMAIL,
                    },
                  })}
                  autoComplete="email"
                  error={emailForm.formState.errors.email}
                />
              </SettingsFormRow>
              {user && !user.email_verified && (
                <p
                  className={`text-xs px-3 py-2 rounded-lg ${
                    isDark ? 'bg-amber-500/10 text-amber-200/90' : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {t('settings.emailNotVerified')}
                </p>
              )}
            </form>
          </SettingsSection>

          <SettingsDivider isDark={isDark} />

          <SettingsSection isDark={isDark} title={t('settings.passwordSection')} hint={t('settings.passwordHint')}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-3">
              <SettingsField
                isDark={isDark}
                id="currentPassword"
                label={t('settings.currentPasswordLabel')}
                type="password"
                placeholder={t('settings.currentPasswordPlaceholder')}
                icon={Lock}
                register={passwordForm.register('currentPassword', {
                  required: ERROR_MESSAGES.REQUIRED_FIELD,
                })}
                autoComplete="current-password"
                error={passwordForm.formState.errors.currentPassword}
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <SettingsField
                  isDark={isDark}
                  id="newPassword"
                  label={t('settings.newPasswordLabel')}
                  type="password"
                  placeholder={t('settings.newPasswordPlaceholder')}
                  register={passwordForm.register('newPassword', {
                    required: ERROR_MESSAGES.REQUIRED_FIELD,
                    minLength: { value: 6, message: ERROR_MESSAGES.PASSWORD_TOO_SHORT },
                  })}
                  autoComplete="new-password"
                  error={passwordForm.formState.errors.newPassword}
                />
                <SettingsField
                  isDark={isDark}
                  id="confirmPassword"
                  label={t('settings.confirmPasswordLabel')}
                  type="password"
                  placeholder={t('settings.confirmPasswordPlaceholder')}
                  register={passwordForm.register('confirmPassword', {
                    required: ERROR_MESSAGES.REQUIRED_FIELD,
                    validate: (value: string) => value === newPassword || ERROR_MESSAGES.PASSWORD_MISMATCH,
                  })}
                  autoComplete="new-password"
                  error={passwordForm.formState.errors.confirmPassword}
                />
              </div>
              <div className="flex justify-end pt-1">
                <SettingsSaveButton loading={passwordLoading}>
                  {passwordLoading ? t('settings.saving') : t('settings.save')}
                </SettingsSaveButton>
              </div>
            </form>
          </SettingsSection>
        </SettingsPanel>
      </SettingsPageLayout>
    )
  }
}

export default SettingsRenderer

