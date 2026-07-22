import { Component } from 'react'
import { BarChart3 } from 'lucide-react'
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
            className={`bg-blue-600 transition-colors group-hover:bg-blue-500 ${
              sm ? 'rounded-lg p-1.5' : 'rounded-xl p-2 sm:p-3'
            }`}
          >
            <BarChart3
              className={`text-white ${
                sm ? 'w-4 h-4' : 'w-6 h-6 sm:w-8 sm:h-8'
              }`}
            />
          </div>
          <h1
            className={`whitespace-nowrap font-semibold tracking-tight ${
              sm ? 'text-sm' : 'text-2xl sm:text-3xl'
            } ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
          >
            Auren
          </h1>
        </div>
      </div>
    )
  }
}

export default Logo
