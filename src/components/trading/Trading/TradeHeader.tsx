import { useEffect, useState, type ReactNode } from 'react'
import { LogOut, Menu } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import Logo from '../../common/Logo'
import { isPwaPinnedNav } from '../../../utils/pwa'
import { AccountSelector } from './AccountSelector'
import { LiveAccountSelector } from './LiveAccountSelector'
import { LiveAccountStats } from '../shared/account/AccountStatsBar'
import { MdsNetworkStatusButton } from '../MdsNetworkStatusButton'
import { HeaderThemeButton } from '../shared/header/HeaderThemeButton'
import AccountStatusBar from '../shared/header/AccountStatusBar'
import LockoutCard from '../shared/header/LockoutCard'
import HeaderTradingSettings from '../shared/header/HeaderTradingSettings'
import type { TradeseaMdsClient } from '../../../services/tradesea/TradeseaMdsClient'
import { MdsConnectionLimitModal } from '../MdsConnectionLimitModal'
import type { FormattedAccount } from '../../../utils/marketAccountDisplay'
import { getPracticeAccountById } from '../../../constants/practice'

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
  showTradingSettings = true,
  showLogoAlways = false,
  hideDesktopLogo = false,
  hideNavToggle = false,
  practiceAccountStatus,
  liveMode = false,
  liveAccounts = [],
  selectedLiveAccountLabel = '',
  onSelectLiveAccount,
  onRefreshLiveAccounts,
  liveRefreshing,
  hubPath = ROUTES.PRACTICE,
  headerLabel,
  headerLeading,
  headerConnectionAccessory,
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
  /** Trading limits & lockout settings button */
  showTradingSettings?: boolean
  /** Show Auren logo on mobile as well as desktop */
  showLogoAlways?: boolean
  /** The shared product sidebar already carries the desktop brand. */
  hideDesktopLogo?: boolean
  /** Never show the menu button to restore navigation */
  hideNavToggle?: boolean
  practiceAccountStatus?: 'blown' | 'passed'
  liveMode?: boolean
  liveAccounts?: FormattedAccount[]
  selectedLiveAccountLabel?: string
  onSelectLiveAccount?: (accountId: number, displayName: string) => void
  onRefreshLiveAccounts?: () => void
  liveRefreshing?: boolean
  /** Logo click destination — live hub uses `/?mode=live` */
  hubPath?: string
  /** Compact title when account selector is hidden (e.g. replay session name) */
  headerLabel?: string
  /** Custom header control (e.g. replay session dropdown) */
  headerLeading?: ReactNode
  /** Connection status control beside theme toggle */
  headerConnectionAccessory?: ReactNode
}) {
  const accountId = accountIdProp ?? practiceAccountId
  const practiceAccount = accountId ? getPracticeAccountById(accountId) : undefined
  const profitTarget =
    practiceAccount?.mode === 'eval' ? practiceAccount.rules.profitTarget ?? undefined : undefined
  const [connectionLimitOpen, setConnectionLimitOpen] = useState(false)

  useEffect(() => {
    if (!mdsClient) {
      setConnectionLimitOpen(false)
      return
    }
    const offBlocked = mdsClient.on('connectionsLimitBlocked', () => setConnectionLimitOpen(true))
    const offOpen = mdsClient.on('open', () => setConnectionLimitOpen(false))
    const offConnection = mdsClient.on('connection', (state) => {
      if (state === 'connected') setConnectionLimitOpen(false)
    })
    return () => {
      offBlocked()
      offOpen()
      offConnection()
    }
  }, [mdsClient])

  const handleConnectionLimitRefresh = () => {
    setConnectionLimitOpen(false)
    if (onReconnectMds) {
      onReconnectMds()
      return
    }
    mdsClient?.reconnect()
  }

  const shell = isDark
    ? 'border-[#27272A] bg-[#09090B] text-[#D4D4D8]'
    : 'border-[#E4E4E7] bg-white text-[#27272A]'

  // BAL / RP&L / UP&L now read live from accountStatsStore via <LiveAccountStats>,
  // so the header no longer re-renders on every PnL tick. balance/rpl/upl/
  // hasOpenPosition props are retained for compatibility but unused here.
  const showMobileHeaderActions = !showStatsBar
  const headerActionVisibility = showMobileHeaderActions ? 'block' : 'hidden lg:block'

  return (
    <div
      className={`sticky top-0 z-[110] shrink-0 max-lg:pt-[env(safe-area-inset-top,0px)] ${shell}`}
    >
      <header className="min-h-10 lg:h-10 border-b border-inherit flex items-stretch gap-1.5 lg:gap-2 px-2">
        {/* Mobile-only: desktop always shows the nav rail, so no header toggle there. */}
        {!hideNavToggle && !showNav && !isPwaPinnedNav() && (
          <button
            type="button"
            onClick={onShowNav}
            className={`lg:hidden self-center p-1.5 rounded shrink-0 ${
            isDark ? 'text-[#A1A1AA] hover:bg-[#18181B]' : 'text-[#52525B] hover:bg-[#F4F4F5]'
            }`}
            title="Show navigation"
            aria-label="Show navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className={`${hideDesktopLogo ? 'hidden' : showLogoAlways ? 'block' : 'hidden lg:block'} shrink-0 self-center`}>
          <Logo
            isDark={isDark}
            compact
            size="sm"
            onClick={() => navigate(hubPath)}
          />
        </div>

        {headerLeading ? (
          <div className="shrink-0 self-center min-w-0">{headerLeading}</div>
        ) : !showAccountSelector && headerLabel ? (
          <div
            className={`shrink-0 self-center min-w-0 max-w-[9rem] sm:max-w-[14rem] truncate rounded-md border px-2 py-0.5 text-xs font-semibold ${
              isDark
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
            title={headerLabel}
          >
            {headerLabel}
          </div>
        ) : null}

        {showAccountSelector && !liveMode && (
          <div className="shrink-0 self-center min-w-0">
            <AccountSelector
              compact
              isDark={isDark}
              currentAccountId={accountId}
              navigate={navigate}
              onRefresh={onRefreshPracticeAccount}
              refreshing={practiceRefreshing}
            />
          </div>
        )}

        {showAccountSelector && liveMode && onSelectLiveAccount && (
          <div className="shrink-0 self-center min-w-0">
            <LiveAccountSelector
              compact
              isDark={isDark}
              navigate={navigate}
              accounts={liveAccounts}
              selectedLabel={selectedLiveAccountLabel}
              onSelect={onSelectLiveAccount}
              onRefresh={onRefreshLiveAccounts}
              refreshing={liveRefreshing}
            />
          </div>
        )}

        {showStatsBar ? (
          <div className="flex-1 min-w-0 self-stretch py-0.5">
            <LiveAccountStats isDark={isDark} inline target={profitTarget} />
          </div>
        ) : (
          <div className="flex-1 min-w-0" aria-hidden />
        )}

        <div className="flex items-center gap-0.5 shrink-0 self-center">
          {!practiceAccountStatus && showTradingSettings ? (
            <div className="hidden lg:block">
              <HeaderTradingSettings practiceAccountId={accountId} isDark={isDark} />
            </div>
          ) : null}
          {(mdsClient || onReconnectMds) && (
            <MdsNetworkStatusButton mds={mdsClient} onReconnect={onReconnectMds} />
          )}
          {headerConnectionAccessory}
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('token')
              navigate(ROUTES.LOGIN)
            }}
            className={`${headerActionVisibility} p-1.5 rounded ${
              isDark
                ? 'text-[#71717A] hover:bg-[#18181B] hover:text-red-400'
                : 'text-[#71717A] hover:bg-[#F4F4F5] hover:text-red-600'
            }`}
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div className={headerActionVisibility}>
            <HeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
          </div>
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

      {accountId && !practiceAccountStatus ? (
        <LockoutCard practiceAccountId={accountId} isDark={isDark} />
      ) : null}

      <MdsConnectionLimitModal
        isOpen={connectionLimitOpen}
        isDark={isDark}
        onRefresh={handleConnectionLimitRefresh}
      />
    </div>
  )
}

/** @deprecated use TradeHeader */
export const PracticeTradeHeader = TradeHeader
