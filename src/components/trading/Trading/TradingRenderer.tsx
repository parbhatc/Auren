import { Component, createRef } from 'react'
import { LogOut, ChevronDown, RefreshCw } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import Logo from '../../common/Logo'
import ThemeToggle from '../../common/ThemeToggle'
import ContractQuantityControl from '../../common/ContractQuantityControl'
import TradeButtons from '../../common/TradeButtons'
import PositionButtons from '../../common/PositionButtons'
import AccountInfoBar from '../../common/AccountInfoBar'
import EconomicNewsPanel from '../../common/EconomicNewsPanel'
import TradingNav from '../../common/TradingNav'
import { TradingProps, TradingRendererState } from '../../../types/trading'
import { TradingHandler } from '../../../services/trading/TradingHandler'
import { getSavedLayout } from '../../../utils/tradingLayoutStorage'
import { renderLayout, renderPracticeTradeLayout } from '../../../utils/layoutRenderer'
import { getAccountColorClasses, FormattedAccount, saveSelectedAccountId } from '../../../utils/marketAccountDisplay'
import { saveTradeTradeseaAccount } from '../../../constants/trade'
import { propFirmRegistry } from '../../../services/propfirms'
import { PracticeTradeHeader } from './PracticeTradeHeader'
import PracticeTradePanel from '../Practice/PracticeTradePanel'
import { PracticeTradeHandler } from '../../../services/practice/PracticeTradeHandler'
import type { TradeseaDatafeed } from '../../../services/tradesea/TradeseaDatafeed'
import { resolveTradePanelBidAsk } from '../../../services/tradesea/tradeseaMarketBook'
import { PracticeDetachedTradePanel } from '../Practice/PracticeDetachedTradePanel'
import { t } from '../../../utils/translator'
import { getPracticeAccountById } from '../../../constants/practice'
import { getMaxContractsForSymbol } from '../../../services/practice/practiceLimits'
import { resolvePracticeProductSymbol } from '../../../services/practice/practiceSymbol'
import {
  isPracticePadDetached,
  togglePracticePadDetached,
} from '../../../utils/practiceTradePanelPopout'
import { aurenToast } from '../../../utils/aurenToast'
import { dismissMdsConnectionToast } from '../../../services/tradesea/mdsConnectionToast'
import { chartSymbolToProductRoot } from '../../../services/tradesea/tradeseaSymbolInfo'
import { debugPracticeChartSymbol } from '../../../services/tradesea/practiceChartSymbolDebug'
import {
  getInitialPracticeShowNav,
  savePracticeShowNav,
} from '../../../utils/practiceTradePreferences'
import { PracticeMobileScalpBar } from '../Practice/PracticeMobileScalpBar'
import { PracticeMobileOrderSheet } from '../Practice/PracticeMobileOrderSheet'
import {
  getPracticeMobileTradePrefs,
  PRACTICE_MOBILE_TRADE_PREFS_EVENT,
  setPracticeMobileFloatingPad,
} from '../../../utils/practiceMobileTradePrefs'

/**
 * Trading renderer component
 * Practice trading terminal layout
 */
class TradingRenderer extends Component<TradingProps, TradingRendererState> {
  private accountDropdownRef = createRef<HTMLDivElement>()

  state: TradingRendererState = {
    selectedSymbol: 'MNQ',
    contractQuantity: 1 as number | string,
    selectedAccount: this.props.selectedAccount || 'Account 1',
    showAccountDropdown: false,
    layout: getSavedLayout('trading'),
    showNews: true,
    showNav: true,
    practiceMobileOrderOpen: false,
  }

  private lastBalance: number = 0
  private lastRpl: number = 0
  private lastUpl: number = 0

  private handleMobileTradePrefsChange = () => {
    if (this.props.practiceMode) this.forceUpdate()
  }

  /**
   * Find the prop firm that has the given account
   * @param accountId - The account ID to find
   * @returns The prop firm instance that has this account, or null
   */
  private findPropFirmWithAccount(accountId: number): any {
    for (const firm of propFirmRegistry) {
      const firmAny = firm as any
      if (firmAny.formattedAccounts && Array.isArray(firmAny.formattedAccounts)) {
        const hasAccount = firmAny.formattedAccounts.some((acc: any) => acc.accountId === accountId)
        if (hasAccount) {
          return firmAny
        }
      }
    }
    return null
  }

  /**
   * Get the active prop firm from localStorage or first available
   * @returns The prop firm instance, or null
   */
  private getActivePropFirm(): any {
    if (this.props.practiceMode) {
      return propFirmRegistry.find((f) => f.id === 'tradesea') as any
    }
    const activePropFirmId = localStorage.getItem('activePropFirm') || propFirmRegistry[0]?.id
    const activePropFirm = propFirmRegistry.find(f => f.id === activePropFirmId)
    
    if (activePropFirm) {
      return activePropFirm as any
    }
    
    // Fallback to first prop firm that has accounts
    for (const firm of propFirmRegistry) {
      const firmAny = firm as any
      if (firmAny.formattedAccounts && Array.isArray(firmAny.formattedAccounts) && firmAny.formattedAccounts.length > 0) {
        return firmAny
      }
    }
    return null
  }

