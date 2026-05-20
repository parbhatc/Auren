import { Component } from 'react'
import { LoginCardProps } from '../../types/common'

class LoginCard extends Component<LoginCardProps> {
  render() {
    const { isDark, children } = this.props

    return (
      <div className="w-full max-w-md animate-fade-in px-2 sm:px-0">
        <div
          className={`
            rounded-xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 
            transition-all duration-700 ease-in-out
            border relative overflow-hidden backdrop-blur-sm
            ${
              isDark
                ? 'bg-slate-900/80 border-slate-800/90 shadow-xl shadow-black/30 ring-1 ring-slate-800/50'
                : 'bg-white/95 border-slate-200/90 shadow-xl shadow-slate-200/60 ring-1 ring-slate-100'
            }
          `}
        >
          <div
            className={`absolute inset-0 opacity-30 animate-gradient bg-gradient-to-r ${
              isDark
                ? 'from-violet-600/15 via-indigo-500/10 to-violet-600/15'
                : 'from-violet-400/20 via-indigo-300/15 to-violet-400/20'
            }`}
            style={{ backgroundSize: '200% 200%' }}
          ></div>
          <div className="relative z-10">{children}</div>
        </div>
      </div>
    )
  }
}

export default LoginCard
