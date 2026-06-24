import { Component } from 'react'
import { Mail, Lock, User, Shield, UserCircle } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { ERROR_MESSAGES } from '../../../constants/messages'
import { t } from '../../../utils/translator'
import { RegisterProps } from '../../../types'
import AuthPageLayout from '../../layout/AuthPageLayout'
import LoginCard from '../../common/LoginCard'
import InputField from '../../common/InputField'
import PageHeader from '../../common/PageHeader'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SubmitButton from '../../common/SubmitButton'
import AuthLink from '../../common/AuthLink'
import { AuthBackLink } from '../shared/AuthBackLink'
import { AuthCodeField } from '../shared/AuthCodeField'
import { authInfoBoxClass, authMutedTextClass } from '../shared/authTheme'

class Renderer extends Component<RegisterProps> {
  render() {
    const {
      isDark,
      toggleTheme,
      error,
      success,
      loading,
      showVerification,
      registeredEmail,
      verificationCode,
      verifying,
      register,
      handleSubmit,
      errors,
      password,
      onSubmit,
      onVerifySubmit,
      onVerificationCodeChange,
      onBackToRegistration,
    } = this.props

    return (
      <AuthPageLayout isDark={isDark} toggleTheme={toggleTheme}>
        <LoginCard isDark={isDark}>
          <div className="mb-5 hidden sm:block">
            <AuthBackLink to={ROUTES.LOGIN} label={t('auth.register.backToLogin')} isDark={isDark} />
          </div>

          <PageHeader
            title={showVerification ? t('auth.register.verificationTitle') : t('auth.register.title')}
            subtitle={showVerification ? t('auth.register.verificationSubtitle') : t('auth.register.subtitle')}
            isDark={isDark}
            compact
          />

          <ErrorMessage message={error} isDark={isDark} className="mb-4 !rounded-xl !p-3 !text-sm" />
          <SuccessMessage message={success} isDark={isDark} className="mb-4 !rounded-xl !p-3 !text-sm" />

          {!showVerification ? (
            <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  id="name"
                  label={t('auth.register.nameLabel')}
                  type="text"
                  placeholder={t('auth.register.namePlaceholder')}
                  icon={UserCircle}
                  register={register('name', {
                    required: ERROR_MESSAGES.REQUIRED_FIELD,
                    minLength: { value: 2, message: 'Name must be at least 2 characters' },
                  })}
                  autoComplete="name"
                  isDark={isDark}
                  error={errors.name}
                />

                <InputField
                  id="username"
                  label={t('auth.register.usernameLabel')}
                  type="text"
                  placeholder={t('auth.register.usernamePlaceholder')}
                  icon={User}
                  register={register('username', {
                    required: ERROR_MESSAGES.REQUIRED_FIELD,
                    minLength: {
                      value: 3,
                      message: t('messages.validation.usernameMinLength'),
                    },
                  })}
                  autoComplete="username"
                  isDark={isDark}
                  error={errors.username}
                />
              </div>

              <InputField
                id="email"
                label={t('auth.register.emailLabel')}
                type="email"
                placeholder={t('auth.register.emailPlaceholder')}
                icon={Mail}
                register={register('email', {
                  required: ERROR_MESSAGES.REQUIRED_FIELD,
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: ERROR_MESSAGES.INVALID_EMAIL,
                  },
                })}
                autoComplete="email"
                isDark={isDark}
                error={errors.email}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  id="password"
                  label={t('auth.register.passwordLabel')}
                  type="password"
                  placeholder={t('auth.register.passwordPlaceholder')}
                  icon={Lock}
                  register={register('password', {
                    required: ERROR_MESSAGES.REQUIRED_FIELD,
                    minLength: { value: 6, message: ERROR_MESSAGES.PASSWORD_TOO_SHORT },
                  })}
                  autoComplete="new-password"
                  isDark={isDark}
                  error={errors.password}
                />

                <InputField
                  id="confirmPassword"
                  label={t('auth.register.confirmPasswordLabel')}
                  type="password"
                  placeholder={t('auth.register.confirmPasswordPlaceholder')}
                  icon={Lock}
                  register={register('confirmPassword', {
                    required: ERROR_MESSAGES.REQUIRED_FIELD,
                    validate: (value: string) => value === password || ERROR_MESSAGES.PASSWORD_MISMATCH,
                  })}
                  autoComplete="new-password"
                  isDark={isDark}
                  error={errors.confirmPassword}
                />
              </div>

              <div className="pt-1">
                <SubmitButton loading={loading}>
                  {loading ? t('auth.register.submitButtonLoading') : t('auth.register.submitButton')}
                </SubmitButton>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className={authInfoBoxClass(isDark)}>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('auth.register.emailSentMessage')}{' '}
                  <span className="font-semibold break-all">{registeredEmail}</span>
                </p>
              </div>

              <form onSubmit={onVerifySubmit} className="space-y-5">
                <AuthCodeField
                  id="verificationCode"
                  label={t('auth.register.verificationCodeLabel')}
                  value={verificationCode}
                  onChange={onVerificationCodeChange}
                  placeholder={t('auth.register.verificationCodePlaceholder')}
                  hint={t('auth.register.verificationCodeHint')}
                  isDark={isDark}
                  icon={Shield}
                />

                <SubmitButton loading={verifying || loading} disabled={verificationCode.length < 4}>
                  {verifying ? t('auth.register.verifyButtonLoading') : t('auth.register.verifyButton')}
                </SubmitButton>
              </form>

              <div className="text-center lg:text-left">
                <button
                  type="button"
                  onClick={onBackToRegistration}
                  className={`text-sm font-medium transition-colors hover:underline ${
                    isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-700'
                  }`}
                >
                  {t('auth.register.backToRegistration')}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center lg:text-left">
            <AuthLink
              to={ROUTES.LOGIN}
              text={t('auth.register.hasAccount')}
              linkText={t('auth.register.signIn')}
              isDark={isDark}
            />
          </div>

          <div className={`mt-4 text-center text-sm sm:hidden ${authMutedTextClass(isDark)}`}>
            <AuthBackLink to={ROUTES.LOGIN} label={t('auth.register.backToLogin')} isDark={isDark} />
          </div>
        </LoginCard>
      </AuthPageLayout>
    )
  }
}

export default Renderer