  /**
   * Get the trade handler for the active prop firm
   * @returns The trade handler instance, or null if not available
   */
  private getTradeHandler(): any {
    const activeFirm = this.getActivePropFirm()
    if (!activeFirm) {
      return null
    }

    if (this.props.practiceMode && activeFirm.practiceTradeHandler) {
      return activeFirm.practiceTradeHandler
    }

    return activeFirm.getHandler?.() || null
  }

  /**
   * Update prop firm account selection
   * @param accountId - The account ID to select
   */
  private updatePropFirmAccount(accountId: number): void {
    const activeFirm = this.getActivePropFirm()

    if (activeFirm?.id === 'tradesea' && activeFirm.formattedAccounts) {
      const formatted = activeFirm.formattedAccounts.find(
        (a: FormattedAccount) => a.accountId === accountId
      )
      if (formatted?.account?.id) {
        activeFirm.selectedAccountId = formatted.account.id
        saveTradeTradeseaAccount(formatted.account.id, formatted.displayName)
        activeFirm.onSelectedAccountChanged?.()
      }
      return
    }

    const firm = this.findPropFirmWithAccount(accountId)
    if (firm && firm.onSelectedAccountChanged) {
      firm.selectedAccountId = accountId
      firm.onSelectedAccountChanged()
    }
  }

  componentDidUpdate(prevProps: TradingProps) {
    // Check if accounts were updated from market data provider
    const activeFirm = this.getActivePropFirm()
    if (
      activeFirm?.id === 'tradesea' &&
      activeFirm?.formattedAccounts &&
      Array.isArray(activeFirm.formattedAccounts) &&
      activeFirm.formattedAccounts.length > 0
    ) {
      // Force re-render if accounts changed (compare with previous props)
      const currentAccounts = activeFirm.formattedAccounts
      const prevAccounts = prevProps.accounts || []
      
      if (currentAccounts.length !== prevAccounts.length || 
          currentAccounts.some((acc: any, idx: number) => acc.account?.id !== prevAccounts[idx]?.account?.id)) {
        // Accounts changed, force re-render
        this.forceUpdate()
      }
    }
    // Update selectedAccount when prop changes
    if (this.props.selectedAccount && this.props.selectedAccount !== prevProps.selectedAccount) {
      this.setState({ selectedAccount: this.props.selectedAccount })
      // Update account info when selected account prop changes
      const accounts = this.props.accounts || []
      const formattedAccount = (accounts as any[]).find((a: any) => a.displayName === this.props.selectedAccount)
      if (formattedAccount && formattedAccount.accountId !== undefined) {
        this.updatePropFirmAccount(formattedAccount.accountId)
      }
    }
    
    // Update selectedAccount when accounts become available
    if (this.props.accounts && this.props.accounts.length > 0 && (!prevProps.accounts || prevProps.accounts.length === 0)) {
      // Accounts just became available, update selectedAccount to match prop
      if (this.props.selectedAccount && this.props.selectedAccount !== this.state.selectedAccount) {
        this.setState({ selectedAccount: this.props.selectedAccount })
      }
    }
    
    // Sync from parent only when the parent prop actually changed (not when user picked a new account locally)
    if (
      this.props.selectedAccount &&
      this.props.selectedAccount !== prevProps.selectedAccount &&
      this.props.selectedAccount !== this.state.selectedAccount
    ) {
      this.setState({ selectedAccount: this.props.selectedAccount })
    }
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside)

    // Initialize last balance, rpl, and upl values
    const activeFirm = this.getActivePropFirm()
    if (activeFirm) {
      const accountInfo = activeFirm.getAccountInfo?.()
      if (accountInfo) {
        this.lastBalance = accountInfo.balance
        this.lastRpl = accountInfo.rpl
        this.lastUpl = accountInfo.upl
      }
      
      // Re-render account bar when prop firm account stats update
      if (
        activeFirm.id === 'tradesea' &&
        typeof (activeFirm as any).setOnDataReady === 'function'
      ) {
        (activeFirm as any).setOnDataReady(() => {
          this.setState({})
        })
      }

      if (activeFirm.id === 'tradesea') {
        if (typeof activeFirm.setOnChartSymbolChange === 'function') {
          activeFirm.setOnChartSymbolChange((chartSym: string) => {
            const root = chartSymbolToProductRoot(chartSym)
            debugPracticeChartSymbol('TradingRenderer.onChartSymbolChange', {
              chartSym,
              root,
              prevSelectedSymbol: this.state.selectedSymbol,
              willSetState: Boolean(root && root !== this.state.selectedSymbol),
            }, { force: true })
            if (!root || root === this.state.selectedSymbol) return
            this.setState({ selectedSymbol: root })
          })
        }
        const handler = (activeFirm as any).getHandler?.()
        if (handler) {
          handler.onUnrealizedPnLUpdate = () => {
            const accountInfo = activeFirm.getAccountInfo?.()
            if (accountInfo) {
              this.lastBalance = accountInfo.balance
              this.lastRpl = accountInfo.rpl
              this.lastUpl = accountInfo.upl
            }
            this.setState({})
          }
        }
        import('../../../services/tradesea/tradeseaDebug').then(({ isTradeseaUplDebug }) => {
          if (isTradeseaUplDebug()) {
            console.info(
              '[Tradesea UPL] UI polling active. tradeseaUplDebugState() for snapshot.'
            )
          }
        })
      }
    }
    
