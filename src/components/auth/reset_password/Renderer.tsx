import { Component } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Shield } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { ERROR_MESSAGES } from '../../../constants/messages'
import { t } from '../../../utils/translator'
import { ResetPasswordProps } from '../../../types'
import AuthPageLayout from '../../layout/AuthPageLayout'
import LoginCard from '../../common/LoginCard'
import InputField from '../../common/InputField'
import PageHeader from '../../common/PageHeader'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import SubmitButton from '../../common/SubmitButton'
import { AuthBackLink } from '../shared/AuthBackLink'
import { authInfoBoxClass, authLinkClass } from '../shared/authTheme'

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
          <div className="mb-5">
            <AuthBackLink to={ROUTES.LOGIN} label={t('auth.resetPassword.backToLogin')} isDark={isDark} />
          </div>

          <PageHeader
            title={t('auth.resetPassword.title')}
            subtitle={t('auth.resetPassword.subtitle')}
            isDark={isDark}
            compact
          />

          <ErrorMessage message={error} isDark={isDark} className="mb-4 !rounded-xl !p-3 !text-sm" />
          <SuccessMessage message={success} isDark={isDark} className="mb-4 !rounded-xl !p-3 !text-sm" />

          {verifying ? (
            <div className="py-10 text-center">
              <div
                className={`mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent ${
                  isDark ? 'border-violet-400' : 'border-violet-600'
                }`}
              />
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('auth.resetPassword.verifying')}
              </p>
            </div>
          ) : codeValid && code && email ? (
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div className={authInfoBoxClass(isDark)}>
                <div className="mb-2 flex items-center gap-2">
                  <Shield className={`h-4 w-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                  <p className={`text-sm font-medium ${isDark ? 'text-violet-200' : 'text-violet-800'}`}>
                    {t('auth.resetPassword.codeVerified')}
                  </p>
                </div>
                <p className={`text-xs break-all ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
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
                  minLength: { value: 6, message: ERROR_MESSAGES.PASSWORD_TOO_SHORT },
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
            <div className="py-4 text-center lg:text-left">
              <p className={`mb-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('auth.resetPassword.invalidLink')}
              </p>
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className={`text-sm font-medium transition-colors hover:underline ${authLinkClass(isDark)}`}
              >
                {t('auth.resetPassword.requestNewLink')}
              </Link>
            </div>
          )}
        </LoginCard>
      </AuthPageLayout>
    )
  }
}

export default Renderer
