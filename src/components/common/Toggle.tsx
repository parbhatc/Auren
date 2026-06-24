import { Component } from 'react'
import { ToggleProps } from '../../types/common'

/**
 * Toggle/Checkbox component
 * A styled toggle switch that can be used as a checkbox
 */
class Toggle extends Component<ToggleProps> {
  render() {
    const {
      checked,
      onChange,
      label,
      disabled = false,
      className = '',
      size = 'md',
      isDark,
      accent = 'blue',
    } = this.props

    const sizeClasses = {
      sm: 'w-8 h-4',
      md: 'w-11 h-6',
      lg: 'w-14 h-7',
    }

    const dotSizeClasses = {
      sm: 'w-3 h-3',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
    }

    const translateClasses = {
      sm: checked ? 'translate-x-4' : 'translate-x-0',
      md: checked ? 'translate-x-5' : 'translate-x-0',
      lg: checked ? 'translate-x-7' : 'translate-x-0',
    }

    return (
      <label
        className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <div className="relative inline-flex items-center">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="sr-only"
          />
          <div
            className={`${sizeClasses[size]} rounded-full transition-all duration-300 ${
              checked
                ? accent === 'amber'
                  ? isDark
                    ? 'bg-amber-600'
                    : 'bg-amber-500'
                  : isDark
                    ? 'bg-blue-600'
                    : 'bg-blue-500'
                : isDark
                  ? 'bg-slate-700'
                  : 'bg-slate-300'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <div
              className={`${dotSizeClasses[size]} absolute top-0.5 left-0.5 rounded-full bg-white transition-transform duration-300 ${translateClasses[size]} shadow-md`}
            />
          </div>
        </div>
        {label && (
          <span
            className={`text-sm font-medium ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {label}
          </span>
        )}
      </label>
    )
  }
}

export default Toggle
