import { Moon, Sun } from 'lucide-react'

/** Compact sun/moon toggle matching PracticeTradeHeader (avoids emoji encoding issues). */
export function HeaderThemeButton({
  isDark,
  onToggle,
}: {
  isDark: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`p-1.5 rounded ${
        isDark ? 'text-amber-400/90 hover:bg-slate-800' : 'text-amber-600 hover:bg-slate-100'
      }`}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="w-4 h-4" aria-hidden /> : <Moon className="w-4 h-4" aria-hidden />}
    </button>
  )
}

/** @deprecated use HeaderThemeButton */
export const PracticeHeaderThemeButton = HeaderThemeButton
