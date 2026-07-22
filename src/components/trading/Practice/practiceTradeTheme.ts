/**
 * Practice trade UI palette — neutral zinc surfaces with a single blue accent.
 * Use for color-only swaps; do not change layout from these tokens.
 */

export { PRACTICE_DARK } from '../../../constants/practiceTheme'

export const practiceTradePageClass = (isDark: boolean) =>
  isDark
    ? 'bg-[#09090B]'
    : 'bg-[#FAFAFA]'

export const practiceTradeShellClass = (isDark: boolean) =>
  isDark ? 'border-[#27272A] bg-[#09090B] text-[#D4D4D8]' : 'border-[#E4E4E7] bg-white text-[#52525B]'

export const practiceTradeSurfaceClass = (isDark: boolean) =>
  isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'

export const practiceTradeInsetClass = (isDark: boolean) =>
  isDark ? 'bg-[#09090B]' : 'bg-[#F4F4F5]'

export const practiceTradeAccentText = (isDark: boolean) =>
  isDark ? 'text-blue-400' : 'text-blue-600'

export const practiceTradeAccentBorder = (isDark: boolean) =>
  isDark ? 'border-blue-500' : 'border-blue-600'

/** Main content panel (stats, news body) — matches chart / order pad frame on trade page */
export const practiceTradePanelClass = (isDark: boolean) =>
  isDark
    ? 'rounded-xl border border-[#27272A] bg-[#18181B]'
    : 'rounded-xl border border-[#E4E4E7] bg-white'

export const practiceTradePageBgClass = practiceTradePageClass

/** Stat cards on practice session stats (/trade/:id/stats). */
export const practiceStatCardClass = (isDark: boolean) =>
  isDark
    ? 'rounded-xl border border-[#27272A] bg-[#18181B]'
    : 'rounded-xl border border-[#E4E4E7] bg-white'

export const practiceStatIconMutedClass = (isDark: boolean) =>
  isDark ? 'text-blue-400/80' : 'text-blue-600/80'
