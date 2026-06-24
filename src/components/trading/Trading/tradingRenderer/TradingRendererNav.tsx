import TradingNav from '../../../common/TradingNav'
import { ROUTES } from '../../../../constants/routes'

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
  return (
    <>
      <div
        className={`hidden lg:block transition-all duration-300 ease-in-out ${
          showNav ? `${navWidth} opacity-100` : 'w-0 opacity-0 overflow-hidden'
        }`}
      >
        {showNav && (
          <TradingNav
            compact={terminalShell}
            isDark={isDark}
            navigate={navigate}
            currentPath={window.location.pathname}
            onToggleNav={onHideNav}
            showDesktopNav={true}
            showMobileNav={false}
          />
        )}
      </div>

      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 transition-all duration-300 ease-in-out transform z-50 ${
          showNav ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        {showNav && (
          <TradingNav
            compact={terminalShell}
            isDark={isDark}
            navigate={navigate}
            currentPath={window.location.pathname}
            onToggleNav={onHideNav}
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
