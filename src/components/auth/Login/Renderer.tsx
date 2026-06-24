import { Component } from 'react'
import { Link } from 'react-router-dom'
import { User, Lock } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { ERROR_MESSAGES } from '../../../constants/messages'
import { t } from '../../../utils/translator'
import { LoginProps } from '../../../types'
import AuthPageLayout from '../../layout/AuthPageLayout'
import LoginCard from '../../common/LoginCard'
import InputField from '../../common/InputField'
import PageHeader from '../../common/PageHeader'
import ErrorMessage from '../../common/ErrorMessage'
import SubmitButton from '../../common/SubmitButton'
import AuthLink from '../../common/AuthLink'
import { authLinkClass } from '../shared/authTheme'

class Renderer extends Component<LoginProps> {
  render() {
    const { isDark, toggleTheme, error, loading, register, handleSubmit, errors, onSubmit } = this.props

    return (
      <AuthPageLayout isDark={isDark} toggleTheme={toggleTheme}>
        <LoginCard isDark={isDark}>
          <PageHeader
            title={t('auth.login.title')}
            subtitle={t('auth.login.subtitle')}
            isDark={isDark}
            compact
          />

          <ErrorMessage message={error} isDark={isDark} className="mb-4 !rounded-xl !p-3 !text-sm" />

          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <InputField
              id="username"
              label={t('auth.login.usernameLabel')}
              type="text"
              placeholder={t('auth.login.usernamePlaceholder')}
              icon={User}
              register={register('username', {
                required: ERROR_MESSAGES.USERNAME_REQUIRED,
              })}
              autoComplete="username"
              isDark={isDark}
              error={errors.username}
            />

            <InputField
              id="password"
              label={t('auth.login.passwordLabel')}
              type="password"
              placeholder={t('auth.login.passwordPlaceholder')}
              icon={Lock}
              register={register('password', {
                required: ERROR_MESSAGES.PASSWORD_REQUIRED,
              })}
              autoComplete="current-password"
              isDark={isDark}
              error={errors.password}
            />

            <div className="pt-1">
              <SubmitButton loading={loading}>
                {loading ? t('auth.login.submitButtonLoading') : t('auth.login.submitButton')}
              </SubmitButton>
            </div>
          </form>

          <div className="mt-6 space-y-3 text-center lg:text-left">
            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className={`inline-block text-sm font-medium transition-colors hover:underline ${authLinkClass(isDark)}`}
            >
              {t('auth.login.forgotPassword')}
            </Link>
            <AuthLink
              to={ROUTES.REGISTER}
              text={t('auth.login.noAccount')}
              linkText={t('auth.login.signUp')}
              isDark={isDark}
            />
          </div>
        </LoginCard>
      </AuthPageLayout>
    )
  }
}

export default Renderer
