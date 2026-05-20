import { Component } from 'react'
import { Link } from 'react-router-dom'
import { getThemeColors } from '../../constants/theme'
import { AuthLinkProps } from '../../types/common'

class AuthLink extends Component<AuthLinkProps> {
  render() {
    const { to, text, linkText, isDark } = this.props
    const colors = getThemeColors(isDark)

    return (
      <p
        className={`text-sm transition-colors duration-500 ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}
      >
        {text}{' '}
        <Link
          to={to}
          className={`font-medium transition-all duration-300 hover:underline ${colors.link}`}
        >
          {linkText}
        </Link>
      </p>
    )
  }
}

export default AuthLink
