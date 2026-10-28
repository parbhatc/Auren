import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ProductHeader from '../../components/layout/ProductHeader'
import SettingsTabs from '../../components/settings/SettingsTabs'
import { ROUTES } from '../../constants/routes'
import { useTheme } from '../../hooks/useTheme'
import './SettingsWorkspacePage.css'

export default function SettingsWorkspacePage() {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname !== ROUTES.KEYBOARD_SHORTCUTS_SETTINGS) return

    const mobile = window.matchMedia('(max-width: 639px)')
    if (mobile.matches) navigate(ROUTES.SETTINGS, { replace: true })
  }, [location.pathname, navigate])

  return (
    <div className="auren-shell-offset auren-settings-workspace min-h-screen">
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-7">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--app-accent)]">
            Your workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--app-text)]">
            Settings
          </h1>
          </div>
          <p className="pb-1 text-xs text-[var(--app-muted)]">
            A workspace that works the way you trade.
          </p>
        </header>
        <div className="grid min-w-0 gap-7 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
          <aside className="min-w-0">
            <SettingsTabs key={location.pathname} isDark={isDark} navigate={navigate} />
          </aside>
          <div className="auren-settings-content min-w-0"><Outlet /></div>
        </div>
      </main>
    </div>
  )
}
