import { Component } from 'react'
import { AlertCircle } from 'lucide-react'
import { ErrorMessageProps } from '../../types/common'

class ErrorMessage extends Component<ErrorMessageProps> {
  render() {
    const { message, isDark, className = '' } = this.props

    if (!message) return null

    return (
      <div
        className={`p-4 rounded-lg text-sm border flex items-start gap-3 animate-slide-down ${className} ${
          isDark
            ? 'bg-red-950/40 text-red-300 border-red-800/50 shadow-lg shadow-red-900/20'
            : 'bg-red-50 text-red-800 border-red-300 shadow-md shadow-red-100'
        }`}
        role="alert"
        aria-live="polite"
      >
        <AlertCircle
          className={`flex-shrink-0 w-5 h-5 mt-0.5 ${
            isDark ? 'text-red-400' : 'text-red-600'
          }`}
          aria-hidden="true"
        />
        <p className="flex-1 leading-relaxed">{message}</p>
      </div>
    )
  }
}

export default ErrorMessage
