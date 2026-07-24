import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ProductHeader from '../../components/layout/ProductHeader'
import SettingsTabs from '../../components/settings/SettingsTabs'
import { ROUTES } from '../../constants/routes'
import { useTheme } from '../../hooks/useTheme'

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
    <div className={`auren-shell-offset min-h-screen ${isDark ? 'bg-[#09090B]' : 'bg-[#FAFAFA]'}`}>
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5">
          <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            Workspace settings
          </p>
          <h1 className={`mt-2 text-2xl font-semibold tracking-[-0.025em] ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
            Settings
          </h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
            Manage your account, market data, and workspace utilities.
          </p>
        </header>
        <SettingsTabs key={location.pathname} isDark={isDark} navigate={navigate} />
        <Outlet />
      </main>
    </div>
  )
}
