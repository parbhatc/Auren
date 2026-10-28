import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ProductHeader from '../../components/layout/ProductHeader'
import SettingsTabs from '../../components/settings/SettingsTabs'
import { ROUTES } from '../../constants/routes'
import { useTheme } from '../../hooks/useTheme'
import { prefetchRouteOnIntent } from '../../navigation/routeModules'

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
        <section aria-labelledby="practice-accounts-settings" className={`mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
          <div>
            <h2 id="practice-accounts-settings" className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Practice accounts</h2>
            <p className={`mt-1 text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>Create simulated accounts and manage their plans and rules.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(ROUTES.PRACTICE_ACCOUNTS)}
            onPointerEnter={() => prefetchRouteOnIntent(ROUTES.PRACTICE_ACCOUNTS)}
            onFocus={() => prefetchRouteOnIntent(ROUTES.PRACTICE_ACCOUNTS)}
            onTouchStart={() => prefetchRouteOnIntent(ROUTES.PRACTICE_ACCOUNTS)}
            className={`inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium ${isDark ? 'border-[#3F3F46] text-[#FAFAFA] hover:bg-[#27272A]' : 'border-[#D4D4D8] text-[#09090B] hover:bg-[#F4F4F5]'}`}
          >
            Manage accounts
          </button>
        </section>
      </main>
    </div>
  )
}
