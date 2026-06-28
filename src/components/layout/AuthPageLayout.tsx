import type { ReactNode } from 'react'
import { PracticeHeaderThemeButton } from '../trading/shared/header/HeaderThemeButton'
import { AuthBrandPanel } from '../auth/shared/AuthBrandPanel'

export default function AuthPageLayout({
  isDark,
  toggleTheme,
  children,
}: {
  isDark: boolean
  toggleTheme: () => void
  children: ReactNode
}) {
  return (
    <div
      className={`min-h-screen min-h-[100dvh] flex flex-col lg:flex-row ${
        isDark ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-50 via-indigo-50/40 to-white'
      }`}
    >
      <AuthBrandPanel isDark={isDark} />

      <div className="relative flex flex-1 flex-col min-h-screen min-h-[100dvh] lg:min-h-0">
        <div className="absolute z-20 right-[max(1rem,env(safe-area-inset-right,0px))] top-[calc(1rem+env(safe-area-inset-top,0px))] sm:right-[max(1.25rem,env(safe-area-inset-right,0px))] sm:top-[calc(1.25rem+env(safe-area-inset-top,0px))]">
          <PracticeHeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
        </div>

        <main className="flex flex-1 items-center justify-center px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-12 lg:px-12 lg:py-16 lg:pb-12">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
