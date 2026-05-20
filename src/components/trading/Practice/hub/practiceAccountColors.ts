import type { PracticeAccount } from '../../../../constants/practice'

/** Eval = emerald, Funded = amber (matches plan cards). */
export function getPracticeAccountColorClasses(
  account: PracticeAccount,
  isDark: boolean,
  isSelected: boolean
): string {
  const mode = account.mode
  if (isSelected) {
    if (mode === 'eval') {
      return isDark
        ? 'bg-emerald-500/15 text-emerald-100 border-l-emerald-400'
        : 'bg-emerald-50 text-emerald-900 border-l-emerald-600'
    }
    return isDark
      ? 'bg-amber-500/15 text-amber-100 border-l-amber-400'
      : 'bg-amber-50 text-amber-900 border-l-amber-600'
  }
  if (account.status !== 'active') {
    return isDark
      ? 'border-l-transparent text-slate-500 hover:bg-slate-700/40'
      : 'border-l-transparent text-slate-400 hover:bg-slate-50'
  }
  if (mode === 'eval') {
    return isDark
      ? 'border-l-emerald-500/40 text-slate-200 hover:bg-slate-700/60'
      : 'border-l-emerald-400 text-slate-800 hover:bg-emerald-50/50'
  }
  return isDark
    ? 'border-l-amber-500/40 text-slate-200 hover:bg-slate-700/60'
    : 'border-l-amber-400 text-slate-800 hover:bg-amber-50/50'
}

export function practiceAccountTriggerBorderClass(account: PracticeAccount | undefined, isDark: boolean): string {
  if (!account) {
    return isDark ? 'border-slate-600' : 'border-slate-300'
  }
  if (account.mode === 'eval') {
    return isDark ? 'border-emerald-500/50' : 'border-emerald-500'
  }
  return isDark ? 'border-amber-500/50' : 'border-amber-500'
}

export function practiceAccountModeBadgeClass(mode: PracticeAccount['mode'], isDark: boolean): string {
  if (mode === 'eval') {
    return isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
  }
  return isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
}
