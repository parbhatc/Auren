import { Component, createRef } from 'react'
import { ROUTES } from '../../../constants/routes'
import { TradingProps, TradingRendererState } from '../../../types/trading'
import { TradingHandler } from '../../../services/trading/TradingHandler'
import { getSavedLayout } from '../../../utils/tradingLayoutStorage'
import { renderLayout } from '../../../utils/layoutRenderer'
import { FormattedAccount } from '../../../utils/marketAccountDisplay'
import { getTradeTradeseaAccount } from '../../../constants/trade'
import { TradeHeader } from './TradeHeader'
import { PracticeTradeHandler } from '../../../services/practice/PracticeTradeHandler'
import type { TradeseaDatafeed } from '../../../services/tradesea/TradeseaDatafeed'
import type { TradeseaMdsClient } from '../../../services/tradesea/TradeseaMdsClient'
import { getPracticeAccountById } from '../../../constants/practice'
import { getMaxContractsForSymbol } from '../../../services/practice/practiceLimits'
import { resolvePracticeProductSymbol } from '../../../services/practice/practiceSymbol'
import { dismissMdsConnectionToast } from '../../../services/tradesea/mdsConnectionToast'
import { chartSymbolToProductRoot } from '../../../services/tradesea/tradeseaSymbolInfo'
import type { TradeseaSearchSymbolResult } from '../../../services/tradesea/tradeseaSymbolInfo'
import { debugPracticeChartSymbol } from '../../../services/tradesea/practiceChartSymbolDebug'
import {
  getInitialPracticeShowNav,
  savePracticeShowNav,
} from '../../../utils/practiceTradePreferences'
import { schedulePageScrollReset } from '../../../utils/resetPageScroll'
import { getTradePadSymbol, getTradePadAutoChange, saveTradePadAutoChange, saveTradePadSymbol } from '../../../utils/tradePadSymbol'
import { PRACTICE_MOBILE_TRADE_PREFS_EVENT, setMobileFloatingPad } from '../../../utils/mobileTradePrefs'
import {
  getActivePropFirm,
  getMdsClient,
  getTradeHandler,
  updatePropFirmAccount,
} from './tradingRenderer/propFirm'
import { resolveAccountsList, resolveFormattedAccounts } from './tradingRenderer/accounts'
import { createRunTrade } from './tradingRenderer/tradeActions'
import { buildTradePadProps } from './tradingRenderer/buildTradePadProps'
import { TradingRendererNav } from './tradingRenderer/TradingRendererNav'
import { TradingChartHost } from './tradingRenderer/TradingChartHost'
import { TerminalTradeLayout } from './tradingRenderer/TerminalTradeLayout'
import { ClassicTradePanel } from './tradingRenderer/ClassicTradePanel'

/**
 * Trading renderer component
 * Practice trading terminal layout
 */
class TradingRenderer extends Component<TradingProps, TradingRendererState> {
  private accountDropdownRef = createRef<HTMLDivElement>()
  private mdsClientRef: TradeseaMdsClient | null = null
  private mdsConnectionCleanups: (() => void)[] = []

  state: TradingRendererState = {
    selectedSymbol: 'MNQ',
    tradePadSymbol: null,
    contractQuantity: 1 as number | string,
    selectedAccount: this.props.selectedAccount || 'Account 1',
    showAccountDropdown: false,
    layout: getSavedLayout('trading'),
    showNews: true,
    showNav: true,
    practiceMobileOrderOpen: false,
    practiceMobileSettingsOpen: false,
    marketDataLive: true,
  }

  private lastBalance: number = 0
  private lastRpl: number = 0
  private lastUpl: number = 0
  private lastFormattedAccountsKey = ''

  private handleMobileTradePrefsChange = () => {
    if (this.props.practiceMode || this.props.liveMode) this.forceUpdate()
  }

  private isTerminalShell(): boolean {
    return Boolean(this.props.practiceMode || this.props.liveMode)
  }

  private getPadSessionId(): string | null {
    if (this.props.practiceAccountId) return this.props.practiceAccountId
    if (this.props.liveMode) {
      const { accountId } = getTradeTradeseaAccount()
      return accountId || 'live'
    }
    return null
  }

  private getActiveFirm() {
    return getActivePropFirm(this.props.practiceMode)
  }

  private getMds() {
    return getMdsClient(this.props.practiceMode)
  }

  private getHandler() {
    return getTradeHandler(this.props.practiceMode)
  }

