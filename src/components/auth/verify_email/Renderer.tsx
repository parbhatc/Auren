import { Component } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Shield } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { ERROR_MESSAGES } from '../../../constants/messages'
import { t } from '../../../utils/translator'
import { VerifyEmailProps } from '../../../types'
import AuthPageLayout from '../../layout/AuthPageLayout'
import LoginCard from '../../common/LoginCard'
import Logo from '../../common/Logo'
import InputField from '../../common/InputField'
import PageHeader from '../../common/PageHeader'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SubmitButton from '../../common/SubmitButton'
import AuthLink from '../../common/AuthLink'

class Renderer extends Component<VerifyEmailProps> {
  render() {
    const {
      isDark,
      toggleTheme,
      error,
      success,
      resendMessage,
      loading,
      verifying,
      resending,
      resendCooldownSeconds,
      register,
      handleSubmit,
      errors,
      onSubmit,
      onCodeChange,
      onResend,
      code,
      email,
    } = this.props

    const resendDisabled =
      resending || resendCooldownSeconds > 0 || !email.trim()

    const resendLabel = resending
      ? t('auth.verifyEmail.resendButtonLoading')
      : resendCooldownSeconds > 0
        ? t('auth.verifyEmail.resendButtonCooldown', { seconds: resendCooldownSeconds })
        : t('auth.verifyEmail.resendButton')

    return (
      <AuthPageLayout isDark={isDark} toggleTheme={toggleTheme}>
        <LoginCard isDark={isDark}>
          <Logo isDark={isDark} />

          <PageHeader
            title={t('auth.verifyEmail.title')}
            subtitle={t('auth.verifyEmail.subtitle')}
            isDark={isDark}
          />

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
              {t('auth.verifyEmail.backToLogin')}
            </Link>
          </div>

          <ErrorMessage message={error} isDark={isDark} className="mb-4" />
          <SuccessMessage message={success || resendMessage} isDark={isDark} className="mb-4" />

          <form className="space-y-5 animate-scale-in" onSubmit={handleSubmit(onSubmit)}>
            <InputField
              id="email"
              label={t('auth.verifyEmail.emailLabel')}
              type="email"
              placeholder={t('auth.verifyEmail.emailPlaceholder')}
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

            <div className="space-y-2">
              <label
                htmlFor="verificationCode"
                className={`block text-sm font-medium transition-colors duration-300 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                {t('auth.verifyEmail.verificationCodeLabel')}
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
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3 rounded-lg outline-none transition-all duration-300 border focus:shadow-lg focus:border-blue-500 focus:shadow-blue-500/20 ${
                    isDark
                      ? 'bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:bg-slate-800'
                      : 'bg-white/80 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                  }`}
                  placeholder={t('auth.verifyEmail.verificationCodePlaceholder')}
                  autoComplete="one-time-code"
                />
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('auth.verifyEmail.verificationCodeHint')}
              </p>
              {errors.code && (
                <p className="text-sm text-red-500">{errors.code.message as string}</p>
              )}
            </div>

            <SubmitButton loading={verifying || loading} disabled={code.length < 4}>
              {verifying || loading
                ? t('auth.verifyEmail.submitButtonLoading')
                : t('auth.verifyEmail.submitButton')}
            </SubmitButton>

            <div className="text-center">
              <button
                type="button"
                onClick={onResend}
                disabled={resendDisabled}
                className={`text-sm font-medium transition-all duration-300 ${
                  resendDisabled
                    ? isDark
                      ? 'text-slate-500 cursor-not-allowed'
                      : 'text-slate-400 cursor-not-allowed'
                    : isDark
                      ? 'text-blue-400 hover:text-blue-300 hover:underline'
                      : 'text-blue-600 hover:text-blue-700 hover:underline'
                }`}
              >
                {resendLabel}
              </button>
            </div>
          </form>

          <div className="mt-6 space-y-3 text-center">
            <AuthLink
              to={ROUTES.REGISTER}
              text={t('auth.verifyEmail.noAccount')}
              linkText={t('auth.verifyEmail.signUp')}
              isDark={isDark}
            />
          </div>
        </LoginCard>
      </AuthPageLayout>
    )
  }
}

export default Renderer
