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
      { path: ROUTES.KEYBOARD_SHORTCUTS_SETTINGS, label: t('practice.hub.settings.shortcutsTitle') },
    ]

    return (
      <nav
        className="mb-6 overflow-x-auto"
        aria-label="Settings"
      >
        <div
          className={`inline-flex p-1 rounded-xl gap-0.5 min-w-min ${
            isDark ? 'bg-slate-900/90 ring-1 ring-slate-800' : 'bg-slate-100/90 ring-1 ring-slate-200/80'
          }`}
        >
          {tabs.map((tab) => {
            const isActive = currentPath === tab.path
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? isDark
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                      : 'bg-white text-violet-700 shadow-sm'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
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
