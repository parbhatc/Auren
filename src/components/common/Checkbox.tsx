import { Component } from 'react'
import { CheckboxProps } from '../../types/common'

/**
 * Checkbox component
 * A styled checkbox with label support
 */
class Checkbox extends Component<CheckboxProps> {
  render() {
    const {
      checked,
      onChange,
      label,
      disabled = false,
      className = '',
      size = 'md',
      isDark,
    } = this.props

    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
    }

    return (
      <label
        className={`flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
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
            className={`${sizeClasses[size]} rounded border-2 transition-all duration-200 flex items-center justify-center ${
              checked
                ? isDark
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-blue-500 border-blue-500'
                : isDark
                ? 'bg-slate-800 border-slate-600'
                : 'bg-white border-slate-300'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            {checked && (
              <svg
                className={`${sizeClasses[size]} text-white`}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
        {label && (
          <span
            className={`text-sm ${
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

export default Checkbox
