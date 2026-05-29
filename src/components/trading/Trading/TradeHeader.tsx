import { LogOut, Menu } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import Logo from '../../common/Logo'
import { AccountSelector } from './AccountSelector'
import { AccountStatsBar } from '../shared/account/AccountStatsBar'
import { MdsNetworkStatusButton } from '../MdsNetworkStatusButton'
import { HeaderThemeButton } from '../shared/header/HeaderThemeButton'
import AccountStatusBar from '../shared/header/AccountStatusBar'
import LockoutCard from '../shared/header/LockoutCard'
import HeaderTradingSettings from '../shared/header/HeaderTradingSettings'
import type { TradeseaMdsClient } from '../../../services/tradesea/TradeseaMdsClient'

export function TradeHeader({
  isDark,
  navigate,
  toggleTheme,
  accountId: accountIdProp,
  practiceAccountId,
  onRefreshPracticeAccount,
  practiceRefreshing,
  showNav,
  onShowNav,
  balance = 0,
  rpl = 0,
  upl = 0,
  hasOpenPosition,
  mdsClient,
  onReconnectMds,
  showStatsBar = true,
  showAccountSelector = true,
  practiceAccountStatus,
}: {
  isDark: boolean
  navigate: (path: string) => void
  toggleTheme: () => void
  accountId?: string
  /** @deprecated use accountId */
  practiceAccountId?: string
  onRefreshPracticeAccount?: () => void
  practiceRefreshing?: boolean
  showNav: boolean
  onShowNav: () => void
  balance?: number
  rpl?: number
  upl?: number
  hasOpenPosition?: boolean
  mdsClient?: TradeseaMdsClient | null
  onReconnectMds?: () => void
  /** BAL / RP&L / UP&L strip — chart trade page only */
  showStatsBar?: boolean
  /** Account dropdown in header row */
  showAccountSelector?: boolean
  practiceAccountStatus?: 'blown' | 'passed'
}) {
  const accountId = accountIdProp ?? practiceAccountId

  const shell = isDark
    ? 'border-slate-800 bg-slate-950/95 text-slate-200'
    : 'border-slate-200 bg-white/95 text-slate-800'

  return (
    <div className={`shrink-0 z-50 ${shell}`}>
      <header className="h-10 border-b border-inherit flex items-center gap-2 px-2">
        {!showNav && (
          <button
            type="button"
            onClick={onShowNav}
            className={`p-1.5 rounded shrink-0 ${
              isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Show navigation"
            aria-label="Show navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="shrink-0">
          <Logo
            isDark={isDark}
            compact
            size="sm"
            onClick={() => navigate(ROUTES.PRACTICE)}
          />
        </div>

        {showAccountSelector && (
          <AccountSelector
            compact
            isDark={isDark}
            currentAccountId={accountId}
            navigate={navigate}
            onRefresh={onRefreshPracticeAccount}
            refreshing={practiceRefreshing}
          />
        )}

        <div className="flex-1 min-w-0" aria-hidden />

        <div className="flex items-center gap-0.5 shrink-0">
          {accountId && !practiceAccountStatus ? (
            <HeaderTradingSettings practiceAccountId={accountId} isDark={isDark} />
          ) : null}
          {(mdsClient || onReconnectMds) && (
            <MdsNetworkStatusButton mds={mdsClient} onReconnect={onReconnectMds} />
          )}
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('token')
              navigate(ROUTES.LOGIN)
            }}
            className={`p-1.5 rounded ${
              isDark
                ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800'
                : 'text-slate-500 hover:text-red-600 hover:bg-slate-100'
            }`}
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <HeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
        </div>
      </header>

      {practiceAccountStatus && accountId ? (
        <AccountStatusBar
          isDark={isDark}
          status={practiceAccountStatus}
          practiceAccountId={accountId}
          navigate={navigate}
        />
      ) : null}

      {showStatsBar && (
        <AccountStatsBar
          isDark={isDark}
          balance={balance}
          rpl={rpl}
          upl={upl}
          hasOpenPosition={hasOpenPosition}
        />
      )}

      {accountId && !practiceAccountStatus ? (
        <LockoutCard practiceAccountId={accountId} isDark={isDark} />
      ) : null}
    </div>
  )
}

/** @deprecated use TradeHeader */
export const PracticeTradeHeader = TradeHeader
