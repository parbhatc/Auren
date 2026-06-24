/** Shared Auren surface styles — keep hub, settings, and auth visually aligned. */

export function appPageBackground(isDark: boolean): string {
  return isDark
    ? 'min-h-screen bg-slate-950'
    : 'min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/60 via-slate-50 to-white'
}

export function appHeaderShell(isDark: boolean): string {
  return isDark
    ? 'border-slate-800/80 bg-slate-950/80 backdrop-blur-xl'
    : 'border-slate-200/80 bg-white/80 backdrop-blur-xl'
}

export function panelCardClass(isDark: boolean): string {
  return isDark
    ? 'rounded-2xl border p-5 sm:p-6 backdrop-blur-sm bg-slate-900/70 border-slate-800/90 shadow-xl shadow-black/25 ring-1 ring-slate-800/50'
    : 'rounded-2xl border p-5 sm:p-6 backdrop-blur-sm bg-white/90 border-slate-200/90 shadow-lg shadow-slate-200/60 ring-1 ring-slate-100'
}

export function panelCardTitleClass(isDark: boolean): string {
  return `text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`
}

export function panelCardDescClass(isDark: boolean): string {
  return `text-sm mb-5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`
}

export function fieldLabelClass(isDark: boolean): string {
  return `block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`
}

export function selectInputClass(isDark: boolean): string {
  return `w-full px-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${
    isDark
      ? 'bg-slate-800/80 border-slate-600 text-slate-100'
      : 'bg-white border-slate-300 text-slate-900'
  }`
}

export function ghostButtonClass(isDark: boolean): string {
  return `px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
    isDark
      ? 'border-slate-600 text-slate-300 hover:bg-slate-800'
      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
  }`
}

export function primaryButtonClass(): string {
  return 'px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-500/20 disabled:opacity-50'
}

export function settingsInputClass(isDark: boolean): string {
  return `w-full px-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/35 focus:border-violet-500/40 ${
    isDark
      ? 'bg-slate-900/80 border-slate-700/90 text-slate-100 placeholder:text-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
  }`
}

export function settingsInputDisabledClass(isDark: boolean): string {
  return `w-full px-3 py-2.5 rounded-xl border text-sm cursor-not-allowed ${
    isDark
      ? 'bg-slate-900/40 border-slate-800 text-slate-500'
      : 'bg-slate-100 border-slate-200 text-slate-500'
  }`
}

export function adminInputClass(isDark: boolean): string {
  return `w-full px-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-500/40 ${
    isDark
      ? 'bg-slate-950/40 border-slate-700/80 text-slate-100 placeholder:text-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
  }`
}

export function adminSaveButtonClass(): string {
  return 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 shadow-md shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all'
}

export function adminPrimaryButtonClass(): string {
  return adminSaveButtonClass()
}

export function adminGhostButtonClass(isDark: boolean): string {
  return `inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
    isDark
      ? 'border-slate-700 text-slate-300 hover:bg-slate-800/80 hover:text-white'
      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
  }`
}

export function adminIconButtonClass(
  isDark: boolean,
  tone: 'amber' | 'muted' | 'danger' = 'muted'
): string {
  const map = {
    amber: isDark
      ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
    muted: isDark
      ? 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-700/80'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200',
    danger: isDark
      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
      : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
  }
  return `p-2 rounded-lg transition-colors ${map[tone]}`
}

export function adminListCardClass(isDark: boolean): string {
  return isDark
    ? 'rounded-xl border border-slate-800/80 bg-slate-950/30 p-4 sm:p-5 transition-colors hover:border-slate-700/90'
    : 'rounded-xl border border-slate-200 bg-white/80 p-4 sm:p-5 transition-colors hover:border-slate-300 hover:shadow-sm'
}

export function adminSearchInputClass(isDark: boolean): string {
  return `w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-500/40 ${
    isDark
      ? 'bg-slate-950/40 border-slate-700/80 text-slate-100 placeholder:text-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
  }`
}

export function adminBadgeClass(isDark: boolean): string {
  return isDark
    ? 'px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25'
    : 'px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 ring-1 ring-amber-200'
}

export function adminInsetListItemClass(isDark: boolean): string {
  return isDark
    ? 'rounded-lg border border-slate-800/80 bg-slate-900/50 p-3'
    : 'rounded-lg border border-slate-200 bg-slate-50 p-3'
}

export function adminSectionTitleClass(isDark: boolean): string {
  return `text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`
}

export function adminSectionHintClass(isDark: boolean): string {
  return `text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`
}

export function adminDividerClass(isDark: boolean): string {
  return isDark ? 'border-slate-800/80' : 'border-slate-200'
}

export function adminInsetClass(isDark: boolean): string {
  return isDark
    ? 'rounded-xl border border-slate-800/80 bg-slate-950/30 p-4'
    : 'rounded-xl border border-slate-200 bg-slate-50/80 p-4'
}

export function settingsSaveButtonClass(): string {
  return 'shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
}

export function settingsDividerClass(isDark: boolean): string {
  return isDark ? 'border-slate-800/80' : 'border-slate-200'
}

export function settingsInsetClass(isDark: boolean): string {
  return isDark
    ? 'rounded-xl border border-slate-700/80 bg-slate-950/40 p-4 sm:p-5'
    : 'rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5'
}

export function alertBannerClass(isDark: boolean, tone: 'amber' | 'red' | 'emerald'): string {
  const map = {
    amber: isDark ? 'border-amber-500/40 bg-amber-500/10 text-amber-100' : 'border-amber-300 bg-amber-50 text-amber-900',
    red: isDark ? 'border-red-500/40 bg-red-500/10 text-red-100' : 'border-red-300 bg-red-50 text-red-900',
    emerald: isDark ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-emerald-300 bg-emerald-50 text-emerald-900',
  }
  return `rounded-xl border p-4 ${map[tone]}`
}
