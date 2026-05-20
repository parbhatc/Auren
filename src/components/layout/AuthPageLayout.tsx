import type { ReactNode } from 'react'
import { appPageBackground } from '../../styles/aurenTheme'
import { PracticeHeaderThemeButton } from '../trading/Practice/PracticeHeaderThemeButton'

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
    <div className={`${appPageBackground(isDark)} flex flex-col`}>
      <div className="absolute top-3 right-3 z-10 sm:top-4 sm:right-4">
        <PracticeHeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
      </div>
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">{children}</div>
    </div>
  )
}
