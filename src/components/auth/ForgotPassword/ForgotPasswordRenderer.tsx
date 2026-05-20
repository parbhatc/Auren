import { Component } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
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

/**
 * Forgot Password page renderer component
 * Handles password reset request via email
 */
class ForgotPasswordRenderer extends Component<ForgotPasswordProps> {
  render() {
    const { isDark, toggleTheme, error, success, loading, register, handleSubmit, errors, onSubmit } = this.props

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
          <SuccessMessage message={success} isDark={isDark} className="mb-4" />

          <form className="space-y-5 animate-scale-in" onSubmit={handleSubmit(onSubmit)}>
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

            <SubmitButton loading={loading} disabled={!!success}>
              {loading
                ? t('auth.forgotPassword.submitButtonLoading')
                : success
                  ? t('auth.forgotPassword.submitButtonSuccess')
                  : t('auth.forgotPassword.submitButton')}
            </SubmitButton>
          </form>

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

export default ForgotPasswordRenderer

