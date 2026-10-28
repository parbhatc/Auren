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
      <div className="auren-settings-page w-full">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={`mb-5 group flex items-center gap-1 text-sm font-medium transition-colors ${
              isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-zinc-600 hover:text-zinc-700'
            }`}
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>{t('practice.hub.settings.backToAll')}</span>
          </button>
        ) : null}

        <header className={`mb-6 border-b pb-5 ${isDark ? 'border-[#2B2B2B]' : 'border-[#DEDEDE]'}`}>
          <div className="flex items-start gap-3">
            {Icon ? (
              <div className={`mt-0.5 shrink-0 rounded-lg border p-2 ${isDark ? 'border-[#343434] bg-[#222222] text-[#B7B7B7]' : 'border-[#D8D8D8] bg-[#E7E7E7] text-[#696969]'}`}><Icon className="h-[18px] w-[18px]" strokeWidth={1.6} /></div>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className={`text-xl font-semibold tracking-tight ${isDark ? 'text-[#F0F0F0]' : 'text-[#2A2A2A]'}`}>{title}</h2>
              {subtitle ? (
                <p className={`mt-1 text-xs leading-5 ${isDark ? 'text-zinc-400' : 'text-[#747474]'}`}>
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="auren-settings-body space-y-5">{children}</div>
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
                  isDark ? 'bg-zinc-500/15 text-zinc-400' : 'bg-zinc-50 text-zinc-600'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
            ) : null}
            <div>
              <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {title}
              </h1>
              {subtitle ? (
                <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{subtitle}</p>
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

