import { Component } from 'react'
import { themeColors } from '../../constants/theme'
import { LoadingProps } from '../../types/common'

/**
 * Loading component
 * Displays a loading spinner with optional message
 */
class Loading extends Component<LoadingProps> {
  /**
   * Get theme from localStorage or default to dark
   * Same logic as useTheme hook and ProtectedRoute
   */
  getIsDark = (): boolean => {
    try {
      const savedTheme = localStorage.getItem('auren-theme')
      if (savedTheme !== null) {
        return savedTheme === 'dark'
      }
      return true // Default to dark mode
    } catch (error) {
      return true // Default to dark mode on error
    }
  }

  render() {
    const { message, fullScreen = true, isDark } = this.props
    // If isDark is undefined, read from localStorage (same as ProtectedRoute)
    const isDarkMode = isDark !== undefined ? isDark : this.getIsDark()
    
    const borderColor = isDarkMode ? themeColors.loading.border.dark : themeColors.loading.border.light

    const content = (
      <div className="text-center">
        <div
          className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${borderColor}`}
        ></div>
        {message && (
          <p
            className={`mt-4 transition-colors duration-300 ${
              isDarkMode ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    )

    if (fullScreen) {
      return (
        <div
          className={`min-h-screen flex items-center justify-center transition-colors duration-200 ${
            isDarkMode ? 'bg-[#09090B]' : 'bg-[#FAFAFA]'
          }`}
        >
          {content}
        </div>
      )
    }

    return <div className="flex items-center justify-center p-8">{content}</div>
  }
}

export default Loading
