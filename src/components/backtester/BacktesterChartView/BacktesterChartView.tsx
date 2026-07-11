import { Component, createRef } from 'react'
import { ROUTES } from '../../../constants/routes'
import { ghostButtonClass, appPageBackground } from '../../../styles/aurenTheme'
import { practiceTradePageClass } from '../../trading/Practice/practiceTradeTheme'
import BacktesterChart from '../../../backtester/components/chart/BacktesterChart'
import BacktesterMobileQuickBar from './BacktesterMobileQuickBar'
import BacktesterSessionSelector from './BacktesterSessionSelector'
import BacktesterWsStatusButton from './BacktesterWsStatusButton'
import { buildBacktesterTradePadProps } from './buildBacktesterTradePadProps'
import TradePanel from '../../trading/shared/pad/TradePanel'
import { DetachedTradePanel } from '../../trading/shared/mobile/DetachedTradePanel'
import { isPadDetached, togglePadDetached } from '../../../utils/tradePanelPopout'
import { getMobileTradePrefs, setMobileFloatingPad } from '../../../utils/mobileTradePrefs'
import { normalizeBacktesterSymbolRoot } from './backtesterSymbolSearch'
import KeyboardShortcutsHelp from '../../common/KeyboardShortcutsHelp'
import { TradeHeader } from '../../trading/Trading/TradeHeader'
import { TradingRendererNav } from '../../trading/Trading/tradingRenderer/TradingRendererNav'
import { TradingChartHost } from '../../trading/Trading/tradingRenderer/TradingChartHost'
import { BacktesterChartViewProps } from '../../../types/backtester'
import { t } from '../../../utils/translator'
import { BacktesterTradeHandler } from '../../../backtester/services/BacktesterTradeHandler'
import { renderPracticeTradeLayout } from '../../../utils/layoutRenderer'
import { BacktesterChartClient } from '../../../backtester/services/BacktesterChartClient'
import { BacktesterChartDataFeed } from '../../../backtester/components/chart/BacktesterChartDataFeed'
import { backtesterAPI } from '../../../api/backtester.api'
import { getInitialChartSymbol } from '../../../backtester/constants'
import { publishAccountStats } from '../../../services/trading/accountStatsStore'
import Logo from '../../common/Logo'
import { HeaderThemeButton } from '../../trading/shared/header/HeaderThemeButton'
import { ArrowLeft, LogOut } from 'lucide-react'

const BACKTESTER_MAX_QTY = 100

/**
 * Backtester Chart View Component
 * Displays the chart for a specific session with playback controls
 */
class BacktesterChartView extends Component<BacktesterChartViewProps> {
  private chartRef = createRef<BacktesterChart>()
  private wsClient: BacktesterChartClient | null = null
  private datafeed: BacktesterChartDataFeed = new BacktesterChartDataFeed()
  private tradeHandler: BacktesterTradeHandler | null = null
  private tradePadPropsCacheKey: string | null = null
  private tradePadPropsCache: ReturnType<typeof buildBacktesterTradePadProps> | null = null
  private pendingUnrealizedPnL: number | null = null
  private unrealizedPnLFlushScheduled = false

  state = {
    isPlaying: false,
    playbackSpeed: 1,
    playbackTimeframe: '1',
    contractQuantity: 1 as number | string,
    showPreviousBarSelector: false,
    showNav: true,
    wsConnected: false,
    wsState: 'connecting' as 'connecting' | 'connected' | 'disconnected',
    balance: 50000,
    realizedPnL: 0,
    unrealizedPnL: 0,
    showKeyboardShortcutsHelp: false,
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyboardShortcut)
    
    ;(window as any).__backtesterDatafeed = this.datafeed
    ;(window as any).__backtesterChartView = this

    const savedQuantity = localStorage.getItem('backtester_contract_quantity')
    if (savedQuantity) {
      const quantity = parseInt(savedQuantity, 10)
      if (!isNaN(quantity) && quantity >= 1) {
        this.setState({ contractQuantity: quantity })
      }
    }

