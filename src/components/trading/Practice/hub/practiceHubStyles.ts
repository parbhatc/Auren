import type { PracticeAccountMode } from '../../../../constants/practice'
import { selectInputClass } from '../../../../styles/aurenTheme'

export function practiceHubSelectClass(isDark: boolean) {
  return selectInputClass(isDark)
}

export function practiceModePillClass(isDark: boolean, mode: PracticeAccountMode, active: boolean) {
  if (active) {
    if (mode === 'eval') {
      return 'px-4 py-2 rounded-full text-sm font-medium bg-emerald-600 text-white shadow-sm shadow-emerald-900/30'
    }
    return 'px-4 py-2 rounded-full text-sm font-medium bg-amber-500 text-amber-950 shadow-sm shadow-amber-900/20'
  }
  return `px-4 py-2 rounded-full text-sm font-medium border ${
    isDark ? 'border-slate-600 text-slate-400 hover:border-slate-500' : 'border-slate-300 text-slate-600 hover:border-slate-400'
  }`
}