  private bindMdsConnectionState() {
    const mds = this.getMds()
    if (mds === this.mdsClientRef) return
    this.unbindMdsConnectionState()
    this.mdsClientRef = mds
    if (!mds) {
      if (this.state.marketDataLive === false) {
        this.setState({ marketDataLive: true })
      }
      return
    }
    const sync = () => {
      const live = mds.getConnectionState() === 'connected'
      if (live !== this.state.marketDataLive) {
        this.setState({ marketDataLive: live })
      }
    }
    sync()
    this.mdsConnectionCleanups = [
      mds.on('connection', sync),
      mds.on('open', sync),
      mds.on('close', sync),
    ]
  }

  private unbindMdsConnectionState() {
    this.mdsConnectionCleanups.forEach((fn) => fn())
    this.mdsConnectionCleanups = []
    this.mdsClientRef = null
  }

  componentDidUpdate(prevProps: TradingProps) {
    const activeFirm = this.getActiveFirm()
    if (
      activeFirm?.id === 'tradesea' &&
      activeFirm?.formattedAccounts &&
      Array.isArray(activeFirm.formattedAccounts) &&
      activeFirm.formattedAccounts.length > 0
    ) {
      const currentAccounts = activeFirm.formattedAccounts
      const currentKey = currentAccounts
        .map((acc: FormattedAccount) => String(acc.account?.id ?? acc.displayName ?? ''))
        .join('|')

      if (currentKey !== this.lastFormattedAccountsKey) {
        this.lastFormattedAccountsKey = currentKey

        const prevAccounts = prevProps.accounts || []
        const accountsChangedFromProps =
          prevAccounts.length > 0 &&
          (currentAccounts.length !== prevAccounts.length ||
            currentAccounts.some(
              (acc: FormattedAccount, idx: number) =>
                acc.account?.id !== prevAccounts[idx]?.account?.id
            ))

        if (accountsChangedFromProps) {
          this.forceUpdate()
        } else if (!this.props.practiceMode) {
          const saved = getTradeTradeseaAccount()
          const match = currentAccounts.find(
            (acc: FormattedAccount) => acc.account?.id === saved.accountId
          )
          const nextLabel = match?.displayName ?? currentAccounts[0]?.displayName
          if (nextLabel && nextLabel !== this.state.selectedAccount) {
            this.setState({ selectedAccount: nextLabel })
          }
        }
      }
    }

    if (this.props.selectedAccount && this.props.selectedAccount !== prevProps.selectedAccount) {
      this.setState({ selectedAccount: this.props.selectedAccount })
      const accounts = this.props.accounts || []
      const formattedAccount = (accounts as any[]).find(
        (a: any) => a.displayName === this.props.selectedAccount
      )
      if (formattedAccount && formattedAccount.accountId !== undefined) {
        updatePropFirmAccount(formattedAccount.accountId)
      }
    }

    if (
      this.props.accounts &&
      this.props.accounts.length > 0 &&
      (!prevProps.accounts || prevProps.accounts.length === 0)
    ) {
      if (this.props.selectedAccount && this.props.selectedAccount !== this.state.selectedAccount) {
        this.setState({ selectedAccount: this.props.selectedAccount })
      }
    }

    if (
      this.props.selectedAccount &&
      this.props.selectedAccount !== prevProps.selectedAccount &&
      this.props.selectedAccount !== this.state.selectedAccount
    ) {
      this.setState({ selectedAccount: this.props.selectedAccount })
    }

    this.bindMdsConnectionState()

    if (
      this.props.practiceAccountId &&
      this.props.practiceAccountId !== prevProps.practiceAccountId
    ) {
      this.syncTradePadSymbolFromStorage(this.props.practiceAccountId)
    }
  }

