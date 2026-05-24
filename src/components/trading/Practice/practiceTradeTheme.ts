/**
 * Practice trade UI palette — matches Practice hub (violet / indigo / slate).
 * Use for color-only swaps; do not change layout from these tokens.
 */

export { PRACTICE_DARK } from '../../../constants/practiceTheme'

export const practiceTradePageClass = (isDark: boolean) =>
  isDark
    ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950'
    : 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60'

export const practiceTradeShellClass = (isDark: boolean) =>
  isDark ? 'border-slate-800 bg-slate-950/95 text-slate-200' : 'border-slate-200 bg-white text-slate-800'

export const practiceTradeSurfaceClass = (isDark: boolean) =>
  isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'

export const practiceTradeInsetClass = (isDark: boolean) =>
  isDark ? 'bg-slate-950' : 'bg-slate-50'

export const practiceTradeAccentText = (isDark: boolean) =>
  isDark ? 'text-violet-400' : 'text-violet-600'

export const practiceTradeAccentBorder = (isDark: boolean) =>
  isDark ? 'border-violet-500' : 'border-violet-500'

/** Main content panel (stats, news body) — matches chart / order pad frame on trade page */
export const practiceTradePanelClass = (isDark: boolean) =>
  isDark
    ? 'rounded-2xl border border-slate-700/80 bg-slate-900/90'
    : 'rounded-2xl border border-slate-200 bg-white/95'

export const practiceTradePageBgClass = practiceTradePageClass

/** Stat cards on practice session stats (/trade/:id/stats). */
export const practiceStatCardClass = (isDark: boolean) =>
  isDark
    ? 'rounded-2xl border border-slate-700/80 bg-slate-900/80 shadow-lg shadow-black/20 ring-1 ring-slate-800/50'
    : 'rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-200/40 ring-1 ring-slate-100'

export const practiceStatIconMutedClass = (isDark: boolean) =>
  isDark ? 'text-violet-400/70' : 'text-violet-500/80'
