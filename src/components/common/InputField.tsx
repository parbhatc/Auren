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
    } = this.props

    const hasError = !!error

    return (
      <div className="space-y-2">
        <label
          htmlFor={id}
          className={`block text-sm font-medium transition-colors duration-300 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          {label}
        </label>
        <div className="relative group">
          {Icon && (
          <Icon
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${
              hasError
                ? 'text-red-400'
                : `group-focus-within:text-blue-400 ${isDark ? 'text-slate-500' : 'text-slate-400'}`
            }`}
          />
          )}
          <input
            id={id}
            type={type}
            className={`w-full ${Icon ? 'pl-12' : 'pl-4'} pr-4 py-3 rounded-lg outline-none transition-all duration-300 disabled:cursor-not-allowed border focus:shadow-lg ${
              hasError
                ? 'border-red-500 focus:border-red-500 focus:shadow-red-500/20'
                : 'focus:border-blue-500 focus:shadow-blue-500/20'
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
            className={`text-sm mt-1 transition-colors duration-300 ${
              isDark ? 'text-red-400' : 'text-red-600'
            }`}
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
