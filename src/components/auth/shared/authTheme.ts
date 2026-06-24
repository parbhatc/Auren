export function authFormPanelClass(isDark: boolean) {
  return isDark
    ? 'rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl shadow-black/20 ring-1 ring-slate-800/40 backdrop-blur-sm lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:ring-0 lg:backdrop-blur-none'
    : 'rounded-2xl border border-slate-200/90 bg-white/90 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 backdrop-blur-sm lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:ring-0 lg:backdrop-blur-none'
}

export function authLinkClass(isDark: boolean) {
  return isDark
    ? 'text-violet-400 hover:text-violet-300'
    : 'text-violet-600 hover:text-violet-700'
}

export function authMutedTextClass(isDark: boolean) {
  return isDark ? 'text-slate-400' : 'text-slate-600'
}

export function authInfoBoxClass(isDark: boolean) {
  return isDark
    ? 'rounded-xl border border-slate-700/80 bg-slate-800/50 p-3.5 sm:p-4'
    : 'rounded-xl border border-violet-200/80 bg-violet-50/80 p-3.5 sm:p-4'
}
