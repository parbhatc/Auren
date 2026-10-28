import { Component } from 'react'
import { ROUTES } from '../../constants/routes'
import { Cable, ChevronRight, Keyboard, SlidersHorizontal, UserRound } from 'lucide-react'
import { SettingsTabsProps } from '../../types/settings'
import { prefetchRouteOnIntent } from '../../navigation/routeModules'

class SettingsTabs extends Component<SettingsTabsProps> {
  render() {
    const { navigate } = this.props
    const currentPath = window.location.pathname

    const tabs = [
      { path: ROUTES.SETTINGS, label: 'Profile & security', hint: 'Your personal details', icon: UserRound },
      { path: ROUTES.PROPS_SETTINGS, label: 'Connections', hint: 'Platforms & market data', icon: Cable },
      { path: ROUTES.UTILS_SETTINGS, label: 'Preferences', hint: 'Appearance, time & tools', icon: SlidersHorizontal },
      { path: ROUTES.KEYBOARD_SHORTCUTS_SETTINGS, label: 'Keyboard shortcuts', hint: 'Make every action faster', icon: Keyboard, desktopOnly: true },
    ]

    return (
      <nav
        className="-mx-1 overflow-x-auto p-1 lg:mx-0 lg:overflow-visible lg:p-0"
        aria-label="Settings"
      >
        <div
          className="flex min-w-min gap-1 lg:flex-col"
        >
          {tabs.map((tab) => {
            const isActive = currentPath === tab.path
            const Icon = tab.icon
            return (
              <button
                key={tab.path}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(tab.path)}
                onPointerEnter={() => prefetchRouteOnIntent(tab.path)}
                onFocus={() => prefetchRouteOnIntent(tab.path)}
                onTouchStart={() => prefetchRouteOnIntent(tab.path)}
                className={`${tab.desktopOnly ? 'hidden sm:flex' : 'flex'} min-h-11 shrink-0 items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors lg:w-full ${
                  isActive
                    ? 'border-[var(--app-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                    : 'border-transparent text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text)]'
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
                <span className="min-w-0"><span className="block whitespace-nowrap text-[13px] font-semibold">{tab.label}</span><span className="mt-1 hidden text-[11px] font-normal opacity-70 lg:block">{tab.hint}</span></span>
                {isActive ? <ChevronRight className="ml-auto hidden h-3.5 w-3.5 shrink-0 lg:block" /> : null}
              </button>
            )
          })}
        </div>
      </nav>
    )
  }
}

export default SettingsTabs