    // If accounts are already available, update selectedAccount to match prop
    if (this.props.accounts && this.props.accounts.length > 0 && this.props.selectedAccount) {
      if (this.props.selectedAccount !== this.state.selectedAccount) {
        this.setState({ selectedAccount: this.props.selectedAccount })
      }
    }
    
    // Load contract quantity from localStorage
    const savedQuantity = localStorage.getItem('trading_contract_quantity')
    if (savedQuantity) {
      const quantity = parseInt(savedQuantity, 10)
      if (!isNaN(quantity) && quantity >= 1) {
        this.setState({ contractQuantity: quantity })
      }
    }

    // Load showNews state from localStorage
    const savedShowNews = localStorage.getItem('trading_show_news')
    if (savedShowNews !== null) {
      this.setState({ showNews: savedShowNews === 'true' })
    }

    // Load showNav state from localStorage
    const savedShowNav = localStorage.getItem('trading_show_nav')
    const practiceNav =
      this.props.practiceMode && this.props.practiceAccountId
        ? getInitialPracticeShowNav(this.props.practiceAccountId)
        : savedShowNav !== null
          ? savedShowNav === 'true'
          : true
    if (this.props.practiceMode && this.props.practiceAccountId) {
      this.setState({ showNav: practiceNav })
    } else if (savedShowNav !== null) {
      this.setState({ showNav: savedShowNav === 'true' })
    }

    // Listen for storage changes to update layout
    window.addEventListener('storage', this.handleStorageChange)
    window.addEventListener(PRACTICE_MOBILE_TRADE_PREFS_EVENT, this.handleMobileTradePrefsChange)
    
    // Check for layout updates periodically (for same-tab changes)
    this.layoutCheckInterval = setInterval(() => {
      const newLayout = getSavedLayout(this.layoutStorageKey())
      if (JSON.stringify(newLayout) !== JSON.stringify(this.state.layout)) {
        this.setState({ layout: newLayout })
      }
    }, 500) as any
    
