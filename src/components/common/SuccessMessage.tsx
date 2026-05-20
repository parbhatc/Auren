import { Component } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { getThemeColors } from '../../constants/theme'
import { SuccessMessageProps } from '../../types/common'

class SuccessMessage extends Component<SuccessMessageProps> {
  render() {
    const { message, isDark, className = '' } = this.props

    if (!message) return null

    const colors = getThemeColors(isDark)

    return (
      <div
        className={`p-4 rounded-lg text-sm border flex items-start gap-3 animate-slide-down ${className} ${colors.success}`}
        role="alert"
        aria-live="polite"
      >
        <CheckCircle2
          className={`flex-shrink-0 w-5 h-5 mt-0.5 ${colors.successIcon}`}
          aria-hidden="true"
        />
        <p className="flex-1 leading-relaxed">{message}</p>
      </div>
    )
  }
}

export default SuccessMessage
