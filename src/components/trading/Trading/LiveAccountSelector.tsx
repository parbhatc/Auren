import { useEffect, useRef, useState } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import type { FormattedAccount } from '../../../utils/marketAccountDisplay'
import { getAccountColorClasses } from '../../../utils/marketAccountDisplay'

export function LiveAccountSelector({
  isDark,
  navigate,
  accounts,
  selectedLabel,
  onSelect,
  onRefresh,
  refreshing,
  compact = false,
}: {
  isDark: boolean
  navigate: (path: string) => void
  accounts: FormattedAccount[]
  selectedLabel: string
  onSelect: (accountId: number, displayName: string) => void
  onRefresh?: () => void
  refreshing?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const wrapperClass = compact
    ? 'relative shrink-0 w-[168px] sm:w-[188px] max-w-[42vw]'
    : 'relative min-w-[200px] sm:min-w-[260px] max-w-full sm:max-w-md'

  const currentLabel = selectedLabel || t('practice.selectAccount')

  return (
    <div ref={ref} className={wrapperClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`w-full flex items-center gap-1.5 border text-left transition-all ${
          compact ? 'h-8 px-2 py-0 rounded-md text-xs' : 'h-9 px-2.5 py-0 rounded-md text-sm'
        } ${
          open
            ? isDark
              ? 'bg-slate-800 ring-1 ring-emerald-500/30'
              : 'bg-white ring-1 ring-emerald-400/40'
            : isDark
              ? 'bg-[#0f172a] text-slate-200 hover:border-slate-500 border-emerald-500/50'
              : 'bg-white text-slate-800 hover:border-emerald-400 shadow-sm border-emerald-500'
        }`}
      >
        <div className="flex-1 min-w-0">
          <span
            className={`font-semibold truncate block ${
              isDark ? 'text-emerald-400' : 'text-emerald-700'
            }`}
          >
            {currentLabel}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${
            isDark ? 'text-slate-500' : 'text-slate-500'
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute top-full left-0 mt-1 z-[200] rounded-lg border shadow-xl overflow-hidden ${
            compact ? 'w-[min(280px,calc(100vw-1rem))]' : 'right-0 sm:left-0 sm:right-auto sm:min-w-[320px]'
          } ${isDark ? 'bg-[#0f172a] border-[#475569]' : 'bg-white border-slate-200'}`}
        >
          <div
            className={`flex items-center justify-between px-3 py-2 border-b ${
              isDark ? 'border-[#475569]' : 'border-slate-200'
            }`}
          >
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('live.hub.accountsTitle')}
            </span>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${
                  isDark ? 'text-emerald-400 hover:bg-slate-800' : 'text-emerald-600 hover:bg-emerald-100'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                {t('practice.refreshAccounts')}
              </button>
            ) : null}
          </div>

          <ul className="max-h-72 overflow-y-auto py-1">
            {accounts.length === 0 ? (
              <li className={`px-3 py-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {t('live.hub.empty')}
              </li>
            ) : (
              accounts.map((formattedAccount) => {
                const account = formattedAccount.account
                const displayName = formattedAccount.displayName
                const selected = selectedLabel === displayName
                const colorClasses = account
                  ? getAccountColorClasses(account, isDark, selected)
                  : selected
                    ? isDark
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-100 text-slate-900'
                    : isDark
                      ? 'text-slate-300 hover:bg-slate-700'
                      : 'text-slate-700 hover:bg-slate-50'

                return (
                  <li key={formattedAccount.accountId || displayName}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setOpen(false)
                        if (selected || formattedAccount.accountId === undefined) return
                        onSelect(formattedAccount.accountId, displayName)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors border-l-2 ${colorClasses}`}
                    >
                      <span className="font-medium truncate block">{displayName}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>

          <div className={`border-t p-1.5 ${isDark ? 'border-[#475569]' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate(`${ROUTES.HOME}?mode=live`)
              }}
              className={`w-full text-center px-3 py-2 text-xs font-medium rounded-md ${
                isDark ? 'text-emerald-400 hover:bg-slate-800' : 'text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {t('live.trade.backToHub')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
