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
      className={`min-h-screen flex flex-col lg:flex-row ${
        isDark ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-50 via-indigo-50/40 to-white'
      }`}
    >
      <AuthBrandPanel isDark={isDark} />

      <div className="relative flex flex-1 flex-col min-h-screen lg:min-h-0">
        <div className="absolute top-4 right-4 z-20 sm:top-5 sm:right-5">
          <PracticeHeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
        </div>

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-12 lg:px-12 lg:py-16">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
