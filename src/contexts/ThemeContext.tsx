import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const THEME_STORAGE_KEY = 'auren-theme'
const APPEARANCE_STORAGE_KEY = 'auren-appearance'
export type ThemeMode = 'dark' | 'light' | 'system'
export type AppearancePreset = 'black' | 'graphite' | 'slate'

function readPreference<T extends string>(key: string, values: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key) as T
    return values.includes(value) ? value : fallback
  } catch {
    return fallback
  }
}

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  appearancePreset: AppearancePreset
  setAppearancePreset: (preset: AppearancePreset) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    readPreference<ThemeMode>(THEME_STORAGE_KEY, ['dark', 'light', 'system'], 'dark'))
  const [appearancePreset, setAppearancePreset] = useState<AppearancePreset>(() =>
    readPreference<AppearancePreset>(APPEARANCE_STORAGE_KEY, ['black', 'graphite', 'slate'], 'black'))
  const [systemDark, setSystemDark] = useState(() =>
    typeof window === 'undefined' || window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isDark = themeMode === 'system' ? systemDark : themeMode === 'dark'

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    update()
    media.addEventListener('change', update)
    const sync = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== APPEARANCE_STORAGE_KEY && event.key !== null) return
      // Read one preference snapshot before our persistence effect writes either
      // key, including when another tab changed both in the same interaction.
      setThemeMode(readPreference<ThemeMode>(THEME_STORAGE_KEY, ['dark', 'light', 'system'], 'dark'))
      setAppearancePreset(readPreference<AppearancePreset>(APPEARANCE_STORAGE_KEY, ['black', 'graphite', 'slate'], 'black'))
    }
    window.addEventListener('storage', sync)
    return () => {
      media.removeEventListener('change', update)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.dataset.appearance = appearancePreset
    root.style.colorScheme = isDark ? 'dark' : 'light'
    const background = getComputedStyle(root).getPropertyValue('--app-bg').trim() || (isDark ? '#09090B' : '#FAFAFA')
    root.style.backgroundColor = background
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    themeColor?.setAttribute('content', background)

    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode)
      localStorage.setItem(APPEARANCE_STORAGE_KEY, appearancePreset)
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error)
    }
  }, [isDark, themeMode, appearancePreset])

  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, themeMode, setThemeMode, appearancePreset, setAppearancePreset }}>
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

