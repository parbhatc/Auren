import { Component } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Shield } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { ERROR_MESSAGES } from '../../../constants/messages'
import { t } from '../../../utils/translator'
import { ForgotPasswordProps } from '../../../types'
import AuthPageLayout from '../../layout/AuthPageLayout'
import LoginCard from '../../common/LoginCard'
import Logo from '../../common/Logo'
import InputField from '../../common/InputField'
import PageHeader from '../../common/PageHeader'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SubmitButton from '../../common/SubmitButton'
import { themeColors } from '../../../constants/theme'

class Renderer extends Component<ForgotPasswordProps> {
  render() {
    const {
      isDark,
      toggleTheme,
      error,
      success,
      resendMessage,
      sending,
      resending,
      continuing,
      resendCooldownSeconds,
      register,
      handleSubmit,
      errors,
      onSendCode,
      onCodeChange,
      onResend,
      onContinue,
      code,
      email,
    } = this.props

    const resendDisabled = resending || resendCooldownSeconds > 0 || !email.trim() || sending

    const resendLabel = resending
      ? t('auth.forgotPassword.resendButtonLoading')
      : resendCooldownSeconds > 0
        ? t('auth.forgotPassword.resendButtonCooldown', { seconds: resendCooldownSeconds })
        : t('auth.forgotPassword.resendButton')

    const continueDisabled = continuing || code.length < 4 || !email.trim()

    return (
      <AuthPageLayout isDark={isDark} toggleTheme={toggleTheme}>
        <LoginCard isDark={isDark}>
          <Logo isDark={isDark} />

          <PageHeader
            title={t('auth.forgotPassword.title')}
            subtitle={t('auth.forgotPassword.subtitle')}
            isDark={isDark}
          />

          <ErrorMessage message={error} isDark={isDark} className="mb-4" />
          <SuccessMessage message={success || resendMessage} isDark={isDark} className="mb-4" />

          <form className="space-y-5 animate-scale-in" onSubmit={handleSubmit(onSendCode)}>
            <InputField
              id="email"
              label={t('auth.forgotPassword.emailLabel')}
              type="email"
              placeholder={t('auth.forgotPassword.emailPlaceholder')}
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
                htmlFor="resetCode"
                className={`block text-sm font-medium transition-colors duration-300 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                {t('auth.forgotPassword.resetCodeLabel')}
              </label>
              <div className="relative group">
                <Shield
                  className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${
                    `group-focus-within:text-blue-400 ${isDark ? 'text-slate-500' : 'text-slate-400'}`
                  }`}
                />
                <input
                  id="resetCode"
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
                  placeholder={t('auth.forgotPassword.resetCodePlaceholder')}
                  autoComplete="one-time-code"
                />
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('auth.forgotPassword.resetCodeHint')}
              </p>
            </div>

            <SubmitButton loading={sending} disabled={sending || resending}>
              {sending
                ? t('auth.forgotPassword.submitButtonLoading')
                : t('auth.forgotPassword.submitButton')}
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

          <button
            type="button"
            onClick={onContinue}
            disabled={continueDisabled}
            className={`mt-4 w-full font-semibold py-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl bg-gradient-to-r ${themeColors.button.primary.gradient} text-white disabled:bg-gradient-to-r ${themeColors.button.primary.gradientDisabled} disabled:shadow-none ${themeColors.button.primary.shadow}`}
          >
            {continuing
              ? t('auth.forgotPassword.continueButtonLoading')
              : t('auth.forgotPassword.continueButton')}
          </button>

          <div className="mt-6 space-y-3 text-center">
            <Link
              to={ROUTES.LOGIN}
              className={`block text-sm font-medium transition-all duration-300 hover:underline ${
                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              {t('auth.forgotPassword.backToLogin')}
            </Link>
          </div>
        </LoginCard>
      </AuthPageLayout>
    )
  }
}

export default Renderer