    const savedShowNav = localStorage.getItem('trading_show_nav')
    if (savedShowNav !== null) {
      this.setState({ showNav: savedShowNav === 'true' })
    }

    // Initialize trade handler with session and null client (will be updated when WebSocket connects)
    const { session } = this.props
    this.tradeHandler = new BacktesterTradeHandler(session, null)
    this.tradeHandler.setDatafeed(this.datafeed)
    
    // Set trade handler reference in datafeed
    this.datafeed.setTradeHandler(this.tradeHandler)
    
    // Set initial playback timeframe
    this.tradeHandler.setPlaybackTimeframe(this.state.playbackTimeframe)
    
    // Set replay toggle callback to update state when replay response is received
    this.tradeHandler.setReplayToggleCallback((enabled: boolean) => {
      this.setState({ showPreviousBarSelector: enabled })
    })

    // Set session update callback to update parent session state (for date input value)
    if (this.props.onSessionUpdate) {
      this.tradeHandler.setSessionUpdateCallback(this.props.onSessionUpdate)
    }

    // Set callback for stats refresh (called when date changes or trade is saved)
    this.tradeHandler.setStatsRefreshCallback(() => {
      this.loadSessionStats()
    })

    // Set callback for when trade is saved to refresh stats
    ;(this.tradeHandler as any).onTradeSaved = () => {
      void this.loadSessionStats()
    }

    // Set callback for when unrealized P&L updates. This fires on every bar
    // while a position is open (including within a single batched step), so
    // coalesce to at most one setState per animation frame to avoid a full
    // re-render per bar during step-spam/auto-play.
    ;(this.tradeHandler as any).onUnrealizedPnLUpdate = (unrealizedPnL: number) => {
      this.pendingUnrealizedPnL = unrealizedPnL
      if (this.unrealizedPnLFlushScheduled) return
      this.unrealizedPnLFlushScheduled = true
      requestAnimationFrame(() => {
        this.unrealizedPnLFlushScheduled = false
        if (this.pendingUnrealizedPnL == null) return
        const nextUnrealizedPnL = this.pendingUnrealizedPnL
        this.pendingUnrealizedPnL = null
        this.setState({ unrealizedPnL: nextUnrealizedPnL }, () => this.publishStats())
      })
    }

    ;(this.tradeHandler as any).onPositionUpdate = () => {
      // syncPositionStats already triggers a setState-driven re-render;
      // forceUpdate here was a redundant second render per position change.
      this.syncPositionStats({ refreshSessionStats: true })
    }

    // Load session stats
    this.loadSessionStats()

