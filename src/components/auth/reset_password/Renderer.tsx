import { Component } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Shield } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { ERROR_MESSAGES } from '../../../constants/messages'
import { t } from '../../../utils/translator'
import { ResetPasswordProps } from '../../../types'
import AuthPageLayout from '../../layout/AuthPageLayout'
import LoginCard from '../../common/LoginCard'
import Logo from '../../common/Logo'
import InputField from '../../common/InputField'
import PageHeader from '../../common/PageHeader'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SubmitButton from '../../common/SubmitButton'

/**
 * Reset Password page renderer component
 * Handles password reset with code from email link
 */
class Renderer extends Component<ResetPasswordProps> {
  render() {
    const {
      isDark,
      toggleTheme,
      error,
      success,
      loading,
      verifying,
      codeValid,
      code,
      email,
      register,
      handleSubmit,
      errors,
      password,
      onSubmit,
    } = this.props

    return (
      <AuthPageLayout isDark={isDark} toggleTheme={toggleTheme}>
        <LoginCard isDark={isDark}>
          <Logo isDark={isDark} />

          <PageHeader
            title={t('auth.resetPassword.title')}
            subtitle={t('auth.resetPassword.subtitle')}
            isDark={isDark}
          />

          <ErrorMessage message={error} isDark={isDark} className="mb-4" />
          <SuccessMessage message={success} isDark={isDark} className="mb-4" />

          {verifying ? (
            <div className="text-center py-8">
              <div
                className={`animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4 ${
                  isDark ? 'border-blue-400' : 'border-blue-600'
                }`}
              ></div>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('auth.resetPassword.verifying')}
              </p>
            </div>
          ) : codeValid && code && email ? (
            <form className="space-y-5 animate-scale-in" onSubmit={handleSubmit(onSubmit)}>
              <div
                className={`p-4 rounded-lg border ${
                  isDark ? 'bg-blue-950/20 border-blue-700/50' : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  <p className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                    {t('auth.resetPassword.codeVerified')}
                  </p>
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {decodeURIComponent(email)}
                </p>
              </div>

              <InputField
                id="password"
                label={t('auth.resetPassword.passwordLabel')}
                type="password"
                placeholder={t('auth.resetPassword.passwordPlaceholder')}
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
                label={t('auth.resetPassword.confirmPasswordLabel')}
                type="password"
                placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                icon={Lock}
                register={register('confirmPassword', {
                  required: ERROR_MESSAGES.REQUIRED_FIELD,
                  validate: (value: string) => value === password || ERROR_MESSAGES.PASSWORD_MISMATCH,
                })}
                autoComplete="new-password"
                isDark={isDark}
                error={errors.confirmPassword}
              />

              <SubmitButton loading={loading} disabled={!!success}>
                {loading
                  ? t('auth.resetPassword.submitButtonLoading')
                  : success
                    ? t('auth.resetPassword.submitButtonSuccess')
                    : t('auth.resetPassword.submitButton')}
              </SubmitButton>
            </form>
          ) : (
            <div className="text-center">
              <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('auth.resetPassword.invalidLink')}
              </p>
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className={`inline-block text-sm font-medium transition-all duration-300 hover:underline ${
                  isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                {t('auth.resetPassword.requestNewLink')}
              </Link>
            </div>
          )}

          <div className="mt-6 space-y-3 text-center">
            <Link
              to={ROUTES.LOGIN}
              className={`block text-sm font-medium transition-all duration-300 hover:underline ${
                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              {t('auth.resetPassword.backToLogin')}
            </Link>
          </div>
        </LoginCard>
      </AuthPageLayout>
    )
  }
}

export default Renderer

