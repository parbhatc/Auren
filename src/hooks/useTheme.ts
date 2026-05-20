import { useContext } from 'react'
import { ThemeContext } from '../contexts/ThemeContext'

/**
 * Custom hook for managing theme (dark/light mode)
 * Uses ThemeContext to share theme state across all components
 */
export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

