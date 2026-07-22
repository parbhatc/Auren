export function authFormPanelClass(isDark: boolean) {
  return isDark
    ? 'rounded-xl border border-[#27272A] bg-[#18181B] lg:rounded-none lg:border-0 lg:bg-transparent'
    : 'rounded-xl border border-[#E4E4E7] bg-white lg:rounded-none lg:border-0 lg:bg-transparent'
}

export function authLinkClass(isDark: boolean) {
  return isDark
    ? 'text-blue-400 hover:text-blue-300'
    : 'text-blue-600 hover:text-blue-700'
}

export function authMutedTextClass(isDark: boolean) {
  return isDark ? 'text-slate-400' : 'text-slate-600'
}

export function authInfoBoxClass(isDark: boolean) {
  return isDark
    ? 'rounded-xl border border-[#27272A] bg-[#18181B] p-3.5 sm:p-4'
    : 'rounded-xl border border-blue-200 bg-blue-50 p-3.5 sm:p-4'
}
