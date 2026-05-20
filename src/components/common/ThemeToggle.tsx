import { Component } from 'react'
import { Sun, Moon } from 'lucide-react'
import { ThemeToggleProps } from '../../types/common'

class ThemeToggle extends Component<ThemeToggleProps> {
  render() {
    const { isDark, onToggle, fixed = true } = this.props

    return (
      <button
        onClick={onToggle}
        className={`
          ${fixed ? 'fixed top-3 right-3 sm:top-4 sm:right-4 md:top-6 md:right-6 z-40' : 'relative'} 
          p-2 sm:p-2.5 rounded-full 
          transition-all duration-500 ease-in-out
          transform hover:scale-110 active:scale-95
          shadow-lg hover:shadow-xl border
          ${
            isDark
              ? 'bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-yellow-400 border-slate-700'
              : 'bg-gradient-to-br from-yellow-400 to-orange-400 hover:from-yellow-300 hover:to-orange-300 text-slate-900 border-yellow-300'
          }
        `}
        aria-label="Toggle theme"
      >
        <div className="relative w-5 h-5">
          <Sun
            className={`absolute inset-0 w-5 h-5 transition-all duration-500 ${
              isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
            }`}
          />
          <Moon
            className={`absolute inset-0 w-5 h-5 transition-all duration-500 ${
              isDark ? 'opacity-0 -rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
            }`}
          />
        </div>
      </button>
    )
  }
}

export default ThemeToggle
