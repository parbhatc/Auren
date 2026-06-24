import { Component } from 'react'
import { PageHeaderProps } from '../../types/common'

class PageHeader extends Component<PageHeaderProps> {
  render() {
    const { title, subtitle, isDark, compact = false } = this.props

    return (
      <div
        className={`animate-slide-down text-center lg:text-left ${
          compact ? 'mb-5 sm:mb-6' : 'mb-6 sm:mb-8'
        }`}
      >
        <h2
          className={`font-bold tracking-tight ${
            compact ? 'text-xl sm:text-2xl lg:text-3xl mb-1.5' : 'text-2xl sm:text-3xl mb-2'
          } ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          {title}
        </h2>
        <p
          className={`text-sm sm:text-base leading-relaxed ${
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
