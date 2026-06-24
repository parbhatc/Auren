import { ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { t } from '../../../../utils/translator'
import AdminSettings from '../../../admin/site_settings'
import RolesManager from '../../../admin/roles'
import UserManager from '../../../admin/users'
import type { HubAdminSection } from '../../../../types/practiceHub'
import {
  HUB_ADMIN_SECTIONS,
  resolveHubAdminSection,
} from './hubAdminSections'
import HubAdminSectionNav from './HubAdminSectionNav'
import HubHeroSection from './HubHeroSection'

function SectionContent({ section }: { section: HubAdminSection }) {
  switch (section) {
    case 'site':
      return <AdminSettings embedded />
    case 'roles':
      return <RolesManager embedded />
    case 'users':
      return <UserManager embedded />
  }
}

export function hubAdminSectionTitle(section: HubAdminSection): string {
  const match = HUB_ADMIN_SECTIONS.find((s) => s.id === section)
  return match ? t(match.titleKey) : t('practice.hub.nav.admin')
}

export default function HubAdminPanel({ isDark }: { isDark: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const section = resolveHubAdminSection(searchParams.get('section'))

  useEffect(() => {
    if (searchParams.get('section') === section) return
    setSearchParams({ tab: 'admin', section }, { replace: true })
  }, [searchParams, section, setSearchParams])

  const setSection = (id: HubAdminSection) => {
    setSearchParams({ tab: 'admin', section: id }, { replace: true })
  }

  return (
    <div className="space-y-7 sm:space-y-8 animate-fade-in">
      <HubHeroSection
        isDark={isDark}
        icon={ShieldCheck}
        badge={t('practice.hub.admin.badge')}
        headline={t('practice.hub.admin.headline')}
        subtitle={t('practice.hub.admin.subtitle')}
        accent="amber"
      />

      <HubAdminSectionNav section={section} onSectionChange={setSection} isDark={isDark} />

      <div
        key={section}
        className={`rounded-2xl border transition-colors duration-300 ${
          isDark
            ? 'border-slate-800/80 bg-slate-900/20'
            : 'border-slate-200/90 bg-white/60 shadow-sm'
        }`}
      >
        <SectionContent section={section} />
      </div>
    </div>
  )
}
