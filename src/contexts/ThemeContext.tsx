import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const THEME_STORAGE_KEY = 'auren-theme'
const DEFAULT_THEME = true // Default to dark mode

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_THEME
    }

    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
      if (savedTheme !== null) {
        return savedTheme === 'dark'
      }
      return DEFAULT_THEME
    } catch (error) {
      console.warn('Failed to read theme from localStorage:', error)
      return DEFAULT_THEME
    }
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    document.documentElement.style.backgroundColor = isDark ? '#09090B' : '#FAFAFA'
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    themeColor?.setAttribute('content', isDark ? '#09090B' : '#FAFAFA')

    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error)
    }
  }, [isDark])

  const toggleTheme = () => {
    setIsDark((prev) => !prev)
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

