import type { ReactNode } from 'react'
import { appPageBackground } from '../../../styles/aurenTheme'
import BacktesterNav, { type BacktesterTab } from './BacktesterNav'

export default function BacktesterPageShell({
  isDark,
  toggleTheme,
  navigate,
  activeTab,
  showAdmin = false,
  onLogout,
  children,
}: {
  isDark: boolean
  toggleTheme: () => void
  navigate: (path: string) => void
  activeTab: BacktesterTab
  showAdmin?: boolean
  onLogout?: () => void
  children: ReactNode
}) {
  return (
    <div className={appPageBackground(isDark)}>
      <BacktesterNav
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        activeTab={activeTab}
        showAdmin={showAdmin}
        onLogout={onLogout}
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  )
}
