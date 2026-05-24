import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ROUTES } from '../../constants/routes'
import { t } from '../../utils/translator'
import { appHeaderShell, appPageBackground } from '../../styles/aurenTheme'
import Logo from '../common/Logo'
import { PracticeHeaderThemeButton } from '../trading/shared/header/HeaderThemeButton'
import SettingsTabs from '../settings/SettingsTabs'

export default function SettingsPageLayout({
  isDark,
  toggleTheme,
  navigate,
  title,
  subtitle,
  icon: Icon,
  children,
  maxWidth = 'max-w-3xl',
  embedded = false,
  onBack,
}: {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  title: string
  subtitle?: string
  icon?: LucideIcon
  children: ReactNode
  maxWidth?: string
  embedded?: boolean
  onBack?: () => void
}) {
  if (embedded) {
    return (
      <div className="w-full">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={`mb-5 group flex items-center gap-1 text-sm font-medium transition-colors ${
              isDark ? 'text-slate-400 hover:text-violet-300' : 'text-slate-600 hover:text-violet-700'
            }`}
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>{t('practice.hub.settings.backToAll')}</span>
          </button>
        ) : null}

        <header className="mb-4">
          <div className="flex items-start gap-3">
            {Icon ? (
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  isDark ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-100 text-violet-600'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
              {subtitle ? (
                <p className={`text-sm mt-1 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="space-y-4">{children}</div>
      </div>
    )
  }

  return (
    <div className={appPageBackground(isDark)}>
      <div className={`sticky top-0 z-50 border-b ${appHeaderShell(isDark)}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate(ROUTES.HOME)} className="shrink-0">
            <Logo isDark={isDark} compact size="sm" />
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.HOME)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('practice.trade.backToHub')}</span>
          </button>
          <PracticeHeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
        </div>
      </div>

      <main className={`${maxWidth} mx-auto px-4 sm:px-6 py-6 sm:py-8`}>
        <header className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            {Icon ? (
              <div
                className={`p-2.5 rounded-xl ${
                  isDark ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-100 text-violet-600'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
            ) : null}
            <div>
              <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {title}
              </h1>
              {subtitle ? (
                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{subtitle}</p>
              ) : null}
            </div>
          </div>
        </header>

        <SettingsTabs isDark={isDark} navigate={navigate} />

        <div className="mt-6 space-y-5 sm:space-y-6">{children}</div>
      </main>
    </div>
  )
}

