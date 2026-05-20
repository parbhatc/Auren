import { Component } from 'react'
import { PageHeaderProps } from '../../types/common'

class PageHeader extends Component<PageHeaderProps> {
  render() {
    const { title, subtitle, isDark } = this.props

    return (
      <div className="text-center mb-6 sm:mb-8 animate-slide-down">
        <h2
          className={`text-xl sm:text-2xl font-bold mb-2 transition-colors duration-500 bg-clip-text text-transparent animate-gradient ${
            isDark
              ? 'bg-gradient-to-r from-white via-blue-200 to-white'
              : 'bg-gradient-to-r from-slate-900 via-blue-600 to-slate-900'
          }`}
          style={{ backgroundSize: '200% 200%' }}
        >
          {title}
        </h2>
        <p
          className={`text-sm sm:text-base transition-colors duration-500 ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          {subtitle}
        </p>
      </div>
    )
  }
}

export default PageHeader