  componentDidMount() {
    this.syncTradePadSymbolFromStorage()
    document.addEventListener('mousedown', this.handleClickOutside)

    const activeFirm = this.getActiveFirm()
    if (activeFirm) {
      const accountInfo = activeFirm.getAccountInfo?.()
      if (accountInfo) {
        this.lastBalance = accountInfo.balance
        this.lastRpl = accountInfo.rpl
        this.lastUpl = accountInfo.upl
      }

      if (
        activeFirm.id === 'tradesea' &&
        typeof (activeFirm as any).setOnDataReady === 'function'
      ) {
        ;(activeFirm as any).setOnDataReady(() => {
          this.setState({})
        })
      }

      if (activeFirm.id === 'tradesea') {
        if (typeof activeFirm.setOnChartSymbolChange === 'function') {
          activeFirm.setOnChartSymbolChange((chartSym: string) => {
            const root = chartSymbolToProductRoot(chartSym)
            debugPracticeChartSymbol(
              'TradingRenderer.onChartSymbolChange',
              {
                chartSym,
                root,
                prevSelectedSymbol: this.state.selectedSymbol,
                willSetState: Boolean(root && root !== this.state.selectedSymbol),
              },
              { force: true }
            )
            if (!root || root === this.state.selectedSymbol) return
            const padId = this.getPadSessionId()
            const next: Pick<typeof this.state, 'selectedSymbol' | 'tradePadSymbol'> = {
              selectedSymbol: root,
              tradePadSymbol: this.state.tradePadSymbol,
            }
            if (padId && getTradePadAutoChange(padId)) {
              next.tradePadSymbol = root
              saveTradePadSymbol(padId, root)
            }
            this.setState(next)
          })
        }
        const handler = (activeFirm as any).getHandler?.()
        if (handler) {
          handler.onUnrealizedPnLUpdate = () => {
          const accountInfo = activeFirm.getAccountInfo?.()
          if (!accountInfo) return
          if (
            accountInfo.balance === this.lastBalance &&
            accountInfo.rpl === this.lastRpl &&
            accountInfo.upl === this.lastUpl
          ) {
            return
          }
          this.lastBalance = accountInfo.balance
          this.lastRpl = accountInfo.rpl
          this.lastUpl = accountInfo.upl
          this.setState({})
        }
        }
        import('../../../services/tradesea/tradeseaDebug').then(({ isTradeseaUplDebug }) => {
          if (isTradeseaUplDebug()) {
            console.info('[Tradesea UPL] UI polling active. tradeseaUplDebugState() for snapshot.')
          }
        })
      }
    }

    this.bindMdsConnectionState()

    if (this.props.accounts && this.props.accounts.length > 0 && this.props.selectedAccount) {
      if (this.props.selectedAccount !== this.state.selectedAccount) {
        this.setState({ selectedAccount: this.props.selectedAccount })
      }
    }

    const savedQuantity = localStorage.getItem('trading_contract_quantity')
    if (savedQuantity) {
      const quantity = parseInt(savedQuantity, 10)
      if (!isNaN(quantity) && quantity >= 1) {
        this.setState({ contractQuantity: quantity })
      }
    }

    const savedShowNews = localStorage.getItem('trading_show_news')
    if (savedShowNews !== null) {
      this.setState({ showNews: savedShowNews === 'true' })
    }

    const savedShowNav = localStorage.getItem('trading_show_nav')
    const practiceNav =
      (this.props.practiceMode && this.props.practiceAccountId) || this.props.liveMode
        ? getInitialPracticeShowNav(
            this.props.practiceAccountId ?? (getTradeTradeseaAccount().accountId || 'live')
          )
        : savedShowNav !== null
          ? savedShowNav === 'true'
          : true
    if ((this.props.practiceMode && this.props.practiceAccountId) || this.props.liveMode) {
      this.setState({ showNav: practiceNav })
    } else if (savedShowNav !== null) {
      this.setState({ showNav: savedShowNav === 'true' })
    }

    window.addEventListener('storage', this.handleStorageChange)
    window.addEventListener(PRACTICE_MOBILE_TRADE_PREFS_EVENT, this.handleMobileTradePrefsChange)

    this.layoutCheckInterval = setInterval(() => {
      const newLayout = getSavedLayout(this.layoutStorageKey())
      if (JSON.stringify(newLayout) !== JSON.stringify(this.state.layout)) {
        this.setState({ layout: newLayout })
      }
    }, 500) as any

    this.accountUpdateInterval = setInterval(() => {
      const firm = this.getActiveFirm()
      if (firm) {
        const accountInfo = firm.getAccountInfo?.()
        if (accountInfo) {
          if (
            accountInfo.balance !== this.lastBalance ||
            accountInfo.rpl !== this.lastRpl ||
            accountInfo.upl !== this.lastUpl
          ) {
            this.lastBalance = accountInfo.balance
            this.lastRpl = accountInfo.rpl
            this.lastUpl = accountInfo.upl
            this.setState({})
          }
        }
      }
    }, 500) as any
  }

