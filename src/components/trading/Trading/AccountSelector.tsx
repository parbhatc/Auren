import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import {
  getPracticeAccountDisplayTitle,
  getPracticeAccounts,
  refreshPracticeFromApi,
  type PracticeAccount,
  type PracticeAccountStatus,
} from '../../../constants/practice'
import { formatPracticeSize } from '../../../services/practice/practicePlans'
import { t } from '../../../utils/translator'
import {
  getPracticeAccountColorClasses,
  practiceAccountModeBadgeClass,
  practiceAccountTriggerBorderClass,
} from '../Practice/hub/practiceAccountColors'

const STATUS_ORDER: PracticeAccountStatus[] = ['active', 'passed', 'blown']

export function AccountSelector({
  isDark,
  currentAccountId,
  navigate,
  onRefresh,
  refreshing,
  compact = false,
}: {
  isDark: boolean
  currentAccountId?: string
  navigate: (path: string) => void
  onRefresh?: () => void
  refreshing?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<PracticeAccount[]>(() => getPracticeAccounts())
  const ref = useRef<HTMLDivElement>(null)

  const syncAccounts = useCallback(() => {
    setAccounts(getPracticeAccounts())
  }, [])

  useEffect(() => {
    void refreshPracticeFromApi().then(syncAccounts)
    const onChange = () => syncAccounts()
    window.addEventListener('practiceAccountsChanged', onChange)
    return () => window.removeEventListener('practiceAccountsChanged', onChange)
  }, [syncAccounts])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const grouped = useMemo(() => {
    const map = new Map<PracticeAccountStatus, PracticeAccount[]>()
    for (const status of STATUS_ORDER) {
      map.set(status, [])
    }
    for (const a of accounts) {
      const list = map.get(a.status) || []
      list.push(a)
      map.set(a.status, list)
    }
    return STATUS_ORDER.map((status) => ({
      status,
      accounts: map.get(status) || [],
    })).filter((g) => g.accounts.length > 0)
  }, [accounts])

  const current = accounts.find((a) => a.id === currentAccountId)
  const currentLabel = current
    ? getPracticeAccountDisplayTitle(current)
    : t('practice.trade.accountNotFound')

  const compactMobileLabel = useMemo(() => {
    const parts = currentLabel.split('·').map((s) => s.trim()).filter(Boolean)
    return parts.length >= 2 ? parts[parts.length - 1] : currentLabel
  }, [currentLabel])

  const handleRefresh = () => {
    void refreshPracticeFromApi().then(() => {
      syncAccounts()
      onRefresh?.()
    })
  }

  const selectAccount = (account: PracticeAccount) => {
    setOpen(false)
    if (account.id === currentAccountId) return
    if (account.status !== 'active') {
      navigate(ROUTES.PRACTICE)
      return
    }
    navigate(`${ROUTES.PRACTICE_TRADE}/${account.id}`)
  }

  const statusLabel = (status: PracticeAccountStatus) => {
    if (status === 'active') return t('practice.hub.active')
    if (status === 'passed') return t('practice.hub.passed')
    return t('practice.hub.blown')
  }

  const wrapperClass = compact
    ? 'relative shrink-0 w-[min(5.5rem,22vw)] lg:w-[168px] xl:w-[188px]'
    : 'relative min-w-[200px] sm:min-w-[260px] max-w-full sm:max-w-md'

  const compactBtnClass =
    'h-7 lg:h-8 px-1.5 lg:px-2 py-0 rounded text-[10px] leading-tight lg:text-xs lg:rounded-md gap-0.5 lg:gap-1.5'
  return (
    <div ref={ref} className={wrapperClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={currentLabel}
        className={`w-full flex items-center border text-left transition-all ${
          compact ? compactBtnClass : 'h-9 px-2.5 py-0 rounded-md text-sm gap-1.5'
        } ${
          open
            ? isDark
              ? 'bg-[#18181B] ring-1 ring-blue-500/40'
              : 'bg-white ring-1 ring-blue-600/35'
            : isDark
              ? 'bg-[#18181B] text-[#FAFAFA] hover:border-[#52525B]'
              : 'bg-white text-[#09090B] hover:border-blue-500'
        } ${practiceAccountTriggerBorderClass(current, isDark)}`}
      >
        <div className="flex-1 min-w-0">
          <span
            className={`font-semibold truncate block lg:hidden ${
              current?.mode === 'funded'
                ? isDark
                  ? 'text-amber-400'
                  : 'text-amber-700'
                : isDark
                  ? 'text-emerald-400'
                  : 'text-emerald-700'
            }`}
          >
            {compactMobileLabel}
          </span>
          <span
            className={`font-semibold truncate hidden lg:block ${
              current?.mode === 'funded'
                ? isDark
                  ? 'text-amber-400'
                  : 'text-amber-700'
                : isDark
                  ? 'text-emerald-400'
                  : 'text-emerald-700'
            }`}
          >
            {currentLabel}
          </span>
        </div>
        <ChevronDown
          className={`w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${
            isDark ? 'text-slate-500' : 'text-slate-500'
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute top-full left-0 mt-1 z-[200] rounded-lg border shadow-xl overflow-hidden ${
            compact ? 'w-[min(280px,calc(100vw-1rem))]' : 'right-0 sm:left-0 sm:right-auto sm:min-w-[320px]'
          } ${
            isDark ? 'border-[#3F3F46] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'
          }`}
        >
          <div
            className={`flex items-center justify-between px-3 py-2 border-b ${
              isDark ? 'border-[#3F3F46]' : 'border-[#E4E4E7]'
            }`}
          >
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t('practice.hub.yourAccounts')}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${
                isDark ? 'text-blue-400 hover:bg-[#27272A]' : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {t('practice.refreshAccounts')}
            </button>
          </div>

          <ul className="max-h-72 overflow-y-auto py-1">
            {grouped.length === 0 ? (
              <li className={`px-3 py-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {t('practice.hub.empty')}
              </li>
            ) : (
              grouped.map(({ status, accounts: list }) => (
                <li key={status}>
                  <p
                    className={`px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    {statusLabel(status)}
                  </p>
                  {list.map((account) => {
                    const label = getPracticeAccountDisplayTitle(account)
                    const selected = account.id === currentAccountId
                    return (
                      <button
                        key={account.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => selectAccount(account)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors border-l-2 ${getPracticeAccountColorClasses(account, isDark, selected)}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{label}</span>
                          <span
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${practiceAccountModeBadgeClass(account.mode, isDark)}`}
                          >
                            {account.mode === 'eval' ? t('practice.hub.eval') : t('practice.hub.funded')}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          ${account.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          {' Â· '}
                          {formatPracticeSize(account.size)}
                          {' Â· '}
                          <span className="capitalize">{account.status}</span>
                        </p>
                      </button>
                    )
                  })}
                </li>
              ))
            )}
          </ul>

          <div className={`border-t p-1.5 ${isDark ? 'border-[#3F3F46]' : 'border-[#E4E4E7]'}`}>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate(ROUTES.PRACTICE)
              }}
              className={`w-full text-center px-3 py-2 text-xs font-medium rounded-md ${
                isDark ? 'text-blue-400 hover:bg-[#27272A]' : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              {t('practice.hub.manageAccounts')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
