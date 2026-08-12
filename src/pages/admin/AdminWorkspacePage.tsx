import type { ComponentType } from 'react'
import { Settings, Shield, Users } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import AdminSettings from '../../components/admin/site_settings'
import RolesManager from '../../components/admin/roles'
import UserManager from '../../components/admin/users'
import ProductHeader from '../../components/layout/ProductHeader'
import { ROUTES } from '../../constants/routes'
import { useTheme } from '../../hooks/useTheme'
import { appPageBackground } from '../../styles/aurenTheme'

type AdminSection = 'users' | 'roles' | 'settings'

type EmbeddedAdminTool = ComponentType<{ embedded?: boolean }>

const SECTIONS: Record<AdminSection, {
  title: string
  description: string
  icon: typeof Users
  component: EmbeddedAdminTool
}> = {
  users: {
    title: 'User management',
    description: 'Create accounts, update user details, assign roles, reset passwords, and remove access.',
    icon: Users,
    component: UserManager,
  },
  roles: {
    title: 'Roles & permissions',
    description: 'Control what each role can access and review the users assigned to it.',
    icon: Shield,
    component: RolesManager,
  },
  settings: {
    title: 'Site settings',
    description: 'Manage authentication, email, signup, token, and security configuration.',
    icon: Settings,
    component: AdminSettings,
  },
}

const ADMIN_TABS = [
  { label: 'Users', path: ROUTES.USER_MANAGER, icon: Users },
  { label: 'Roles & permissions', path: ROUTES.PERMISSION_MANAGER, icon: Shield },
  { label: 'Site settings', path: ROUTES.ADMIN_SETTINGS, icon: Settings },
]

export default function AdminWorkspacePage({ section }: { section: AdminSection }) {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const config = SECTIONS[section]
  const Icon = config.icon
  const Tool = config.component

  return (
    <div className={`auren-shell-offset ${appPageBackground(isDark)}`}>
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6">
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            Administration
          </p>
          <div className="mt-2 flex items-start gap-3">
            <div className={`mt-0.5 rounded-xl p-2.5 ${isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className={`text-2xl font-semibold tracking-[-0.025em] sm:text-3xl ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
                {config.title}
              </h1>
              <p className={`mt-1.5 max-w-3xl text-sm leading-6 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
                {config.description}
              </p>
            </div>
          </div>
        </header>

        <nav
          aria-label="Administration sections"
          className={`mb-5 flex gap-1 overflow-x-auto rounded-xl border p-1 ${
            isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'
          }`}
        >
          {ADMIN_TABS.map((tab) => {
            const active = location.pathname === tab.path
            const TabIcon = tab.icon
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? isDark
                      ? 'bg-[#27272A] text-white'
                      : 'bg-[#F4F4F5] text-[#09090B]'
                    : isDark
                      ? 'text-[#A1A1AA] hover:bg-[#27272A]/70 hover:text-white'
                      : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'
                }`}
              >
                <TabIcon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            )
          })}
        </nav>

        <section className={`overflow-hidden rounded-xl border ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'}`}>
          <Tool embedded />
        </section>
      </main>
    </div>
  )
}
