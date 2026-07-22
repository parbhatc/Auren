import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { t } from '../../utils/translator'
import { appPageBackground } from '../../styles/aurenTheme'
import SettingsTabs from '../settings/SettingsTabs'
import ProductHeader from './ProductHeader'

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
              isDark ? 'text-slate-400 hover:text-blue-300' : 'text-slate-600 hover:text-blue-700'
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
                  isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
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
    <div className={`auren-shell-offset ${appPageBackground(isDark)}`}>
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />

      <main className={`${maxWidth} mx-auto px-4 sm:px-6 py-6 sm:py-8`}>
        <header className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            {Icon ? (
              <div
                className={`p-2.5 rounded-xl ${
                  isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
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

