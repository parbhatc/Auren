/**
 * Practice trade UI palette — matches Practice hub (violet / indigo / slate).
 * Use for color-only swaps; do not change layout from these tokens.
 */

/** Dark surfaces (was GitHub-style #0b0e11 / #161b22) */
export const PRACTICE_DARK = {
  page: '#020617', // slate-950
  shell: '#020617',
  surface: '#0f172a', // slate-900
  elevated: '#1e293b', // slate-800
  border: '#475569', // slate-600
  borderSubtle: '#334155', // slate-700
  muted: '#94a3b8', // slate-400
  text: '#f1f5f9', // slate-100
  textSecondary: '#cbd5e1', // slate-300
  accent: '#8b5cf6', // violet-500
  accentMuted: '#a78bfa', // violet-400
} as const

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
