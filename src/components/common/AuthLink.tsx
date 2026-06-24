import { Component } from 'react'
import { Link } from 'react-router-dom'
import { AuthLinkProps } from '../../types/common'
import { authLinkClass } from '../auth/shared/authTheme'

class AuthLink extends Component<AuthLinkProps> {
  render() {
    const { to, text, linkText, isDark } = this.props

    return (
      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {text}{' '}
        <Link to={to} className={`font-semibold transition-colors hover:underline ${authLinkClass(isDark)}`}>
          {linkText}
        </Link>
      </p>
    )
  }
}

export default AuthLink
