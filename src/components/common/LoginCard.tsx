import { Component } from 'react'
import { LoginCardProps } from '../../types/common'
import Logo from './Logo'
import { authFormPanelClass } from '../auth/shared/authTheme'

class LoginCard extends Component<LoginCardProps> {
  render() {
    const { isDark, children } = this.props

    return (
      <div className="w-full min-w-0 animate-fade-in">
        <div className="mb-6 flex justify-center lg:hidden">
          <Logo isDark={isDark} compact size="sm" />
        </div>

        <div className={`relative overflow-hidden p-5 sm:p-7 lg:p-0 ${authFormPanelClass(isDark)}`}>
          <div
            className={`pointer-events-none absolute inset-0 lg:hidden ${
              isDark
                ? 'bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.12)_0%,transparent_55%)]'
                : 'bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.08)_0%,transparent_55%)]'
            }`}
            aria-hidden
          />
          <div className="relative z-10">{children}</div>
        </div>
      </div>
    )
  }
}

export default LoginCard
