import type { ReactNode } from 'react'
import { LogOut, Menu } from 'lucide-react'
import { ROUTES } from '../../constants/routes'
import Logo from './Logo'
import { PracticeHeaderThemeButton } from '../trading/shared/header/HeaderThemeButton'

/**
 * Compact app header (practice trade style) — logo, optional center slot, logout, theme.
 */
export function AppShellHeader({
  isDark,
  navigate,
  toggleTheme,
  onLogout,
  showNav,
  onShowNav,
  center,
  maxWidthClass = 'max-w-7xl',
}: {
  isDark: boolean
  navigate: (path: string) => void
  toggleTheme: () => void
  onLogout?: () => void
  showNav?: boolean
  onShowNav?: () => void
  center?: ReactNode
  maxWidthClass?: string
}) {
  const shell = isDark
    ? 'border-slate-800 bg-slate-950/95 text-slate-200'
    : 'border-slate-200 bg-white/95 text-slate-800'

  return (
    <div className={`shrink-0 z-50 sticky top-0 w-full auren-sticky-app-header ${shell}`}>
      <header
        className={`h-10 border-b border-inherit flex items-center gap-2 px-2 mx-auto w-full ${maxWidthClass}`}
      >
        {onShowNav && showNav === false && (
          <button
            type="button"
            onClick={onShowNav}
            className={`p-1.5 rounded shrink-0 ${
              isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Show navigation"
            aria-label="Show navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="shrink-0">
          <Logo isDark={isDark} compact size="sm" onClick={() => navigate(ROUTES.PRACTICE)} />
        </div>

        {center}

        <div className="flex-1 min-w-0" aria-hidden />

        <div className="flex items-center gap-0.5 shrink-0">
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className={`p-1.5 rounded ${
                isDark
                  ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800'
                  : 'text-slate-500 hover:text-red-600 hover:bg-slate-100'
              }`}
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
          <PracticeHeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
        </div>
      </header>
    </div>
  )
}
