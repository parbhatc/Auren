import { Component } from 'react'
import { themeColors } from '../../constants/theme'
import { SubmitButtonProps } from '../../types/common'

class SubmitButton extends Component<SubmitButtonProps> {
  render() {
    const { loading, children, disabled = false, className = '' } = this.props

    return (
      <button
        type="submit"
        disabled={disabled || loading}
        className={`w-full font-semibold py-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl relative overflow-hidden bg-gradient-to-r ${themeColors.button.primary.gradient} text-white disabled:bg-gradient-to-r ${themeColors.button.primary.gradientDisabled} disabled:shadow-none ${themeColors.button.primary.shadow} ${className}`}
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 animate-shimmer"></span>
        {children}
      </button>
    )
  }
}

export default SubmitButton
