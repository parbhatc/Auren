import TradingNav from '../../../common/TradingNav'
import { ROUTES } from '../../../../constants/routes'
import { isPwaPinnedNav } from '../../../../utils/pwa'

type TradingRendererNavProps = {
  showNav: boolean
  terminalShell: boolean
  navWidth: string
  isDark: boolean
  navigate: (path: string) => void
  padSessionId: string | null
  liveMode: boolean
  practiceMobileOrderOpen: boolean
  practiceMobileSettingsOpen: boolean
  showMobileSettings: boolean
  onHideNav: () => void
  onToggleMobileOrder: () => void
  onToggleMobileSettings: () => void
}

export function TradingRendererNav({
  showNav,
  terminalShell,
  navWidth,
  isDark,
  navigate,
  padSessionId,
  liveMode,
  practiceMobileOrderOpen,
  practiceMobileSettingsOpen,
  showMobileSettings,
  onHideNav,
  onToggleMobileOrder,
  onToggleMobileSettings,
}: TradingRendererNavProps) {
  const pinMobileNav = isPwaPinnedNav()
  const mobileNavVisible = showNav || pinMobileNav

  return (
    <>
      {/* No nav rail on desktop — navigation lives in the header; the bottom bar is mobile-only. */}

      <div
        className={`lg:hidden auren-mobile-bottom-bar transition-all duration-300 ease-in-out transform z-50 ${
          mobileNavVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        {mobileNavVisible && (
          <TradingNav
            compact={terminalShell}
            isDark={isDark}
            navigate={navigate}
            currentPath={window.location.pathname}
            onToggleNav={pinMobileNav ? undefined : onHideNav}
            showDesktopNav={false}
            showMobileNav={true}
            onPracticeOrder={
              terminalShell && padSessionId ? onToggleMobileOrder : undefined
            }
            practiceOrderActive={practiceMobileOrderOpen}
            onPracticeSettings={
              showMobileSettings ? onToggleMobileSettings : undefined
            }
            practiceSettingsActive={practiceMobileSettingsOpen}
            showMobileSettings={showMobileSettings}
            mobileHomePath={liveMode ? `${ROUTES.HOME}?mode=live` : ROUTES.HOME}
          />
        )}
      </div>
    </>
  )
}
