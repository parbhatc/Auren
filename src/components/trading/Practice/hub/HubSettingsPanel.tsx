import { ChevronRight, Keyboard, Sliders, User, Wifi } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { panelCardClass } from '../../../../styles/aurenTheme'
import { t } from '../../../../utils/translator'
import { CenteredPanel } from '../../../ui/PanelCard'
import AccountSettings from '../../../settings/account'
import PropFirmsSettings from '../../../settings/prop_firms'
import UtilsSettings from '../../../settings/utils'
import KeyboardShortcutsSettings from '../../../settings/keyboard_shortcuts'
import type { HubSettingsSection } from '../../../../types/practiceHub'

export type { HubSettingsSection } from '../../../../types/practiceHub'

const SECTIONS: {
  id: HubSettingsSection
  icon: typeof User
  titleKey: string
  descKey: string
}[] = [
  { id: 'account', icon: User, titleKey: 'settings.accountTab', descKey: 'practice.hub.settings.accountDesc' },
  { id: 'market', icon: Wifi, titleKey: 'settings.marketDataTab', descKey: 'practice.hub.settings.marketDesc' },
  {
    id: 'shortcuts',
    icon: Keyboard,
    titleKey: 'practice.hub.settings.shortcutsTitle',
    descKey: 'practice.hub.settings.shortcutsDesc',
  },
  { id: 'utils', icon: Sliders, titleKey: 'practice.hub.settings.utilsTitle', descKey: 'practice.hub.settings.utilsDesc' },
]

function parseSection(value: string | null): HubSettingsSection | null {
  if (value === 'account' || value === 'market' || value === 'shortcuts' || value === 'utils') {
    return value
  }
  return null
}

function SectionContent({
  section,
  onBack,
}: {
  section: HubSettingsSection
  onBack: () => void
}) {
  switch (section) {
    case 'account':
      return <AccountSettings embedded onBack={onBack} />
    case 'market':
      return <PropFirmsSettings embedded onBack={onBack} />
    case 'shortcuts':
      return <KeyboardShortcutsSettings embedded onBack={onBack} />
    case 'utils':
      return <UtilsSettings embedded onBack={onBack} />
  }
}

export default function HubSettingsPanel({ isDark }: { isDark: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const section = parseSection(searchParams.get('section'))
  const card = panelCardClass(isDark)
  const viewKey = section ?? 'grid'

  const openSection = (id: HubSettingsSection) => {
    setSearchParams({ tab: 'settings', section: id }, { replace: true })
  }

  const backToGrid = () => {
    setSearchParams({ tab: 'settings' }, { replace: true })
  }

  return (
    <CenteredPanel maxWidth="max-w-2xl">
      <div key={viewKey} className="animate-fade-in">
        {section ? (
          <SectionContent section={section} onBack={backToGrid} />
        ) : (
          <>
            <div className="mb-6 text-center sm:text-left">
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('practice.hub.nav.settings')}
              </h2>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('practice.hub.settings.subtitle')}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {SECTIONS.map(({ id, icon: Icon, titleKey, descKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openSection(id)}
                  className={`group text-left ${card} !p-4 transition-all duration-200 hover:ring-violet-500/30 active:scale-[0.99] ${
                    isDark ? 'hover:bg-slate-900/90' : 'hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 transition-colors ${
                        isDark
                          ? 'bg-violet-500/15 text-violet-400 group-hover:bg-violet-500/20'
                          : 'bg-violet-100 text-violet-600'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {t(titleKey)}
                        </h3>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${
                            isDark ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        />
                      </div>
                      <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                        {t(descKey)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </CenteredPanel>
  )
}

