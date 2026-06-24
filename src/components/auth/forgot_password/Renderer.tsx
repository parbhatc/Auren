import { Component } from 'react'
import { Mail, Shield } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { ERROR_MESSAGES } from '../../../constants/messages'
import { t } from '../../../utils/translator'
import { ForgotPasswordProps } from '../../../types'
import AuthPageLayout from '../../layout/AuthPageLayout'
import LoginCard from '../../common/LoginCard'
import InputField from '../../common/InputField'
import PageHeader from '../../common/PageHeader'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SubmitButton from '../../common/SubmitButton'
import { AuthBackLink } from '../shared/AuthBackLink'
import { AuthCodeField } from '../shared/AuthCodeField'
import { authLinkClass } from '../shared/authTheme'
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
          <div className="mb-5">
            <AuthBackLink to={ROUTES.LOGIN} label={t('auth.forgotPassword.backToLogin')} isDark={isDark} />
          </div>

          <PageHeader
            title={t('auth.forgotPassword.title')}
            subtitle={t('auth.forgotPassword.subtitle')}
            isDark={isDark}
            compact
          />

          <ErrorMessage message={error} isDark={isDark} className="mb-4 !rounded-xl !p-3 !text-sm" />
          <SuccessMessage message={success || resendMessage} isDark={isDark} className="mb-4 !rounded-xl !p-3 !text-sm" />

          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit(onSendCode)}>
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

            <AuthCodeField
              id="resetCode"
              label={t('auth.forgotPassword.resetCodeLabel')}
              value={code}
              onChange={onCodeChange}
              placeholder={t('auth.forgotPassword.resetCodePlaceholder')}
              hint={t('auth.forgotPassword.resetCodeHint')}
              isDark={isDark}
              icon={Shield}
            />

            <div className="space-y-3 pt-1">
              <SubmitButton loading={sending} disabled={sending || resending}>
                {sending
                  ? t('auth.forgotPassword.submitButtonLoading')
                  : t('auth.forgotPassword.submitButton')}
              </SubmitButton>

              <button
                type="button"
                onClick={onResend}
                disabled={resendDisabled}
                className={`w-full text-sm font-medium transition-colors ${
                  resendDisabled
                    ? isDark
                      ? 'text-slate-500 cursor-not-allowed'
                      : 'text-slate-400 cursor-not-allowed'
                    : `${authLinkClass(isDark)} hover:underline`
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
            className={`mt-4 w-full font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-105 active:scale-[0.99] shadow-lg hover:shadow-xl bg-gradient-to-r ${themeColors.button.primary.gradient} text-white disabled:bg-gradient-to-r ${themeColors.button.primary.gradientDisabled} disabled:shadow-none ${themeColors.button.primary.shadow}`}
          >
            {continuing
              ? t('auth.forgotPassword.continueButtonLoading')
              : t('auth.forgotPassword.continueButton')}
          </button>
        </LoginCard>
      </AuthPageLayout>
    )
  }
}

export default Renderer