    // Initialize WebSocket connection
    this.initializeWebSocket()
  }

  componentDidUpdate(prevProps: BacktesterChartViewProps) {
    // Update trade handler if session changes
    if (prevProps.session?.id !== this.props.session?.id) {
      if (this.tradeHandler) {
        this.tradeHandler.updateSession(this.props.session)
        this.tradeHandler.setDatafeed(this.datafeed)
      }
      // Update session update callback and stats refresh callback
      if (this.tradeHandler) {
        if (this.props.onSessionUpdate) {
          this.tradeHandler.setSessionUpdateCallback(this.props.onSessionUpdate)
        }
        this.tradeHandler.setStatsRefreshCallback(() => {
          this.loadSessionStats()
        })
      }
      // Update datafeed with client reference
      if (this.datafeed && this.wsClient) {
        this.datafeed.setWebSocketClient(this.wsClient)
        this.wsClient.setDatafeed(this.datafeed)
      }
      if (this.wsClient) {
        this.wsClient.disconnect()
        this.wsClient = null
      }
      this.setState({ wsConnected: false, wsState: 'connecting' })
      if (this.props.session) {
        this.initializeWebSocket()
      }
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyboardShortcut)
    
    delete (window as any).__backtesterDatafeed
    delete (window as any).__backtesterChartView
    
    this.tradeHandler?.cleanup()
    
    if (this.wsClient) {
      this.wsClient.disconnect()
      this.wsClient = null
    }
  }

  initializeWebSocket = () => {
    const { session } = this.props
    if (!session) return

    this.datafeed.resetSessionState()
    this.setState({ wsState: 'connecting', wsConnected: false })

    this.wsClient = new BacktesterChartClient(
      {
        onConnected: () => {
          console.log('[Backtester] WebSocket connected for session:', session?.id)
          if (this.tradeHandler) {
            this.tradeHandler.updateClient(this.wsClient)
          }
          if (this.datafeed) {
            this.datafeed.setWebSocketClient(this.wsClient)
          }
          if (this.wsClient) {
            this.wsClient.setDatafeed(this.datafeed)
            if (this.chartRef.current) {
              this.wsClient.setChart(this.chartRef.current)
            }
          }
          this.setState({ wsConnected: true, wsState: 'connected' })
        },
        onDisconnected: () => {
          if (this.tradeHandler) {
            this.tradeHandler.updateClient(null)
          }
          this.setState({ wsConnected: false, wsState: 'disconnected' })
        },
        onMessage: (data) => {
          console.log('[Backtester] WebSocket message:', data)
        },
        onError: (error) => {
          console.error('[Backtester] WebSocket error:', error)
          this.setState({ wsConnected: false, wsState: 'disconnected' })
        },
        onChartReady: () => {
          console.log('[Backtester] Chart ready - server handshake complete')
          this.setState({ wsConnected: true, wsState: 'connected' })
        },
      },
      {
        session: session,
      }
    )

    if (this.tradeHandler) {
      this.tradeHandler.updateClient(this.wsClient)
    }
    
    if (this.datafeed) {
      this.datafeed.setWebSocketClient(this.wsClient)
    }

    if (this.wsClient) {
      this.wsClient.setDatafeed(this.datafeed)
    }

    this.wsClient.connect()
  }

  syncPositionStats = (options?: { refreshSessionStats?: boolean }) => {
    const currentUpl = this.tradeHandler?.getPositionUplFor?.(this.getChartSymbol()) ?? 0
    const unrealizedPnL = Number.isFinite(currentUpl) ? currentUpl : 0

    this.setState({ unrealizedPnL }, () => {
      this.publishStats()
      if (options?.refreshSessionStats) {
        void this.loadSessionStats()
      }
    })
  }

  loadSessionStats = async () => {
    const { session } = this.props
    if (!session?.id) return

    try {
      const stats = await backtesterAPI.getSessionStats(session.id)
      if (stats.success) {
        this.setState(
          {
            balance: stats.balance,
            realizedPnL: stats.realizedPnL,
            unrealizedPnL: stats.unrealizedPnL,
          },
          () => this.publishStats()
        )
      }
    } catch {
      // ignore
    }
  }

  publishStats = () => {
    const { balance, realizedPnL, unrealizedPnL } = this.state
    const hasOpenPosition = Boolean(
      this.tradeHandler?.getTradeCache?.()?.getPosition?.(this.getChartSymbol())
    )
    publishAccountStats({
      balance,
      rpl: realizedPnL,
      upl: unrealizedPnL,
      hasOpenPosition,
    })
  }

  getChartSymbol = (): string => {
    try {
      const widget = (this.chartRef.current as any)?.widgetRef
      const fromChart =
        widget?.activeChart?.()?.symbol?.() ||
        widget?.getSymbol?.() ||
        widget?.chart?.()?.symbol?.()
      if (fromChart) return fromChart
    } catch {
      // ignore
    }
    const { session } = this.props
    return getInitialChartSymbol(session?.symbol)
  }

  /**
   * Check if keyboard shortcut should be ignored (e.g., when typing in input fields)
   */
  shouldIgnoreKeyboardShortcut = (event: KeyboardEvent): boolean => {
    const target = event.target as HTMLElement
    return !!(
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      (target.tagName === 'BUTTON' && target.closest('[role="dialog"]'))
    )
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcut = (event: KeyboardEvent) => {
    // Ignore shortcuts when typing in input fields or when help modal is open
    if (this.shouldIgnoreKeyboardShortcut(event) || this.state.showKeyboardShortcutsHelp) {
      return
    }

    const { session } = this.props
    const { contractQuantity } = this.state

    switch (event.key.toLowerCase()) {
      case ' ': // Space - Play/Pause
        event.preventDefault()
        this.handlePlayPause()
        break

      case 'arrowright': // Arrow Right - Next Candle
        event.preventDefault()
        this.handleNextCandle()
        break

      case 'r': // R - Toggle Replay
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          this.handleReplay()
        }
        break

      case '1': // 1 - Speed 1x
        if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
          event.preventDefault()
          this.handleSpeedChange(1)
        }
        break

      case '2': // 2 - Speed 2x
        if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
          event.preventDefault()
          this.handleSpeedChange(2)
        }
        break

      case '4': // 4 - Speed 4x
        if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
          event.preventDefault()
          this.handleSpeedChange(4)
        }
        break

      case '8': // 8 - Speed 8x
        if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
          event.preventDefault()
          this.handleSpeedChange(8)
        }
        break

      case 'b': // B - Buy
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          const qty = Number(contractQuantity) || 1
          this.tradeHandler?.logButtonPress('Buy', { quantity: qty, symbol: this.getChartSymbol() })
        }
        break

      case 's': // S - Sell
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          const qty = Number(contractQuantity) || 1
          this.tradeHandler?.logButtonPress('Sell', { quantity: qty, symbol: this.getChartSymbol() })
        }
        break

      case 'c': // C - Close Position
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          this.tradeHandler?.logButtonPress('Close Position')
        }
        break

      case 'v': // V - Reverse Position
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          this.tradeHandler?.logButtonPress('Reverse Position')
        }
        break

      case 'f': // F - Flatten All
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          this.tradeHandler?.logButtonPress('Flatten All Position')
        }
        break

      case '?': // ? - Show Keyboard Shortcuts Help
      case '/': // / - Show Keyboard Shortcuts Help (alternative)
        if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          this.setState({ showKeyboardShortcutsHelp: true })
        }
        break

      case 'escape': // Esc - Close help modal if open
        if (this.state.showKeyboardShortcutsHelp) {
          event.preventDefault()
          this.setState({ showKeyboardShortcutsHelp: false })
        }
        break
    }
  }

  /**
   * Get keyboard shortcuts for help modal
   */
  getKeyboardShortcuts = () => {
    return [
      {
        key: ' ',
        description: 'Playback: Play/Pause',
      },
      {
        key: 'ArrowRight',
        description: 'Playback: Next Candle',
      },
      {
        key: 'R',
        description: 'Playback: Toggle Replay',
      },
      {
        key: '1',
        description: 'Playback: Speed 1x',
      },
      {
        key: '2',
        description: 'Playback: Speed 2x',
      },
      {
        key: '4',
        description: 'Playback: Speed 4x',
      },
      {
        key: '8',
        description: 'Playback: Speed 8x',
      },
      {
        key: 'B',
        description: 'Trading: Buy',
      },
      {
        key: 'S',
        description: 'Trading: Sell',
      },
      {
        key: 'C',
        description: 'Trading: Close Position',
      },
      {
        key: 'V',
        description: 'Trading: Reverse Position',
      },
      {
        key: 'F',
        description: 'Trading: Flatten All Positions',
      },
      {
        key: '?',
        shift: true,
        description: 'Help: Show Keyboard Shortcuts',
      },
    ]
  }


  handlePlayPause = () => {
    this.tradeHandler?.handlePlayPause(this.state.playbackSpeed)

    const playbackState = this.tradeHandler?.getPlaybackState()
    if (playbackState) {
      this.setState(
        {
          isPlaying: playbackState.isPlaying,
          playbackSpeed: playbackState.speed,
        },
        () => this.syncBwcReplayPlayState(playbackState.isPlaying),
      )
    }
  }

  handleNextCandle = () => {
    this.tradeHandler?.handleNextCandle()
  }

  handleReplayHostAction = (action: string, payload: Record<string, unknown>) => {
    switch (action) {
      case 'stepForward':
        this.handleNextCandle()
        break
      case 'play': {
        const replay = (this.chartRef.current as { widgetRef?: { replay?: { getState?: () => { speed?: number } } } } | null)
          ?.widgetRef?.replay
        const speed = replay?.getState?.()?.speed
        if (typeof speed === 'number' && speed > 0 && speed !== this.state.playbackSpeed) {
          this.handleSpeedChange(speed)
        }
        if (!this.state.isPlaying) {
          this.handlePlayPause()
        }
        break
      }
      case 'pause':
        if (this.state.isPlaying) {
          this.handlePlayPause()
        }
        break
      case 'stepInterval':
        this.applyPlaybackTimeframeFromBwc(payload)
        break
      case 'selectBar':
        this.tradeHandler?.handleSelectBar(payload as { time?: number; index?: number; bar?: { time?: number } })
        break
      default:
        break
    }
  }

  handleChartSymbolPick = (symbol: string) => {
    const root = normalizeBacktesterSymbolRoot(symbol)
    this.tradeHandler?.handleSymbolChange(root)
    const widget = (this.chartRef.current as { widgetRef?: { setSymbol?: (sym: string) => void } } | null)?.widgetRef
    void widget?.setSymbol?.(root)
  }

  bwcStepIntervalToPlaybackMinutes = (stepInterval: string): string => {
    const id = stepInterval.trim()
    const lower = id.toLowerCase()
    if (lower === 'tick' || lower === '1s') {
      return this.getChartResolution() || '1'
    }
    if (lower === 'd') return '1440'
    if (lower === 'w') return '10080'
    if (lower === 'm') return '43200'
    const numeric = parseInt(id.replace(/[^0-9]/g, ''), 10)
    return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : '1'
  }

  applyPlaybackTimeframeFromBwc = (payload: Record<string, unknown>) => {
    const autoSelect = payload.autoSelectInterval === true
    const internalFormat = autoSelect
      ? this.getChartResolution() || '1'
      : String(payload.stepInterval ?? '1')

    this.tradeHandler?.setPlaybackTimeframe(internalFormat)
    this.setState({ playbackTimeframe: internalFormat })
  }

  syncBwcReplayPlayState = (
    playing?: boolean,
    widget?: { replay?: import('../../../services/chart/bwcReplayApi').BwcReplayApi },
  ) => {
    const replay =
      widget?.replay ??
      (this.chartRef.current as { widgetRef?: { replay?: import('../../../services/chart/bwcReplayApi').BwcReplayApi } } | null)
        ?.widgetRef?.replay
    if (!replay) return

    const isPlaying = playing ?? this.state.isPlaying
    if (isPlaying) replay.play()
    else replay.pause()
  }

  syncBwcReplayStepInterval = (widget?: { replay?: import('../../../services/chart/bwcReplayApi').BwcReplayApi }) => {
    const replay = widget?.replay ?? (this.chartRef.current as { widgetRef?: { replay?: import('../../../services/chart/bwcReplayApi').BwcReplayApi } } | null)?.widgetRef?.replay
    if (!replay) return

    const chartRes = this.getChartResolution() || '1'
    const { playbackTimeframe } = this.state
    if (playbackTimeframe === chartRes) {
      replay.setAutoSelectInterval(true)
      return
    }
    replay.setAutoSelectInterval(false)
    replay.setStepInterval(playbackTimeframe)
  }

  handleReplay = () => {
    // Toggle replay mode on/off
    const newState = !this.state.showPreviousBarSelector
    
    // Log action before state update to avoid duplicates
      this.tradeHandler?.logPlaybackAction('replay', { enabled: newState })
    
    this.setState({ showPreviousBarSelector: newState })
  }

  handleQuantityChange = (delta: number) => {
    this.setState((prevState: { contractQuantity: number | string }) => {
      const currentValue = typeof prevState.contractQuantity === 'number' 
        ? prevState.contractQuantity 
        : parseInt(String(prevState.contractQuantity), 10) || 1
      const newQuantity = Math.max(1, currentValue + delta)
      this.tradeHandler?.logQuantityChange(
        currentValue,
        newQuantity,
        delta > 0 ? 'increment' : 'decrement'
      )
      localStorage.setItem('backtester_contract_quantity', newQuantity.toString())
      return { contractQuantity: newQuantity }
    })
  }

  handleQuantityUpdate = (quantity: number) => {
    const { contractQuantity } = this.state
    const oldValue = typeof contractQuantity === 'number' ? contractQuantity : parseInt(String(contractQuantity), 10) || 1
    const newQuantity = Math.max(1, quantity)
    this.tradeHandler?.logQuantityChange(oldValue, newQuantity, 'preset')
    this.setState({ contractQuantity: newQuantity })
    localStorage.setItem('backtester_contract_quantity', newQuantity.toString())
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
      this.tradeHandler?.logQuantityChange(oldValue, numValue, 'input')
      this.setState({ contractQuantity: numValue })
      localStorage.setItem('backtester_contract_quantity', numValue.toString())
    }
  }

  handleQuantityBlur = () => {
    // If input is empty or invalid, set to 1
    const { contractQuantity } = this.state
    const numValue = typeof contractQuantity === 'number' ? contractQuantity : parseInt(String(contractQuantity), 10)
    if (!numValue || isNaN(numValue) || numValue < 1) {
      this.setState({ contractQuantity: 1 })
      localStorage.setItem('backtester_contract_quantity', '1')
    } else {
      // Ensure it's saved as number
      this.setState({ contractQuantity: numValue })
    }
  }

  handleSpeedChange = (speed: number) => {
    this.tradeHandler?.handleSpeedChange(speed)
    
    // Update state to reflect speed from handler
    const playbackState = this.tradeHandler?.getPlaybackState()
    if (playbackState) {
      this.setState({ 
        playbackSpeed: playbackState.speed,
        isPlaying: playbackState.isPlaying
      })
    }
  }

  /**
   * Get current chart resolution
   */
  getChartResolution = (): string | undefined => {
    try {
      const chart = this.chartRef.current
      if (chart) {
        const widget = (chart as any).widgetRef
        if (widget?.getResolution) {
          return widget.getResolution()
        }
        if (widget) {
          const activeChart = widget.activeChart?.()
          if (activeChart) {
            return activeChart.resolution?.()
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
    return undefined
  }

  handleChartIntervalChange = (interval: string) => {
    this.tradeHandler?.setPlaybackTimeframe(interval)
    this.tradeHandler?.syncServerReplayCursor(interval)
    this.setState({ playbackTimeframe: interval }, () => this.syncBwcReplayStepInterval())
  }

  /**
   * Decode JWT token to get username
   * Note: This only decodes the token, it doesn't verify it
   */
  getUsernameFromToken(): string {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        return 'public_user_id'
      }

      // JWT tokens have 3 parts: header.payload.signature
      const parts = token.split('.')
      if (parts.length !== 3) {
        return 'public_user_id'
      }

      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1]))
      return payload.username || 'public_user_id'
    } catch (error) {
      console.error('Error decoding token:', error)
      return 'public_user_id'
    }
  }

  /**
   * Get token from localStorage
   */
  getToken(): string {
    return localStorage.getItem('token') || ''
  }

  reconnectWebSocket = () => {
    if (this.wsClient) {
      this.wsClient.disconnect()
      this.wsClient = null
    }
    this.initializeWebSocket()
  }

  render() {
    const {
      isDark,
      toggleTheme,
      navigate,
      session,
    } = this.props

    const { isPlaying, contractQuantity, wsState, wsConnected } = this.state
    const { sessions = [] } = this.props

    const chartSymbol = session ? this.getChartSymbol() : ''
    // Memoized: this rebuilds unconditionally on every render otherwise,
    // recreating an object + inline closures and re-rendering the trade
    // panel subtree on every bar (during step-spam/auto-play this fires
    // once per rendered candle). Cache on the actual inputs that matter.
    const tradePadPropsCacheKey = session
      ? `${session.id}|${isDark}|${wsConnected}|${contractQuantity}|${chartSymbol}`
      : null
    let tradePadProps = tradePadPropsCacheKey ? this.tradePadPropsCache : null
    if (session && tradePadPropsCacheKey !== this.tradePadPropsCacheKey) {
      tradePadProps = buildBacktesterTradePadProps({
        sessionId: session.id,
        isDark,
        marketDataLive: wsConnected,
        contractQuantity,
        chartSymbol,
        tradeHandler: this.tradeHandler,
        datafeed: this.datafeed,
        getChartSymbol: this.getChartSymbol,
        onQuantityChange: this.handleQuantityChange,
        onQuantityUpdate: this.handleQuantityUpdate,
        onQuantityInputChange: this.handleQuantityInputChange,
        onQuantityBlur: this.handleQuantityBlur,
        onChartSymbolChange: this.handleChartSymbolPick,
        onDetach: () => {
          togglePadDetached(session.id)
          this.forceUpdate()
        },
      })
      this.tradePadPropsCacheKey = tradePadPropsCacheKey
      this.tradePadPropsCache = tradePadProps
    } else if (!session) {
      this.tradePadPropsCacheKey = null
      this.tradePadPropsCache = null
    }

    if (!session) {
      return (
        <div className={appPageBackground(isDark)}>
          <header className={`sticky top-0 z-50 border-b auren-sticky-app-header ${isDark ? 'border-slate-800/80 bg-slate-950/80 backdrop-blur-xl' : 'border-slate-200/80 bg-white/80 backdrop-blur-xl'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-14">
                <Logo isDark={isDark} compact={true} onClick={() => navigate(ROUTES.HOME)} />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      localStorage.removeItem('token')
                      navigate(ROUTES.LOGIN)
                    }}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800' : 'text-slate-500 hover:text-red-600 hover:bg-slate-100'}`}
                    aria-label="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                  <HeaderThemeButton isDark={isDark} onToggle={toggleTheme} />
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className={`rounded-2xl border p-12 text-center ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
              <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('backtester.sessionNotFound')}
              </p>
              <button
                type="button"
                onClick={() => navigate(ROUTES.BACKTESTER)}
                className={`mt-4 inline-flex items-center gap-2 ${ghostButtonClass(isDark)}`}
              >
                <ArrowLeft className="w-4 h-4" />
                {t('common.back')}
              </button>
            </div>
          </main>
        </div>
      )
    }

    const padDetached = isPadDetached(session.id)
    const mobileTradePrefs = getMobileTradePrefs(session.id)

    const chartInner = (
      <div className="relative w-full h-full min-h-0">
        {wsState === 'connecting' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-950/70">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-violet-400' : 'border-violet-600'}`} />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Connecting replay data…</p>
          </div>
        )}
        {wsState === 'disconnected' && (
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-2 px-3 py-1.5 bg-red-950/80 border-b border-red-500/30">
            <p className="text-xs text-red-300">Replay server offline</p>
            <button
              type="button"
              onClick={this.reconnectWebSocket}
              className="text-xs font-medium text-red-200 underline"
            >
              Retry
            </button>
          </div>
        )}
        <BacktesterChart
          ref={this.chartRef}
          symbol={getInitialChartSymbol(session.symbol)}
          timeframe="1"
          isDark={isDark}
          style={{ width: '100%', height: '100%' }}
          datafeed={this.datafeed}
          session={session}
          tradeHandler={this.tradeHandler}
          clientId={this.getToken()}
          userId={this.getUsernameFromToken()}
          onWidgetReady={(widget: any) => {
            if (this.wsClient && this.chartRef.current) {
              this.wsClient.setChart(this.chartRef.current)
            }
            this.tradeHandler?.onReady(widget)
            this.syncBwcReplayStepInterval(widget)
          }}
          onChartReady={async () => {
            try {
              const widget = (this.chartRef.current as any)?.widgetRef
              const activeChart = widget?.activeChart?.()
              const currentResolution = activeChart?.resolution?.()
              if (currentResolution) {
                this.handleChartIntervalChange(currentResolution)
              } else {
                this.syncBwcReplayStepInterval(widget)
              }
            } catch {
              // ignore
            }
          }}
          onSymbolChange={(symbol: string) => {
            this.tradeHandler?.handleSymbolChange(symbol)
          }}
          onIntervalChange={(interval: string) => {
            this.handleChartIntervalChange(interval)
          }}
          onReplayHostAction={this.handleReplayHostAction}
        />
      </div>
    )

    const chartElement = (
      <TradingChartHost terminalShell isDark={isDark} chartComponent={chartInner} />
    )

    const mobileBar = tradePadProps ? (
      <BacktesterMobileQuickBar
        accountId={session.id}
        padProps={tradePadProps}
        maxQty={BACKTESTER_MAX_QTY}
        isDark={isDark}
        showMobileNav={this.state.showNav}
      />
    ) : null

    return (
      <div
        className={`transition-all duration-700 ease-in-out flex min-h-dvh h-dvh max-h-dvh overflow-hidden ${practiceTradePageClass(isDark)}`}
      >
        <TradingRendererNav
          showNav={this.state.showNav}
          terminalShell
          navWidth="w-11"
          isDark={isDark}
          navigate={navigate}
          padSessionId={null}
          liveMode={false}
          practiceMobileOrderOpen={false}
          practiceMobileSettingsOpen={false}
          showMobileSettings={false}
          onHideNav={() => {
            this.setState({ showNav: false })
            localStorage.setItem('trading_show_nav', 'false')
          }}
          onToggleMobileOrder={() => {}}
          onToggleMobileSettings={() => {}}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <TradeHeader
            isDark={isDark}
            navigate={navigate}
            toggleTheme={toggleTheme}
            showNav={this.state.showNav}
            onShowNav={() => {
              this.setState({ showNav: true })
              localStorage.setItem('trading_show_nav', 'true')
            }}
            showAccountSelector={false}
            showTradingSettings={false}
            showStatsBar
            hubPath={`${ROUTES.HOME}?mode=replay`}
            headerLeading={
              <BacktesterSessionSelector
                isDark={isDark}
                sessions={sessions}
                currentSessionId={session.id}
                navigate={navigate}
              />
            }
            headerConnectionAccessory={
              <BacktesterWsStatusButton
                isDark={isDark}
                state={wsState}
                onReconnect={this.reconnectWebSocket}
              />
            }
          />

          <main className="flex-1 flex flex-col min-h-0 overflow-hidden p-0 max-lg:pb-0 lg:px-2 lg:py-1.5">
            <div className="relative flex-1 flex flex-col min-h-0">
              {renderPracticeTradeLayout(
                chartElement,
                padDetached || !tradePadProps ? null : <TradePanel {...tradePadProps} />,
                {
                  mobileScalpBar: mobileBar,
                  showMobileNav: this.state.showNav,
                },
              )}
              {padDetached && tradePadProps && (
                <div className="hidden lg:block">
                  <DetachedTradePanel
                    accountId={session.id}
                    isDark={isDark}
                    padProps={tradePadProps}
                    chartSymbol={chartSymbol}
                    maxQty={BACKTESTER_MAX_QTY}
                    onDock={() => this.forceUpdate()}
                  />
                </div>
              )}
              {mobileTradePrefs.floatingPad && tradePadProps && (
                <div className="lg:hidden">
                  <DetachedTradePanel
                    accountId={session.id}
                    isDark={isDark}
                    padProps={tradePadProps}
                    chartSymbol={chartSymbol}
                    maxQty={BACKTESTER_MAX_QTY}
                    dockMode="mobile-float"
                    dockTitle="Pin quick trade"
                    onDock={() => {
                      setMobileFloatingPad(session.id, false)
                      this.forceUpdate()
                    }}
                  />
                </div>
              )}
            </div>
          </main>
        </div>

        <KeyboardShortcutsHelp
          isOpen={this.state.showKeyboardShortcutsHelp}
          onClose={() => this.setState({ showKeyboardShortcutsHelp: false })}
          shortcuts={this.getKeyboardShortcuts()}
          isDark={isDark}
        />
      </div>
    )
  }
}

export default BacktesterChartView

