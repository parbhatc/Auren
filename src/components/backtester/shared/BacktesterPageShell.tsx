import type { ReactNode } from 'react'
import { appPageBackground } from '../../../styles/aurenTheme'
import BacktesterNav, { type BacktesterTab } from './BacktesterNav'
import ProductHeader from '../../layout/ProductHeader'

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
    <div className={`auren-shell-offset ${appPageBackground(isDark)}`}>
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