    // Check for account balance/rpl/upl updates periodically
    this.accountUpdateInterval = setInterval(() => {
      const activeFirm = this.getActivePropFirm()
      if (activeFirm) {
        const accountInfo = activeFirm.getAccountInfo?.()
        if (accountInfo) {
          if (accountInfo.balance !== this.lastBalance || accountInfo.rpl !== this.lastRpl || accountInfo.upl !== this.lastUpl) {
            this.lastBalance = accountInfo.balance
            this.lastRpl = accountInfo.rpl
            this.lastUpl = accountInfo.upl
            // Force re-render by updating state
            this.setState({})
          }
        }
      }
    }, 500) as any
  }

  componentWillUnmount() {
    dismissMdsConnectionToast()
    document.removeEventListener('mousedown', this.handleClickOutside)
    window.removeEventListener('storage', this.handleStorageChange)
    window.removeEventListener(PRACTICE_MOBILE_TRADE_PREFS_EVENT, this.handleMobileTradePrefsChange)
    const activeFirm = this.getActivePropFirm()
    if (activeFirm?.id === 'tradesea' && typeof activeFirm.setOnChartSymbolChange === 'function') {
      activeFirm.setOnChartSymbolChange(null)
    }
    if (this.layoutCheckInterval) {
      clearInterval(this.layoutCheckInterval)
    }
    if (this.accountUpdateInterval) {
      clearInterval(this.accountUpdateInterval)
    }
  }

  private layoutCheckInterval?: NodeJS.Timeout
  private accountUpdateInterval?: NodeJS.Timeout

  handleStorageChange = () => {
    const newLayout = getSavedLayout(this.layoutStorageKey())
    this.setState({ layout: newLayout })
  }

  handleClickOutside = (event: MouseEvent) => {
    if (
      this.accountDropdownRef.current &&
      !this.accountDropdownRef.current.contains(event.target as Node)
    ) {
      this.setState({ showAccountDropdown: false })
    }
  }

  private getPracticeMaxQty(): number | null {
    const { practiceMode, practiceAccountId } = this.props
    if (!practiceMode || !practiceAccountId) return null
    const account = getPracticeAccountById(practiceAccountId)
    if (!account) return null
    const activeFirm = this.getActivePropFirm()
    const symbolForLimit =
      (activeFirm?.chartSymbol as string | undefined) || this.state.selectedSymbol
    const datafeed = activeFirm?.chartServices?.datafeed
    const product = resolvePracticeProductSymbol(symbolForLimit, datafeed)
    return getMaxContractsForSymbol(account.size, product)
  }

  private clampPracticeQuantity(qty: number): number {
    const max = this.getPracticeMaxQty()
    if (max == null) return Math.max(1, qty)
    return Math.min(Math.max(1, qty), max)
  }

  handleQuantityChange = (delta: number) => {
    this.setState((prevState: { contractQuantity: number | string }) => {
      const currentValue = typeof prevState.contractQuantity === 'number' 
        ? prevState.contractQuantity 
        : parseInt(String(prevState.contractQuantity), 10) || 1
      const raw = currentValue + delta
      const newQuantity = this.props.practiceMode
        ? this.clampPracticeQuantity(raw)
        : Math.max(1, raw)
      TradingHandler.logQuantityChange(
        currentValue,
        newQuantity,
        delta > 0 ? 'increment' : 'decrement'
      )
      localStorage.setItem('trading_contract_quantity', newQuantity.toString())
      return { contractQuantity: newQuantity }
    })
  }

  handleQuantityUpdate = (quantity: number) => {
    const { contractQuantity } = this.state
    const oldValue = typeof contractQuantity === 'number' ? contractQuantity : parseInt(String(contractQuantity), 10) || 1
    const newQuantity = this.props.practiceMode
      ? this.clampPracticeQuantity(quantity)
      : Math.max(1, quantity)
    TradingHandler.logQuantityChange(oldValue, newQuantity, 'preset')
    this.setState({ contractQuantity: newQuantity })
    localStorage.setItem('trading_contract_quantity', newQuantity.toString())
  }

  handleQuantityInputChange = (value: string) => {
    // Allow empty input for typing
    if (value === '' || value === '-') {
      this.setState({ contractQuantity: '' })
      return
    }
    
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue) && numValue >= 1) {
      const { contractQuantity } = this.state
      const oldValue = typeof contractQuantity === 'number' ? contractQuantity : parseInt(String(contractQuantity), 10) || 1
      const next = this.props.practiceMode ? this.clampPracticeQuantity(numValue) : numValue
      TradingHandler.logQuantityChange(oldValue, next, 'input')
      this.setState({ contractQuantity: next })
      localStorage.setItem('trading_contract_quantity', String(next))
    }
  }

  handleQuantityBlur = () => {
    // If input is empty or invalid, set to 1
    const { contractQuantity } = this.state
    const numValue = typeof contractQuantity === 'number' ? contractQuantity : parseInt(String(contractQuantity), 10)
    if (!numValue || isNaN(numValue) || numValue < 1) {
      this.setState({ contractQuantity: 1 })
      localStorage.setItem('trading_contract_quantity', '1')
    } else {
      const finalQty = this.props.practiceMode ? this.clampPracticeQuantity(numValue) : numValue
      this.setState({ contractQuantity: finalQty })
      localStorage.setItem('trading_contract_quantity', String(finalQty))
    }
  }


  private layoutStorageKey(): 'trading' | 'backtester' {
    return 'trading'
  }

  render() {
    const {
      isDark,
      toggleTheme,
      navigate,
      accounts: accountsProp,
      practiceMode,
      practiceAccountId,
      practiceAccountStatus,
      onRefreshPracticeAccount,
      practiceRefreshing,
    } = this.props

    const { selectedSymbol, contractQuantity, selectedAccount, showAccountDropdown, layout } = this.state

    // Get account info from active market data provider
    const activeFirm = this.getActivePropFirm()
    
    // Prefer accounts from provider sync over props
    // This ensures we get the latest accounts even if props haven't updated yet
    let accounts = accountsProp
    if (
      activeFirm?.id === 'tradesea' &&
      activeFirm?.formattedAccounts &&
      Array.isArray(activeFirm.formattedAccounts) &&
      activeFirm.formattedAccounts.length > 0
    ) {
      accounts = activeFirm.formattedAccounts
    } else if (accountsProp !== undefined && accountsProp !== null) {
      accounts = accountsProp.length > 0 ? accountsProp : []
    } else {
      accounts = ['Account 1', 'Account 2', 'Account 3']
    }
    
    // Check if accounts are FormattedAccount objects or strings
    const formattedAccounts: FormattedAccount[] = accounts.length > 0 && typeof accounts[0] === 'object' && 'accountId' in accounts[0]
      ? (accounts as FormattedAccount[])
      : accounts.map((acc: string | any) => ({ 
          accountId: typeof acc === 'string' ? 0 : (acc.accountId || 0),
          displayName: typeof acc === 'string' ? acc : (acc.displayName || acc),
          account: typeof acc === 'string' ? null : (acc.account || null),
          templateName: '',
          accountName: typeof acc === 'string' ? acc : (acc.accountName || ''),
          isIneligible: false,
          isCombine: false,
          isExpress: false
        }))
    const accountInfo = activeFirm?.getAccountInfo?.() || {
      balance: 0,
      mll: undefined,
      rpl: 0,
      upl: 0
    }

    const navWidth = practiceMode ? 'w-11' : 'w-16'

    return (
      <div
        className={`h-screen max-h-screen overflow-hidden transition-all duration-700 ease-in-out flex ${
          practiceMode
            ? isDark
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950'
              : 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60'
            : isDark
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
              : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        {/* Navigation Sidebar - Desktop */}
        <div className={`hidden lg:block transition-all duration-300 ease-in-out ${
          this.state.showNav ? `${navWidth} opacity-100` : 'w-0 opacity-0 overflow-hidden'
        }`}>
          {this.state.showNav && (
            <TradingNav
              compact={practiceMode}
              isDark={isDark}
              navigate={navigate}
              currentPath={window.location.pathname}
              onToggleNav={() => {
                this.setState({ showNav: false })
                if (practiceMode && practiceAccountId) {
                  savePracticeShowNav(practiceAccountId, false)
                } else {
                  localStorage.setItem('trading_show_nav', 'false')
                }
              }}
              showDesktopNav={true}
              showMobileNav={false}
            />
          )}
        </div>
        
        {/* Mobile Bottom Nav - Animated */}
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 transition-all duration-300 ease-in-out transform z-50 ${
          this.state.showNav ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}>
          {this.state.showNav && (
            <TradingNav
              compact={practiceMode}
              isDark={isDark}
              navigate={navigate}
              currentPath={window.location.pathname}
              onToggleNav={() => {
                this.setState({ showNav: false })
                if (practiceMode && practiceAccountId) {
                  savePracticeShowNav(practiceAccountId, false)
                } else {
                  localStorage.setItem('trading_show_nav', 'false')
                }
              }}
              showDesktopNav={false}
              showMobileNav={true}
              onPracticeOrder={
                practiceMode && practiceAccountId
                  ? () =>
                      this.setState((s) => ({
                        practiceMobileOrderOpen: !s.practiceMobileOrderOpen,
                      }))
                  : undefined
              }
              practiceOrderActive={this.state.practiceMobileOrderOpen}
            />
          )}
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {practiceMode ? (
            <PracticeTradeHeader
              isDark={isDark}
              navigate={navigate}
              toggleTheme={toggleTheme}
              practiceAccountId={practiceAccountId}
              practiceAccountStatus={practiceAccountStatus}
              onRefreshPracticeAccount={onRefreshPracticeAccount}
              practiceRefreshing={practiceRefreshing}
              showNav={this.state.showNav}
              onShowNav={() => {
                this.setState({ showNav: true })
                if (practiceMode && practiceAccountId) {
                  savePracticeShowNav(practiceAccountId, true)
                } else {
                  localStorage.setItem('trading_show_nav', 'true')
                }
              }}
              balance={accountInfo.balance}
              rpl={accountInfo.rpl}
              upl={accountInfo.upl}
              hasOpenPosition={
                (this.getTradeHandler() as PracticeTradeHandler | undefined)?.hasAnyOpenPosition?.() ??
                Boolean(this.getTradeHandler()?.tradeCache?.getPosition?.(selectedSymbol))
              }
              mdsClient={activeFirm?.chartServices?.mds}
              onReconnectMds={() => {
                const firm = activeFirm as { reconnectMarketData?: () => void } | undefined
                if (firm?.reconnectMarketData) {
                  firm.reconnectMarketData()
                  return
                }
                const mds = activeFirm?.chartServices?.mds
                const df = activeFirm?.chartServices?.datafeed as TradeseaDatafeed | undefined
                const offOpen = mds?.on('open', () => {
                  offOpen?.()
                  df?.refreshMdsSubscriptions?.()
                  if (selectedSymbol) {
                    df?.ensureMarketBookSubscription?.(`CME:${selectedSymbol}`)
                  }
                })
                mds?.reconnect()
              }}
            />
          ) : (
          <header
            className={`border-b ${
              isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/80'
            } backdrop-blur-sm sticky top-0 z-50`}
          >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                {!this.state.showNav && (
                  <button
                    onClick={() => {
                      this.setState({ showNav: true })
                      localStorage.setItem('trading_show_nav', 'true')
                    }}
                    className={`lg:fixed lg:left-4 lg:z-50 p-2 rounded-lg transition-all flex items-center ${
                      isDark
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                    style={{ top: '1rem' }}
                    title="Show Navigation"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                )}
                <div className="flex items-center justify-start">
                  <Logo isDark={isDark} compact={true} onClick={() => navigate(ROUTES.PRACTICE)} />
                </div>
                
                <div className="relative" ref={this.accountDropdownRef}>
                  <button
                    onClick={() => this.setState({ showAccountDropdown: !showAccountDropdown })}
                    className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg border transition-all text-xs sm:text-sm ${
                      isDark
                        ? 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'bg-white/80 border-slate-300 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span className="hidden sm:inline">
                      {formattedAccounts.find(a => a.displayName === selectedAccount)?.displayName || selectedAccount}
                    </span>
                    <span className="sm:hidden">Acc</span>
                    <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showAccountDropdown && (
                    <div
                      className={`absolute top-full left-0 mt-1 min-w-[150px] rounded-lg border shadow-lg ${
                        isDark
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      {formattedAccounts.map((formattedAccount) => {
                        const account = formattedAccount.account
                        const displayName = formattedAccount.displayName
                        const isSelected = selectedAccount === displayName
                        const colorClasses = account 
                          ? getAccountColorClasses(account, isDark, isSelected)
                          : (isSelected
                              ? isDark
                                ? 'bg-slate-700 text-white'
                                : 'bg-slate-100 text-slate-900'
                              : isDark
                              ? 'text-slate-300 hover:bg-slate-700'
                              : 'text-slate-700 hover:bg-slate-50')
                        
                        return (
                          <button
                            key={formattedAccount.accountId || displayName}
                            onClick={() => {
                              const oldAccount = selectedAccount
                              this.setState({ selectedAccount: displayName, showAccountDropdown: false }, () => {
                                if (oldAccount !== displayName) {
                                  TradingHandler.logAccountChange(oldAccount, displayName)
                                  // Save to localStorage
                                  if (formattedAccount.accountId) {
                                    saveSelectedAccountId(formattedAccount.accountId)
                                    // Update selected account in prop firm and trigger account change
                                    this.updatePropFirmAccount(formattedAccount.accountId)
                                  }
                                }
                              })
                            }}
                            className={`w-full text-left px-3 py-2 text-xs sm:text-sm transition-colors ${colorClasses}`}
                          >
                            {displayName}
                        </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => {
                    localStorage.removeItem('token')
                    navigate(ROUTES.LOGIN)
                  }}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
                    isDark
                      ? 'bg-red-950/50 text-red-300 hover:bg-red-950/70 border border-red-800/50'
                      : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  }`}
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
                <ThemeToggle isDark={isDark} onToggle={toggleTheme} fixed={false} />
              </div>
            </div>
          </div>
        </header>
          )}

        {/* Main Content */}
        <main
          className={`flex-1 flex flex-col min-h-0 overflow-hidden lg:pb-4 ${
            practiceMode
              ? `px-2 py-1.5 ${this.state.showNav ? 'pb-[4.25rem]' : 'pb-1.5'}`
              : 'px-4 sm:px-6 lg:px-8 py-3 sm:py-4 pb-20'
          }`}
        >
          {!practiceMode && (
            <div className="mb-3 sm:mb-4 flex-shrink-0">
              <AccountInfoBar
                balance={accountInfo.balance}
                mll={accountInfo.mll}
                rpl={accountInfo.rpl}
                upl={accountInfo.upl}
                isDark={isDark}
              />
            </div>
          )}

          {/* Chart and Trade Layout */}
          <div className="flex-1 flex flex-col min-h-0">
            {(() => {
              // Get chart from active prop firm
              const activeFirm = this.getActivePropFirm()
              const chartComponent = activeFirm?.getRenderChart?.(selectedSymbol, "1", isDark)
              
              const chartElement = (
                <div
                  className={`trading-chart-host flex flex-col flex-1 min-h-0 h-full overflow-hidden ${
                    practiceMode
                      ? 'rounded-2xl border border-slate-700/80 bg-slate-900/90'
                      : `rounded-lg sm:rounded-xl shadow-lg border ${
                          isDark
                            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
                        }`
                  }`}
                >
                  <div className="flex-1 min-h-0 w-full relative">
                    {chartComponent || (
                      <div className="flex items-center justify-center h-full text-slate-500">
                        Chart not available
                      </div>
                    )}
                  </div>
                </div>
              )

              const runTrade = (
                action: string,
                extra?: {
                  stopLoss?: number | null
                  takeProfit?: number | null
                  orderType?: 'market' | 'limit' | 'stop'
                  entryPrice?: number
                }
              ) => {
                const qty = Number(contractQuantity) || 1
                const handler = this.getTradeHandler()
                const payload =
                  practiceMode && practiceAccountId
                    ? {
                        quantity: qty,
                        symbol: selectedSymbol,
                        ...(action === 'Buy' || action === 'Sell'
                          ? {
                              orderType: extra?.orderType,
                              entryPrice: extra?.entryPrice,
                              stopLoss: extra?.stopLoss ?? null,
                              takeProfit: extra?.takeProfit ?? null,
                            }
                          : {}),
                      }
                    : action === 'Buy' || action === 'Sell'
                      ? {
                          quantity: qty,
                          symbol: selectedSymbol,
                          orderType: extra?.orderType,
                          entryPrice: extra?.entryPrice,
                          stopLoss: extra?.stopLoss ?? null,
                          takeProfit: extra?.takeProfit ?? null,
                        }
                      : undefined
                if (handler) {
                  void handler.logButtonPress(action, payload)
                } else if (payload) {
                  TradingHandler.logButtonPress(action, payload)
                } else {
                  TradingHandler.logButtonPress(action)
                }
              }

              if (practiceMode && practiceAccountId) {
                const padDetached = isPracticePadDetached(practiceAccountId)
                const tsDatafeed = activeFirm?.chartServices?.datafeed as TradeseaDatafeed | undefined
                const tradeHandler = this.getTradeHandler()
                const padRoot =
                  (activeFirm?.chartSymbol as string | undefined) ||
                  selectedSymbol
                const chartSymbolLabel =
                  tsDatafeed?.resolveStreamInstrument(`CME:${padRoot}`) ?? `CME:${padRoot}`
                const practiceMaxQty = this.getPracticeMaxQty() ?? 10
                const resolvePracticeBook = () => {
                  if (tradeHandler && 'getActiveMarketBook' in tradeHandler) {
                    return (
                      tradeHandler as {
                        getActiveMarketBook: () => ReturnType<TradeseaDatafeed['getMarketBookForChart']>
                      }
                    ).getActiveMarketBook()
                  }
                  return tsDatafeed?.getMarketBookForChart?.(chartSymbolLabel) ?? null
                }
                const runJoinLimit = (side: 'buy' | 'sell') => {
                  const book = resolvePracticeBook()
                  const { bid, ask } = resolveTradePanelBidAsk(book)
                  const price = side === 'buy' ? bid : ask
                  if (price == null || !Number.isFinite(price)) {
                    aurenToast.warning(
                      side === 'buy' ? 'Waiting for bid' : 'Waiting for ask',
                      'Market book not ready yet'
                    )
                    return
                  }
                  if (tradeHandler instanceof PracticeTradeHandler) {
                    void tradeHandler.placeLimitOrder(side, Number(contractQuantity) || 1, price)
                    return
                  }
                  runTrade(side === 'buy' ? 'Buy' : 'Sell', { entryPrice: price })
                }
                const padProps = {
                  practiceAccountId,
                  isDark,
                  chartSymbol: chartSymbolLabel,
                  onChartSymbolChange: (sym: string) => {
                    const root = chartSymbolToProductRoot(sym)
                    if (!root) return
                    const label =
                      activeFirm?.chartServices?.datafeed?.resolveStreamInstrument?.(
                        `CME:${root}`
                      ) ?? `CME:${root}`
                    void activeFirm?.chartServices?.datafeed?.ensureMarketBookSubscription?.(label)
                    if (root !== selectedSymbol) {
                      this.setState({ selectedSymbol: root })
                    }
                  },
                  quantity: contractQuantity,
                  onQuantityChange: this.handleQuantityChange,
                  onQuantityUpdate: this.handleQuantityUpdate,
                  onQuantityInputChange: this.handleQuantityInputChange,
                  onQuantityBlur: this.handleQuantityBlur,
                  markPrice: (() => {
                    if (!tradeHandler || !('getActiveMarkPrice' in tradeHandler)) return null
                    try {
                      return (
                        tradeHandler as { getActiveMarkPrice: () => number | null }
                      ).getActiveMarkPrice()
                    } catch {
                      return null
                    }
                  })(),
                  getMarketBook: () => {
                    if (tradeHandler && 'getActiveMarketBook' in tradeHandler) {
                      const fromHandler = (
                        tradeHandler as { getActiveMarketBook: () => ReturnType<TradeseaDatafeed['getMarketBookForChart']> }
                      ).getActiveMarketBook()
                      if (fromHandler) return fromHandler
                    }
                    return tsDatafeed?.getMarketBookForChart?.(chartSymbolLabel) ?? null
                  },
                  subscribeMarketBook: tsDatafeed
                    ? (onUpdate: () => void) => tsDatafeed.subscribeMarketBook(onUpdate)
                    : undefined,
                  ensureMarketBook: tsDatafeed
                    ? () => tsDatafeed.ensureMarketBookSubscription(chartSymbolLabel)
                    : undefined,
                  getChartPositionUpl:
                    tradeHandler instanceof PracticeTradeHandler
                      ? () => tradeHandler.getActiveChartPositionUpl()
                      : undefined,
                  getDomPositionContext:
                    tradeHandler instanceof PracticeTradeHandler
                      ? () => tradeHandler.getActiveChartDomPosition()
                      : undefined,
                  tickSize: activeFirm?.chartServices?.datafeed?.getTickSize?.(padRoot) ?? 0.25,
                  onDetach: () => {
                    togglePracticePadDetached(practiceAccountId)
                    this.forceUpdate()
                  },
                  onBuy: () => runTrade('Buy'),
                  onSell: () => runTrade('Sell'),
                  onJoinBid: () => runJoinLimit('buy'),
                  onJoinAsk: () => runJoinLimit('sell'),
                  onSubmitOrder: (side, brackets, order) => {
                    const qty = Number(contractQuantity) || 1
                    if (
                      tradeHandler instanceof PracticeTradeHandler &&
                      order?.orderType !== 'market' &&
                      order.entryPrice != null
                    ) {
                      void tradeHandler.placeLimitOrder(
                        side === 'buy' ? 'buy' : 'sell',
                        qty,
                        order.entryPrice,
                        {
                          stopLoss: brackets.stopLoss,
                          takeProfit: brackets.takeProfit,
                        }
                      )
                      return
                    }
                    runTrade(side === 'buy' ? 'Buy' : 'Sell', {
                      stopLoss: brackets.stopLoss,
                      takeProfit: brackets.takeProfit,
                      orderType: order?.orderType,
                      entryPrice:
                        order?.orderType === 'market' ? undefined : order?.entryPrice,
                    })
                  },
                  onClose: () => runTrade('Close Position'),
                  onReverse: () => runTrade('Reverse Position'),
                  onFlatten: () => runTrade('Flatten All Position'),
                }

                const mobileOrderOpen = Boolean(this.state.practiceMobileOrderOpen)
                const mobileTradePrefs = getPracticeMobileTradePrefs(practiceAccountId)

                return (
                  <div className="relative flex flex-1 min-h-0 min-w-0 h-full w-full">
                    {renderPracticeTradeLayout(
                      chartElement,
                      padDetached ? null : <PracticeTradePanel {...padProps} />,
                      {
                        mobileScalpBar: (
                          <PracticeMobileScalpBar
                            accountId={practiceAccountId}
                            props={padProps}
                            maxQty={practiceMaxQty}
                            isDark={isDark}
                          />
                        ),
                      }
                    )}
                    <PracticeMobileOrderSheet
                      open={mobileOrderOpen}
                      onClose={() => this.setState({ practiceMobileOrderOpen: false })}
                      isDark={isDark}
                      padProps={padProps}
                    />
                    {padDetached && (
                      <div className="hidden lg:block">
                        <PracticeDetachedTradePanel
                          accountId={practiceAccountId}
                          isDark={isDark}
                          padProps={padProps}
                          chartSymbol={chartSymbolLabel}
                          maxQty={practiceMaxQty}
                          onDock={() => this.forceUpdate()}
                        />
                      </div>
                    )}
                    {mobileTradePrefs.floatingPad && (
                      <div className="lg:hidden">
                        <PracticeDetachedTradePanel
                          accountId={practiceAccountId}
                          isDark={isDark}
                          padProps={padProps}
                          chartSymbol={chartSymbolLabel}
                          maxQty={practiceMaxQty}
                          dockMode="mobile-float"
                          dockTitle="Pin quick trade"
                          onDock={() => {
                            setPracticeMobileFloatingPad(practiceAccountId, false)
                            this.forceUpdate()
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              }

              const panelElement = (
                <div
                  className={`rounded-lg sm:rounded-xl shadow-lg border flex flex-col lg:h-full ${
                    isDark
                      ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                      : 'bg-white/90 border-slate-200 backdrop-blur-sm'
                  }`}
                >
                  <div className={`p-3 sm:p-4 border-b flex-shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Trade
                    </h3>
                  </div>
                  <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 flex-shrink-0">
                    <ContractQuantityControl
                      quantity={contractQuantity}
                      onQuantityChange={this.handleQuantityChange}
                      onQuantityUpdate={this.handleQuantityUpdate}
                      onQuantityInputChange={this.handleQuantityInputChange}
                      onQuantityBlur={this.handleQuantityBlur}
                      isDark={isDark}
                    />

                    <TradeButtons
                      onBuy={() => {
                          const qty = Number(contractQuantity) || 1
                          const handler = this.getTradeHandler()
                          if (handler) {
                            handler.logButtonPress('Buy', { quantity: qty, symbol: selectedSymbol })
                          } else {
                            TradingHandler.logButtonPress('Buy', { quantity: qty, symbol: selectedSymbol })
                          }
                        }}
                      onSell={() => {
                          const qty = Number(contractQuantity) || 1
                          const handler = this.getTradeHandler()
                          if (handler) {
                            handler.logButtonPress('Sell', { quantity: qty, symbol: selectedSymbol })
                          } else {
                            TradingHandler.logButtonPress('Sell', { quantity: qty, symbol: selectedSymbol })
                          }
                        }}
                      isDark={isDark}
                    />

                    <PositionButtons
                      onClose={() => {
                          const handler = this.getTradeHandler()
                          if (handler) {
                            handler.logButtonPress('Close Position')
                          } else {
                            TradingHandler.logButtonPress('Close Position')
                          }
                        }}
                      onReverse={() => {
                          const handler = this.getTradeHandler()
                          if (handler) {
                            handler.logButtonPress('Reverse Position')
                          } else {
                            TradingHandler.logButtonPress('Reverse Position')
                          }
                        }}
                      onFlatten={() => {
                          const handler = this.getTradeHandler()
                          if (handler) {
                            handler.logButtonPress('Flatten All Position')
                          } else {
                            TradingHandler.logButtonPress('Flatten All Position')
                          }
                        }}
                      isDark={isDark}
                    />
                  </div>

                  {/* News Section (Under Trade) - Fixed height container to prevent layout shifts */}
                  <div
                    className={`flex-shrink-0 border-t lg:flex-1 lg:flex lg:flex-col lg:min-h-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
                  >
                    {this.state.showNews ? (
                      <div className={`p-3 sm:p-4 flex flex-col h-full lg:min-h-0`}>
                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                          <h3 className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Economic News
                          </h3>
                          <button
                            onClick={() => {
                              this.setState({ showNews: false })
                              localStorage.setItem('trading_show_news', 'false')
                            }}
                            className={`text-xs px-2 py-1 rounded ${
                              isDark
                                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            Hide
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto lg:min-h-0">
                          <EconomicNewsPanel isDark={isDark} />
                        </div>
                      </div>
                    ) : (
                      <div className={`p-3 sm:p-4`}>
                        <button
                          onClick={() => {
                            this.setState({ showNews: true })
                            localStorage.setItem('trading_show_news', 'true')
                          }}
                          className={`w-full text-xs px-3 py-2 rounded-lg ${
                            isDark
                              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          Show Economic News
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )

              return renderLayout(layout, chartElement, panelElement)
            })()}
          </div>

        </main>
        </div>
      </div>
    )
  }
}

export default TradingRenderer
