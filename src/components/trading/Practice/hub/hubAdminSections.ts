import { Settings, Shield, Users } from 'lucide-react'
import type { HubAdminSection } from '../../../../types/practiceHub'

export const DEFAULT_HUB_ADMIN_SECTION: HubAdminSection = 'site'

export const HUB_ADMIN_SECTIONS: {
  id: HubAdminSection
  icon: typeof Settings
  titleKey: string
  descKey: string
  labelKey: string
  navDescKey: string
}[] = [
  {
    id: 'site',
    icon: Settings,
    titleKey: 'admin.title',
    descKey: 'admin.subtitle',
    labelKey: 'practice.hub.admin.sections.site',
    navDescKey: 'practice.hub.admin.sections.siteDesc',
  },
  {
    id: 'roles',
    icon: Shield,
    titleKey: 'roles.title',
    descKey: 'roles.subtitle',
    labelKey: 'practice.hub.admin.sections.roles',
    navDescKey: 'practice.hub.admin.sections.rolesDesc',
  },
  {
    id: 'users',
    icon: Users,
    titleKey: 'users.title',
    descKey: 'users.subtitle',
    labelKey: 'practice.hub.admin.sections.users',
    navDescKey: 'practice.hub.admin.sections.usersDesc',
  },
]

export function parseHubAdminSection(value: string | null): HubAdminSection | null {
  if (value === 'site' || value === 'roles' || value === 'users') return value
  return null
}

export function resolveHubAdminSection(value: string | null): HubAdminSection {
  return parseHubAdminSection(value) ?? DEFAULT_HUB_ADMIN_SECTION
}
