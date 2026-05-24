import { Component } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Lock, User, Shield, UserCircle } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { ERROR_MESSAGES } from '../../../constants/messages'
import { t } from '../../../utils/translator'
import { RegisterProps } from '../../../types'
import AuthPageLayout from '../../layout/AuthPageLayout'
import LoginCard from '../../common/LoginCard'
import Logo from '../../common/Logo'
import InputField from '../../common/InputField'
import PageHeader from '../../common/PageHeader'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SubmitButton from '../../common/SubmitButton'
import AuthLink from '../../common/AuthLink'

/**
 * Register page renderer component
 * Handles new user registration with validation and email verification
 */
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
          <Logo isDark={isDark} />

          <PageHeader
            title={showVerification ? t('auth.register.verificationTitle') : t('auth.register.title')}
            subtitle={showVerification ? t('auth.register.verificationSubtitle') : t('auth.register.subtitle')}
            isDark={isDark}
          />

          {/* Back to Login Link */}
          <div className="mb-4 text-center">
            <Link
              to={ROUTES.LOGIN}
              className={`inline-flex items-center gap-2 text-sm font-medium transition-all duration-300 hover:underline ${
                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('auth.register.backToLogin')}
            </Link>
          </div>

          <ErrorMessage message={error} isDark={isDark} className="mb-4" />
          <SuccessMessage message={success} isDark={isDark} className="mb-4" />

          {!showVerification ? (
            <form className="space-y-5 animate-scale-in" onSubmit={handleSubmit(onSubmit)}>
              <InputField
                id="name"
                label={t('auth.register.nameLabel')}
                type="text"
                placeholder={t('auth.register.namePlaceholder')}
                icon={UserCircle}
                register={register('name', {
                  required: ERROR_MESSAGES.REQUIRED_FIELD,
                  minLength: {
                    value: 2,
                    message: 'Name must be at least 2 characters',
                  },
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

              <InputField
                id="password"
                label={t('auth.register.passwordLabel')}
                type="password"
                placeholder={t('auth.register.passwordPlaceholder')}
                icon={Lock}
                register={register('password', {
                  required: ERROR_MESSAGES.REQUIRED_FIELD,
                  minLength: {
                    value: 6,
                    message: ERROR_MESSAGES.PASSWORD_TOO_SHORT,
                  },
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

              <SubmitButton loading={loading}>
                {loading ? t('auth.register.submitButtonLoading') : t('auth.register.submitButton')}
              </SubmitButton>
            </form>
          ) : (
            <div className="space-y-5 animate-scale-in">
              <div
                className={`p-4 rounded-lg border ${
                  isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50 border-blue-200'
                }`}
              >
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('auth.register.emailSentMessage')} <span className="font-semibold">{registeredEmail}</span>
                </p>
              </div>

              <form onSubmit={onVerifySubmit} className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="verificationCode"
                    className={`block text-sm font-medium transition-colors duration-300 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {t('auth.register.verificationCodeLabel')}
                  </label>
                  <div className="relative group">
                    <Shield
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${
                        `group-focus-within:text-blue-400 ${isDark ? 'text-slate-500' : 'text-slate-400'}`
                      }`}
                    />
                    <input
                      id="verificationCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      value={verificationCode}
                      onChange={(e) => onVerificationCodeChange(e.target.value.replace(/\D/g, ''))}
                      className={`w-full pl-12 pr-4 py-3 rounded-lg outline-none transition-all duration-300 border focus:shadow-lg focus:border-blue-500 focus:shadow-blue-500/20 ${
                        isDark
                          ? 'bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:bg-slate-800'
                          : 'bg-white/80 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                      }`}
                      placeholder={t('auth.register.verificationCodePlaceholder')}
                      autoComplete="one-time-code"
                    />
                  </div>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('auth.register.verificationCodeHint')}
                  </p>
                </div>

                <SubmitButton loading={verifying || loading} disabled={verificationCode.length < 4}>
                  {verifying ? t('auth.register.verifyButtonLoading') : t('auth.register.verifyButton')}
                </SubmitButton>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={onBackToRegistration}
                  className={`text-sm font-medium transition-all duration-300 hover:underline ${
                    isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                  }`}
                >
                  {t('auth.register.backToRegistration')}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3 text-center">
            <AuthLink
              to={ROUTES.LOGIN}
              text={t('auth.register.hasAccount')}
              linkText={t('auth.register.signIn')}
              isDark={isDark}
            />
          </div>
        </LoginCard>
      </AuthPageLayout>
    )
  }
}

export default Renderer