  componentWillUnmount() {
    this.unbindMdsConnectionState()
    dismissMdsConnectionToast()
    document.removeEventListener('mousedown', this.handleClickOutside)
    window.removeEventListener('storage', this.handleStorageChange)
    window.removeEventListener(PRACTICE_MOBILE_TRADE_PREFS_EVENT, this.handleMobileTradePrefsChange)
    const activeFirm = this.getActiveFirm()
    if (activeFirm?.id === 'tradesea' && typeof activeFirm.setOnChartSymbolChange === 'function') {
      activeFirm.setOnChartSymbolChange(null)
    }
    if (this.layoutCheckInterval) {
      clearInterval(this.layoutCheckInterval)
    }
    if (this.accountUpdateInterval) {
      clearInterval(this.accountUpdateInterval)
    }
    if (this.isTerminalShell()) {
      schedulePageScrollReset()
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

  private searchPadSymbols = (query: string): Promise<TradeseaSearchSymbolResult[]> => {
    const datafeed = this.getActiveFirm()?.chartServices?.datafeed as TradeseaDatafeed | undefined
    if (!datafeed) return Promise.resolve([])
    return new Promise((resolve) => {
      datafeed.searchSymbols(query, '', '', resolve)
    })
  }

  private getTradePadRoot(): string {
    return this.state.tradePadSymbol || this.state.selectedSymbol || 'MNQ'
  }

  private resolveTradePadStreamLabel(datafeed?: TradeseaDatafeed | null): string {
    const root = this.getTradePadRoot()
    return datafeed?.resolveStreamInstrument?.(`CME:${root}`) ?? `CME:${root}`
  }

  private resolveChartStreamLabel(datafeed?: TradeseaDatafeed | null): string {
    const root = this.state.selectedSymbol || 'MNQ'
    return datafeed?.resolveStreamInstrument?.(`CME:${root}`) ?? `CME:${root}`
  }

  private syncTradePadSymbolFromStorage(accountId?: string): void {
    const id =
      accountId ??
      this.props.practiceAccountId ??
      (this.props.liveMode ? this.getPadSessionId() : null)
    if (!id) return
    const saved = getTradePadSymbol(id)
    if (saved && saved !== this.state.tradePadSymbol) {
      this.setState({ tradePadSymbol: saved })
    }
  }

  private getPracticeMaxQty(): number | null {
    const { practiceMode, practiceAccountId } = this.props
    if (!practiceMode || !practiceAccountId) return null
    const account = getPracticeAccountById(practiceAccountId)
    if (!account) return null
    const activeFirm = this.getActiveFirm()
    const symbolForLimit = this.getTradePadRoot()
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
      const currentValue =
        typeof prevState.contractQuantity === 'number'
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
    const oldValue =
      typeof contractQuantity === 'number'
        ? contractQuantity
        : parseInt(String(contractQuantity), 10) || 1
    const newQuantity = this.props.practiceMode
      ? this.clampPracticeQuantity(quantity)
      : Math.max(1, quantity)
    TradingHandler.logQuantityChange(oldValue, newQuantity, 'preset')
    this.setState({ contractQuantity: newQuantity })
    localStorage.setItem('trading_contract_quantity', newQuantity.toString())
  }

  handleQuantityInputChange = (value: string) => {
    if (value === '' || value === '-') {
      this.setState({ contractQuantity: '' })
      return
    }

    const numValue = parseInt(value, 10)
    if (!isNaN(numValue) && numValue >= 1) {
      const { contractQuantity } = this.state
      const oldValue =
        typeof contractQuantity === 'number'
          ? contractQuantity
          : parseInt(String(contractQuantity), 10) || 1
      const next = this.props.practiceMode ? this.clampPracticeQuantity(numValue) : numValue
      TradingHandler.logQuantityChange(oldValue, next, 'input')
      this.setState({ contractQuantity: next })
      localStorage.setItem('trading_contract_quantity', String(next))
    }
  }

  handleQuantityBlur = () => {
    const { contractQuantity } = this.state
    const numValue =
      typeof contractQuantity === 'number'
        ? contractQuantity
        : parseInt(String(contractQuantity), 10)
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

  private hideNav = (padSessionId: string | null) => {
    this.setState({ showNav: false })
    if (padSessionId) {
      savePracticeShowNav(padSessionId, false)
    } else {
      localStorage.setItem('trading_show_nav', 'false')
    }
  }

  private showNavBar = (padSessionId: string | null) => {
    this.setState({ showNav: true })
    if (padSessionId) {
      savePracticeShowNav(padSessionId, true)
    } else {
      localStorage.setItem('trading_show_nav', 'true')
    }
  }

  private handleShowNewsChange = (showNews: boolean) => {
    this.setState({ showNews })
    localStorage.setItem('trading_show_news', showNews ? 'true' : 'false')
  }

  render() {
    const {
      isDark,
      toggleTheme,
      navigate,
      accounts: accountsProp,
      practiceMode,
      liveMode,
      practiceAccountId,
      practiceAccountStatus,
      onRefreshPracticeAccount,
      practiceRefreshing,
    } = this.props

    const { selectedSymbol, contractQuantity, selectedAccount, layout } = this.state

    const activeFirm = this.getActiveFirm()
    const mdsClient = this.getMds()
    const marketDataLive = !mdsClient || this.state.marketDataLive !== false
    const tradingBlocked = Boolean(mdsClient) && !marketDataLive

    const accounts = resolveAccountsList(accountsProp, activeFirm)
    const formattedAccounts = resolveFormattedAccounts(accounts)
    const accountInfo = activeFirm?.getAccountInfo?.() || {
      balance: 0,
      mll: undefined,
      rpl: 0,
      upl: 0,
    }

    const terminalShell = this.isTerminalShell()
    const padSessionId = this.getPadSessionId()
    const navWidth = terminalShell ? 'w-11' : 'w-16'

    const chartComponent = activeFirm?.getRenderChart?.(selectedSymbol, '1', isDark)
    const chartElement = (
      <TradingChartHost
        terminalShell={terminalShell}
        isDark={isDark}
        chartComponent={chartComponent}
      />
    )

    const runTrade = createRunTrade({
      tradingBlocked,
      contractQuantity,
      practiceMode,
      practiceAccountId,
      getTradeHandler: () => this.getHandler(),
      getTradePadRoot: () => this.getTradePadRoot(),
    })

    const renderMainContent = () => {
      if (terminalShell && padSessionId) {
        const tsDatafeed = activeFirm?.chartServices?.datafeed as TradeseaDatafeed | undefined
        const tradeHandler = this.getHandler()
        const padRoot = this.getTradePadRoot()
        const chartSymbolLabel = this.resolveTradePadStreamLabel(tsDatafeed)
        const chartStreamLabel = this.resolveChartStreamLabel(tsDatafeed)
        const chartSymbolHint =
          chartStreamLabel.trim().toUpperCase() !== chartSymbolLabel.trim().toUpperCase()
            ? chartStreamLabel
            : undefined
        const practiceMaxQty = practiceMode ? (this.getPracticeMaxQty() ?? 10) : 100

        const padProps = buildTradePadProps({
          padSessionId,
          liveMode,
          isDark,
          marketDataLive,
          chartSymbolLabel,
          chartSymbolHint,
          chartProductRoot: this.state.selectedSymbol || 'MNQ',
          padRoot,
          contractQuantity,
          activeFirm,
          tsDatafeed,
          tradeHandler,
          tradingBlocked,
          searchPadSymbols: this.searchPadSymbols,
          onQuantityChange: this.handleQuantityChange,
          onQuantityUpdate: this.handleQuantityUpdate,
          onQuantityInputChange: this.handleQuantityInputChange,
          onQuantityBlur: this.handleQuantityBlur,
          onTradePadSymbolChange: (root) => {
            if (root !== this.state.tradePadSymbol) {
              this.setState({ tradePadSymbol: root })
            }
          },
          onForceUpdate: () => this.forceUpdate(),
          runTrade,
        })

        return (
          <TerminalTradeLayout
            padSessionId={padSessionId}
            chartElement={chartElement}
            padProps={padProps}
            practiceMaxQty={practiceMaxQty}
            isDark={isDark}
            showMobileNav={this.state.showNav}
            mobileOrderOpen={Boolean(this.state.practiceMobileOrderOpen)}
            mobileSettingsOpen={Boolean(this.state.practiceMobileSettingsOpen)}
            onCloseMobileOrder={() => this.setState({ practiceMobileOrderOpen: false })}
            onCloseMobileSettings={() => this.setState({ practiceMobileSettingsOpen: false })}
            onForceUpdate={() => this.forceUpdate()}
          />
        )
      }

      const panelElement = (
        <ClassicTradePanel
          isDark={isDark}
          contractQuantity={contractQuantity}
          selectedSymbol={selectedSymbol}
          tradingBlocked={tradingBlocked}
          showNews={this.state.showNews}
          onQuantityChange={this.handleQuantityChange}
          onQuantityUpdate={this.handleQuantityUpdate}
          onQuantityInputChange={this.handleQuantityInputChange}
          onQuantityBlur={this.handleQuantityBlur}
          onShowNewsChange={this.handleShowNewsChange}
          getTradeHandler={() => this.getHandler()}
        />
      )

      return renderLayout(layout, chartElement, panelElement)
    }

    return (
      <div
        className={`transition-all duration-700 ease-in-out flex ${
          terminalShell
            ? 'min-h-dvh h-dvh max-h-dvh overflow-hidden'
            : 'h-screen max-h-screen overflow-hidden'
        } ${
          terminalShell
            ? isDark
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950'
              : 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60'
            : isDark
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
              : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        <TradingRendererNav
          showNav={this.state.showNav}
          terminalShell={terminalShell}
          navWidth={navWidth}
          isDark={isDark}
          navigate={navigate}
          padSessionId={padSessionId}
          liveMode={Boolean(liveMode)}
          practiceMobileOrderOpen={Boolean(this.state.practiceMobileOrderOpen)}
          practiceMobileSettingsOpen={Boolean(this.state.practiceMobileSettingsOpen)}
          showMobileSettings={Boolean(practiceMode && padSessionId && !practiceAccountStatus)}
          onHideNav={() => this.hideNav(padSessionId)}
          onToggleMobileOrder={() => {
            const opening = !this.state.practiceMobileOrderOpen
            if (opening && padSessionId) {
              setMobileFloatingPad(padSessionId, false)
            }
            this.setState({
              practiceMobileOrderOpen: opening,
              practiceMobileSettingsOpen: opening ? false : this.state.practiceMobileSettingsOpen,
            })
          }}
          onToggleMobileSettings={() => {
            const opening = !this.state.practiceMobileSettingsOpen
            if (opening && padSessionId) {
              setMobileFloatingPad(padSessionId, false)
            }
            this.setState({
              practiceMobileSettingsOpen: opening,
              practiceMobileOrderOpen: opening ? false : this.state.practiceMobileOrderOpen,
            })
          }}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {terminalShell ? (
            <TradeHeader
              isDark={isDark}
              navigate={navigate}
              toggleTheme={toggleTheme}
              practiceAccountId={practiceMode ? practiceAccountId : undefined}
              practiceAccountStatus={practiceAccountStatus}
              onRefreshPracticeAccount={onRefreshPracticeAccount}
              practiceRefreshing={practiceRefreshing}
              showNav={this.state.showNav}
              onShowNav={() => this.showNavBar(padSessionId)}
              balance={accountInfo.balance}
              rpl={accountInfo.rpl}
              upl={accountInfo.upl}
              hasOpenPosition={
                practiceMode
                  ? (this.getHandler() as PracticeTradeHandler | undefined)?.hasAnyOpenPosition?.() ??
                    Boolean(this.getHandler()?.tradeCache?.getPosition?.(selectedSymbol))
                  : Boolean(this.getHandler()?.tradeCache?.getPosition?.(selectedSymbol))
              }
              mdsClient={
                activeFirm?.chartServices?.mds ??
                (activeFirm as { mdsClient?: typeof activeFirm.chartServices.mds })?.mdsClient
              }
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
              liveMode={Boolean(liveMode)}
              liveAccounts={formattedAccounts}
              selectedLiveAccountLabel={selectedAccount}
              onSelectLiveAccount={(accountId, displayName) => {
                const oldAccount = selectedAccount
                this.setState({ selectedAccount: displayName }, () => {
                  if (oldAccount !== displayName) {
                    TradingHandler.logAccountChange(oldAccount, displayName)
                    updatePropFirmAccount(accountId)
                  }
                })
              }}
              onRefreshLiveAccounts={onRefreshPracticeAccount}
              liveRefreshing={practiceRefreshing}
              hubPath={liveMode ? `${ROUTES.HOME}?mode=live` : ROUTES.PRACTICE}
            />
          ) : null}

          <main
            className={`flex-1 flex flex-col min-h-0 overflow-hidden lg:pb-4 ${
              terminalShell
                ? 'p-0 max-lg:pb-0 lg:px-2 lg:py-1.5'
                : 'px-4 sm:px-6 lg:px-8 py-3 sm:py-4 pb-20'
            }`}
          >
            <div className="flex-1 flex flex-col min-h-0">{renderMainContent()}</div>
          </main>
        </div>
      </div>
    )
  }
}

export default TradingRenderer
