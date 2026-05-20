import { Component } from 'react'
import { BarChart3 } from 'lucide-react'
import { themeColors } from '../../constants/theme'
import { LogoProps } from '../../types/common'

class Logo extends Component<LogoProps> {
  render() {
    const { isDark, compact = false, size = 'default', onClick } = this.props
    const sm = size === 'sm'

    return (
      <div className={`flex items-center ${compact ? 'justify-start' : 'justify-center'} ${compact ? '' : 'mb-6 sm:mb-8'}`}>
        <div
          className={`flex items-center group cursor-pointer ${sm ? 'gap-1.5' : 'gap-2 sm:gap-3'}`}
          onClick={onClick}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          onKeyDown={
            onClick
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onClick()
                  }
                }
              : undefined
          }
        >
          <div
            className={`relative bg-gradient-to-br ${themeColors.logo.gradient.icon} shadow-lg ${themeColors.logo.shadow.default} transition-all duration-500 ease-in-out group-hover:scale-110 group-hover:rotate-3 group-hover:${themeColors.logo.shadow.hover} ${
              sm ? 'rounded-lg p-1.5' : 'rounded-xl p-2 sm:p-3'
            }`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                sm ? 'rounded-lg' : 'rounded-xl'
              }`}
            />
            <BarChart3
              className={`text-white relative z-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12 ${
                sm ? 'w-4 h-4' : 'w-6 h-6 sm:w-8 sm:h-8'
              }`}
            />
            <div
              className={`absolute -inset-1 bg-gradient-to-r ${themeColors.logo.shadow.glow} blur opacity-20 group-hover:opacity-50 transition-opacity duration-300 ${
                sm ? 'rounded-lg' : 'rounded-xl'
              }`}
            />
          </div>
          <h1
            className={`
              font-bold bg-clip-text text-transparent transition-all duration-500 whitespace-nowrap
              ${sm ? 'text-sm' : 'text-2xl sm:text-3xl drop-shadow-lg group-hover:scale-105 group-hover:drop-shadow-xl'}
              ${
                isDark
                  ? `bg-gradient-to-r ${themeColors.logo.gradient.textDark} group-hover:bg-gradient-to-r ${themeColors.logo.gradient.textDarkHover}`
                  : `bg-gradient-to-r ${themeColors.logo.gradient.textLight} group-hover:bg-gradient-to-r ${themeColors.logo.gradient.textLightHover}`
              }
            `}
            style={{ backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            Auren
          </h1>
        </div>
      </div>
    )
  }
}

export default Logo
