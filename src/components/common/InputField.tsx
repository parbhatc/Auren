import { Component } from 'react'
import { InputFieldProps } from '../../types/common'

class InputField extends Component<InputFieldProps> {
  render() {
    const {
      id,
      label,
      type = 'text',
      placeholder,
      icon: Icon,
      register,
      autoComplete,
      isDark,
      error,
      compact = false,
      className = '',
    } = this.props

    const hasError = !!error

    return (
      <div className={`${compact ? 'space-y-1' : 'space-y-2'} ${className}`}>
        <label
          htmlFor={id}
          className={`block font-medium transition-colors duration-300 ${
            compact ? 'text-xs' : 'text-sm'
          } ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
        >
          {label}
        </label>
        <div className="relative group">
          {Icon && (
          <Icon
            className={`absolute left-3.5 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${
              compact ? 'w-4 h-4' : 'w-5 h-5'
            } ${
              hasError
                ? 'text-red-400'
                : `group-focus-within:text-violet-400 ${isDark ? 'text-slate-500' : 'text-slate-400'}`
            }`}
          />
          )}
          <input
            id={id}
            type={type}
            className={`w-full min-w-0 max-w-full ${Icon ? 'pl-11' : 'pl-4'} pr-4 rounded-xl outline-none transition-all duration-200 disabled:cursor-not-allowed border focus:ring-2 focus:ring-violet-500/25 ${
              compact ? 'py-2.5 text-base sm:text-sm' : 'py-3 text-base'
            } ${
              hasError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'focus:border-violet-500/70'
            } ${
              isDark
                ? `${
                    hasError
                      ? 'bg-red-950/20 border-red-500 text-white placeholder-slate-500 focus:bg-red-950/30'
                      : 'bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:bg-slate-800'
                  } disabled:bg-slate-800/30`
                : `${
                    hasError
                      ? 'bg-red-50/80 border-red-400 text-slate-900 placeholder-slate-400 focus:bg-red-50'
                      : 'bg-white/80 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                  } disabled:bg-slate-100/50`
            }`}
            placeholder={placeholder}
            autoComplete={autoComplete}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
            {...register}
          />
        </div>
        {hasError && (
          <p
            id={`${id}-error`}
            className={`mt-0.5 transition-colors duration-300 line-clamp-2 ${
              compact ? 'text-xs' : 'text-sm'
            } ${isDark ? 'text-red-400' : 'text-red-600'}`}
            role="alert"
          >
            {error?.message}
          </p>
        )}
      </div>
    )
  }
}

export default InputField
