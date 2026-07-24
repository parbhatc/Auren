import { Component } from 'react'
import { ROUTES } from '../../constants/routes'
import { t } from '../../utils/translator'
import { SettingsTabsProps } from '../../types/settings'

class SettingsTabs extends Component<SettingsTabsProps> {
  render() {
    const { isDark, navigate } = this.props
    const currentPath = window.location.pathname

    const tabs = [
      { path: ROUTES.SETTINGS, label: t('settings.accountTab') },
      { path: ROUTES.PROPS_SETTINGS, label: t('settings.marketDataTab') },
      { path: ROUTES.UTILS_SETTINGS, label: t('practice.hub.settings.utilsTitle') },
      { path: ROUTES.KEYBOARD_SHORTCUTS_SETTINGS, label: t('practice.hub.settings.shortcutsTitle'), desktopOnly: true },
    ]

    return (
      <nav
        className="mb-6 overflow-x-auto"
        aria-label="Settings"
      >
        <div
          className={`inline-flex p-1 rounded-xl gap-0.5 min-w-min ${
            isDark ? 'border border-[#27272A] bg-[#18181B]' : 'border border-[#E4E4E7] bg-[#F4F4F5]'
          }`}
        >
          {tabs.map((tab) => {
            const isActive = currentPath === tab.path
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                className={`${tab.desktopOnly ? 'hidden sm:block' : ''} px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? isDark
                      ? 'bg-[#FAFAFA] text-[#09090B]'
                      : 'bg-[#18181B] text-white'
                    : isDark
                      ? 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                      : 'text-[#52525B] hover:text-[#09090B]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>
    )
  }
}

export default SettingsTabs
