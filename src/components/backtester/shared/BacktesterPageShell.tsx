import type { ReactNode } from 'react'
import BacktesterNav, { type BacktesterTab } from './BacktesterNav'
import ProductHeader from '../../layout/ProductHeader'
import { workspaceThemeStyle } from '../../layout/WorkspacePrimitives'

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
    <div
      style={workspaceThemeStyle(isDark)}
      className="auren-shell-offset auren-workspace min-h-screen"
    >
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
      <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 sm:py-9 xl:px-9">
        <BacktesterNav
          isDark={isDark}
          toggleTheme={toggleTheme}
          navigate={navigate}
          activeTab={activeTab}
          showAdmin={showAdmin}
          onLogout={onLogout}
        />
        {children}
      </main>
    </div>
  )
}
