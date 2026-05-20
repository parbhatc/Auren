import { Component, createRef } from 'react'
import { TradingViewChartProps, TradingViewWidgetConfig } from '../../types/chart'
import { IndicatorManager, FVGIndicator, SwingIndicator } from '../../indicators'
import { createStubDatafeed } from '../../services/tradingview/TradingViewDatafeed'
import { getDefaultContextMenuConfig, setContextMenuCallbacks, setContextMenuWidget } from './ChartContextMenu'
import { getShortcutsWithCustomizations, getActiveShortcut } from '../../utils/keyboardShortcutsStorage'
import { debugPracticeChartSymbol } from '../../services/tradesea/practiceChartSymbolDebug'

/**
 * Supported TradingView timezones
 * These are the only timezones supported by TradingView Charting Library
 */
export const SUPPORTED_TRADINGVIEW_TIMEZONES = [
  'Etc/UTC',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Tunis',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Caracas',
  'America/Chicago',
  'America/El_Salvador',
  'America/Juneau',
  'America/Lima',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Astana',
  'Asia/Ashkhabad',
  'Asia/Bahrain',
  'Asia/Bangkok',
  'Asia/Chongqing',
  'Asia/Colombo',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Ho_Chi_Minh',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Jerusalem',
  'Asia/Karachi',
  'Asia/Kabul',
  'Asia/Kathmandu',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Kuwait',
  'Asia/Manila',
  'Asia/Muscat',
  'Asia/Nicosia',
  'Asia/Qatar',
  'Asia/Riyadh',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Tehran',
  'Asia/Tokyo',
  'Asia/Yangon',
  'Atlantic/Azores',
  'Atlantic/Reykjavik',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Belgrade',
  'Europe/Berlin',
  'Europe/Bratislava',
  'Europe/Brussels',
  'Europe/Bucharest',
  'Europe/Budapest',
  'Europe/Copenhagen',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Luxembourg',
  'Europe/Madrid',
  'Europe/Malta',
  'Europe/Moscow',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Riga',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Tallinn',
  'Europe/Vienna',
  'Europe/Vilnius',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Chatham',
  'Pacific/Fakaofo',
  'Pacific/Honolulu',
  'Pacific/Norfolk',
  'US/Mountain',
] as const

/**
 * Get user timezone from settings or return a valid TradingView timezone
 */
function getUserTimezone(): string {
  // Try to get user timezone from localStorage
  const savedTimezone = localStorage.getItem('user_timezone')
  
  if (savedTimezone) {
    // Migrate 'UTC' to 'Etc/UTC' if needed
    const timezone = savedTimezone === 'UTC' ? 'Etc/UTC' : savedTimezone
    
    if (SUPPORTED_TRADINGVIEW_TIMEZONES.includes(timezone as any)) {
      // Update localStorage if migration was needed
      if (timezone !== savedTimezone) {
        localStorage.setItem('user_timezone', timezone)
      }
      return timezone
    }
  }

  // Get browser timezone and check if it's supported
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (SUPPORTED_TRADINGVIEW_TIMEZONES.includes(browserTimezone as any)) {
    return browserTimezone
  }

  // Fallback to UTC if browser timezone is not supported
  return 'Etc/UTC'
}

/**
 * Base Chart Component
 * Flexible wrapper for TradingView's Advanced Charting Library
 * 
 * Can be used for:
 * - Backtesting (historical data)
 * - Realtime trading (live data)
 * - Analysis and charting
 * 
 * Usage:
 * ```tsx
 * <BaseChart
 *   symbol="AAPL"
 *   timeframe="1h"
 *   isDark={true}
 *   widgetConfig={{
 *     disabled_features: ['header_symbol_search'],
 *     enabled_features: ['study_templates'],
 *   }}
 * />
 * ```
 * 
 * Note: To use this component, you need to:
 * 1. Obtain TradingView Charting Library from https://www.tradingview.com/charting-library/
 * 2. Copy the charting_library folder to public/charting_library
 * 3. The library will be loaded from the appropriate path
 */
class BaseChart extends Component<TradingViewChartProps> {
  protected containerRef = createRef<HTMLDivElement>()
  protected widgetRef: any = null
  protected indicatorManager: IndicatorManager | null = null
  protected config: TradingViewWidgetConfig | null = null

  /**
   * Context menu callback handlers
   * These are called when trading actions are triggered from the context menu
   */
  onMarketBuy = (quantity: number, price: number, time?: number): void => {
    console.log('[BaseChart] onMarketBuy called:', { quantity, price, time })
  }

  onMarketSell = (quantity: number, price: number, time?: number): void => {
    console.log('[BaseChart] onMarketSell called:', { quantity, price, time })
  }

  onLimitBuy = (quantity: number, limitPrice: number, price: number, time?: number): void => {
    console.log('[BaseChart] onLimitBuy called:', { quantity, limitPrice, price, time })
  }

  onStopSell = (quantity: number, stopPrice: number, price: number, time?: number): void => {
    console.log('[BaseChart] onStopSell called:', { quantity, stopPrice, price, time })
  }

  /**
   * Initialize chart configuration
   * Override this method in child classes to customize config
   * Call super.init() first, then use helper methods to customize
   */
  protected init(): void {
    const {
      symbol,
      timeframe = '1',
      isDark = false,
      libraryPath = '/charting_library/',
      chartsStorageUrl = 'https://saveload.tradingview.com',
      chartsStorageApiVersion = '1.1',
      clientId = 'tradingview.com',
      userId = 'public_user_id',
      datafeed,
      timezone,
      loadLastChart = false,
    } = this.props

    // Get timezone
    let chartTimezone: string
    if (timezone && SUPPORTED_TRADINGVIEW_TIMEZONES.includes(timezone as any)) {
      chartTimezone = timezone
    } else {
      chartTimezone = getUserTimezone()
    }

    // Initialize base config with defaults
    this.config = {
      symbol: symbol,
      interval: timeframe,
      container: this.containerRef.current || undefined,
      library_path: libraryPath,
      locale: 'en',
      disabled_features: [
        'show_object_tree',
        'trading_account_manager',
        'header_trading_panel',
        'buy_sell_buttons',
        'show_right_widgets_panel_by_default',
      ],
      enabled_features: ['study_templates', 'show_symbol_logos', 'hide_right_toolbar'],
      charts_storage_url: chartsStorageUrl,
      charts_storage_api_version: chartsStorageApiVersion,
      client_id: clientId,
      user_id: userId,
      fullscreen: true, // Default to fullscreen
      autosize: true,
      width: '100%', // Default width
      height: '100%', // Default height
      theme: isDark ? 'dark' : 'light',
      timezone: chartTimezone,
      load_last_chart: true, // Default to true
      context_menu: getDefaultContextMenuConfig(),
      datafeed: datafeed || createStubDatafeed(),
      overrides: {
        'mainSeriesProperties.showCountdown': true, // Default override
      },
    }
  }

  /**
   * Helper methods to customize config
   */
  protected setDatafeed(datafeed: any): void {
    if (this.config) {
      this.config.datafeed = datafeed
    }
  }

  protected setStorageUrl(url: string, apiVersion: string = '1.1'): void {
    if (this.config) {
      this.config.charts_storage_url = url
      this.config.charts_storage_api_version = apiVersion
    }
  }

  protected setClientId(clientId: string, userId?: string): void {
    if (this.config) {
      this.config.client_id = clientId
      if (userId) {
        this.config.user_id = userId
      }
    }
  }

  protected setTimezone(timezone: string): void {
    if (this.config && SUPPORTED_TRADINGVIEW_TIMEZONES.includes(timezone as any)) {
      this.config.timezone = timezone
    }
  }

  protected setFullscreen(fullscreen: boolean): void {
    if (this.config) {
      this.config.fullscreen = fullscreen
    }
  }

  protected addEnabledFeature(feature: string): void {
    if (this.config) {
      if (!this.config.enabled_features) {
        this.config.enabled_features = []
      }
      if (!this.config.enabled_features.includes(feature)) {
        this.config.enabled_features.push(feature)
      }
    }
  }

  protected addDisabledFeature(feature: string): void {
    if (this.config) {
      if (!this.config.disabled_features) {
        this.config.disabled_features = []
      }
      if (!this.config.disabled_features.includes(feature)) {
        this.config.disabled_features.push(feature)
      }
    }
  }

  protected setOnWidgetReady(callback: (widget: any) => void): void {
    if (this.config) {
      const originalCallback = this.props.onWidgetReady
      this.config.onWidgetReady = (widget: any) => {
        callback(widget)
        if (originalCallback) {
          originalCallback(widget)
        }
      }
    }
  }

  protected setOverrides(overrides: Record<string, any>): void {
    if (this.config) {
      this.config.overrides = {
        ...(this.config.overrides || {}),
        ...overrides,
      }
    }
  }

  protected setInterval(interval: string): void {
    if (this.config) {
      this.config.interval = interval
    }
  }

  protected setTheme(theme: 'light' | 'dark'): void {
    if (this.config) {
      this.config.theme = theme
    }
  }

  protected setContainer(container: string | HTMLElement | undefined): void {
    if (this.config) {
      this.config.container = container
    }
  }

  componentDidMount() {
    // Check if there's an auth error in datafeed - if so, don't initialize chart
    if (this.props.datafeed && typeof (this.props.datafeed as any).hasAuthError === 'function') {
      if ((this.props.datafeed as any).hasAuthError()) {
        console.warn('[BaseChart] Auth error detected, skipping chart initialization')
        return
      }
    }
    this.loadChart()
  }

  componentDidUpdate(prevProps: TradingViewChartProps) {
    const practiceAccountId = (this.props as { practiceAccountId?: string }).practiceAccountId
    const practiceRestoreLayout = Boolean(practiceAccountId && this.config?.load_last_chart)
    const symbolChanged = prevProps.symbol !== this.props.symbol && !practiceRestoreLayout

    if (practiceAccountId && prevProps.symbol !== this.props.symbol) {
      debugPracticeChartSymbol('BaseChart.componentDidUpdate', {
        prevSymbol: prevProps.symbol,
        nextSymbol: this.props.symbol,
        practiceRestoreLayout,
        symbolChanged,
        willReloadChart:
          symbolChanged ||
          prevProps.timeframe !== this.props.timeframe ||
          prevProps.isDark !== this.props.isDark,
      }, { force: true })
    }

    if (
      symbolChanged ||
      prevProps.timeframe !== this.props.timeframe ||
      prevProps.isDark !== this.props.isDark ||
      JSON.stringify(prevProps.widgetConfig) !== JSON.stringify(this.props.widgetConfig)
    ) {
      this.cleanup()
      this.loadChart()
    }
  }

  componentWillUnmount() {
    this.cleanup()
  }

  cleanup = () => {
    // Cleanup keyboard listener
    if ((this as any)._keyboardListenerCleanup) {
      ;(this as any)._keyboardListenerCleanup()
      ;(this as any)._keyboardListenerCleanup = null
    }
    if (this.widgetRef) {
      try {
        this.widgetRef.remove()
        this.widgetRef = null
      } catch (error) {
        console.error('Error removing widget:', error)
      }
    }
    // Note: We keep indicatorManager alive across chart reloads
    // so indicators persist. If you want to reset, uncomment below:
    // this.indicatorManager = null
  }

  getChartWidget = () => {
    return this.widgetRef
  }
  /**
   * Reset all chart data and cache
   * Resets the widget cache and all chart instances
   */
  resetAllChartData = () => {
    if (!this.widgetRef) {
      console.warn('BaseChart: Widget not available for reset')
      return
    }

    try {
      // Reset widget cache
      if (this.widgetRef.resetCache) {
        this.widgetRef.resetCache()
      }

      // Reset data for all charts
      if (this.widgetRef.chartsCount) {
        const chartsCount = this.widgetRef.chartsCount()
        for (let i = 0; i < chartsCount; i++) {
          const chart = this.widgetRef.chart(i)
          if (chart && chart.resetData) {
            chart.resetData()
          }
        }
      }
    } catch (error) {
      console.error('Error resetting chart data:', error)
    }
  }

  /**
   * Get widget configuration
   * Calls init() to build config, then merges with user config
   */
  private getWidgetConfig(): TradingViewWidgetConfig {
    // Initialize config if not already done
    if (!this.config) {
      this.init()
    }

    if (!this.config) {
      throw new Error('Failed to initialize chart configuration')
    }

    // Start with initialized config
    const mergedConfig: TradingViewWidgetConfig = {
      ...this.config,
      // Ensure disabled_features and enabled_features are always arrays
      disabled_features: this.config.disabled_features || [],
      enabled_features: this.config.enabled_features || [],
    }

    const practiceAccountId = (this.props as { practiceAccountId?: string }).practiceAccountId
    if (practiceAccountId && mergedConfig.load_last_chart) {
      delete (mergedConfig as { symbol?: string }).symbol
      debugPracticeChartSymbol(
        'BaseChart.getWidgetConfig',
        { omittedInitialSymbol: true, propsSymbol: this.props.symbol, load_last_chart: true },
        { force: true }
      )
    }

    // Merge user config from props
    const userConfig = this.props.widgetConfig || {}
    Object.keys(userConfig).forEach((key) => {
      const userValue = userConfig[key]

      // Handle arrays - merge
      if (key === 'disabled_features' && Array.isArray(userValue)) {
        mergedConfig.disabled_features = [
          ...(mergedConfig.disabled_features || []),
          ...userValue,
        ]
      } else if (key === 'enabled_features' && Array.isArray(userValue)) {
        mergedConfig.enabled_features = [
          ...(mergedConfig.enabled_features || []),
          ...userValue,
        ]
      }
      // Handle objects - deep merge
      else if (key === 'overrides' && typeof userValue === 'object' && userValue !== null) {
        mergedConfig.overrides = {
          ...(mergedConfig.overrides || {}),
          ...userValue,
        }
      } else if (key === 'studies_overrides' && typeof userValue === 'object' && userValue !== null) {
        mergedConfig.studies_overrides = {
          ...(mergedConfig.studies_overrides || {}),
          ...userValue,
        }
      } else if (key === 'loading_screen' && typeof userValue === 'object' && userValue !== null) {
        mergedConfig.loading_screen = {
          ...(mergedConfig.loading_screen || {}),
          ...userValue,
        }
      }
      // Ignore context_menu - always use defaults
      else if (key === 'context_menu') {
        // Do nothing
      }
      // Handle container
      else if (key === 'container') {
        mergedConfig.container = userValue || this.containerRef.current
      }
      // For all other values, override
      else {
        mergedConfig[key] = userValue
      }
    })

    // Ensure container is set
    if (!mergedConfig.container && this.containerRef.current) {
      mergedConfig.container = this.containerRef.current
    }

    // Always ensure context_menu is set
    mergedConfig.context_menu = getDefaultContextMenuConfig()

    // Add custom indicators getter if indicator manager is available
    if (!mergedConfig.custom_indicators_getter) {
      if (!this.indicatorManager) {
        this.indicatorManager = new IndicatorManager()
        this.indicatorManager.register(new FVGIndicator())
        this.indicatorManager.register(new SwingIndicator())
        ;(window as any).indicatorManager = this.indicatorManager
      }
      mergedConfig.custom_indicators_getter = this.indicatorManager.getter.bind(this.indicatorManager)
    }

    return mergedConfig
  }

  /**
   * Clean config to remove any circular references or non-serializable values
   * before passing to TradingView widget
   * Note: datafeed and container are kept even if not serializable as they're required by TradingView
   */
  private cleanConfigForTradingView(config: TradingViewWidgetConfig): TradingViewWidgetConfig {
    // Create a deep copy and remove any problematic values
    const clean: any = {}
    
    // Properties that must be kept even if not serializable
    const requiredProperties = ['datafeed', 'container', 'custom_indicators_getter']
    
    for (const key in config) {
      if (config.hasOwnProperty(key)) {
        const value = (config as any)[key]
        
        // Always keep required properties (datafeed, container, etc.)
        if (requiredProperties.includes(key)) {
          clean[key] = value
          continue
        }
        
        // Skip functions, undefined, and window/document references
        if (typeof value === 'function' || value === undefined) {
          continue
        }
        
        // Skip if it's window or document
        if (value === window || value === document || value instanceof Window || value instanceof Document) {
          continue
        }
        
        // Handle arrays
        if (Array.isArray(value)) {
          clean[key] = value.filter(item => 
            typeof item !== 'function' && 
            item !== undefined && 
            item !== window && 
            item !== document
          )
        }
        // Handle objects (but not DOM elements)
        else if (typeof value === 'object' && value !== null) {
          // Check if it's a DOM element
          if (value instanceof HTMLElement || value instanceof Element) {
            // Keep DOM elements (container) as they're needed
            clean[key] = value
          } else {
            // Recursively clean nested objects
            try {
              JSON.stringify(value) // Test if serializable
              clean[key] = value
            } catch (e) {
              // Skip non-serializable objects (except required ones)
              // Don't warn for datafeed as it's expected to be non-serializable
              if (key !== 'datafeed') {
                console.warn(`Skipping non-serializable config property: ${key}`)
              }
            }
          }
        }
        // Primitive values
        else {
          clean[key] = value
        }
      }
    }
    
    // Ensure disabled_features and enabled_features are arrays
    if (!Array.isArray(clean.disabled_features)) {
      clean.disabled_features = []
    }
    if (!Array.isArray(clean.enabled_features)) {
      clean.enabled_features = []
    }
    
    return clean as TradingViewWidgetConfig
  }

  /**
   * Handle auto-save needed event
   * Can be overridden by child classes
   * Also calls prop handler if provided for backward compatibility
   */
  handleAutoSaveNeeded = async () => {
    if (this.props.onAutoSaveNeeded) {
      await this.props.onAutoSaveNeeded()
    }
  }

  /**
   * Handle chart ready event
   * Can be overridden by child classes
   * Also calls prop handler if provided for backward compatibility
   */
  handleChartReady = async () => {
    if (this.props.onChartReady) {
      await this.props.onChartReady()
    }
  }

  /**
   * Handle interval change event
   * Can be overridden by child classes
   * Also calls prop handler if provided for backward compatibility
   */
  handleIntervalChange = (interval: string) => {
    if (this.props.onIntervalChange) {
      this.props.onIntervalChange(interval)
    }
  }

  /**
   * Handle symbol change event
   * Can be overridden by child classes
   * Also calls prop handler if provided for backward compatibility
   */
  handleSymbolChange = (symbol: string) => {
    if (this.props.onSymbolChange) {
      this.props.onSymbolChange(symbol)
    }
  }

  loadChart = async () => {
    if (!this.containerRef.current) return

    try {
      // Try to load TradingView library
      // @ts-ignore
      if (typeof window.TradingView !== 'undefined') {
        // Reset config to allow re-initialization
        this.config = null
        const config = this.getWidgetConfig()

        // Set up context menu callbacks
        setContextMenuCallbacks({
          onMarketBuy: this.onMarketBuy,
          onMarketSell: this.onMarketSell,
          onLimitBuy: this.onLimitBuy,
          onStopSell: this.onStopSell
        })

        // Ensure container is set
        if (!config.container) {
          config.container = this.containerRef.current || undefined
        } else if (typeof config.container === 'string') {
          const containerElement = document.getElementById(config.container)
          if (containerElement) {
            config.container = containerElement
          } else {
            config.container = this.containerRef.current || undefined
          }
        }

        // Ensure config is clean and serializable before passing to TradingView
        // Remove any potential circular references or non-serializable values
        const cleanConfig = this.cleanConfigForTradingView(config)
        const practiceAccountId = (this.props as { practiceAccountId?: string }).practiceAccountId
        if (practiceAccountId) {
          debugPracticeChartSymbol('BaseChart.loadChart', {
            configSymbol: cleanConfig.symbol,
            load_last_chart: cleanConfig.load_last_chart,
            propsSymbol: this.props.symbol,
            practiceAccountId,
          }, { force: true })
        }

        // @ts-ignore
        const widget = new window.TradingView.widget(cleanConfig)

        this.widgetRef = widget
        
        // Store handler reference on widget for context menu access
        // Try to get handler from datafeed
        const datafeed = config.datafeed as any
        if (datafeed && typeof datafeed === 'object') {
          // Try to get propFirm from datafeed when exposed by the client
          if (datafeed.client && typeof datafeed.client.getPropFirm === 'function') {
            const propFirm = datafeed.client.getPropFirm()
            if (propFirm && propFirm.handler) {
              ;(widget as any).handler = propFirm.handler
              ;(widget as any).propFirm = propFirm
            }
          }
          // Also try direct handler access
          if (datafeed.handler) {
            ;(widget as any).handler = datafeed.handler
          }
        }
        
        // Set widget and datafeed on context menu for price/symbol access
        setContextMenuWidget(widget, datafeed)
        
        // Store widget globally as fallback
        ;(window as any).tradingViewWidget = widget

        // Set widget on indicator manager if available
        // Use onChartReady to ensure widget is fully initialized
        if (this.indicatorManager) {
          widget.onChartReady(() => {
            if (this.indicatorManager && widget) {
              this.indicatorManager.setWidget(widget)
              // Call onReady after widget is set and chart is ready
              setTimeout(() => {
                this.indicatorManager?.onReady()
              }, 100)
            }
          })
        }

        // Setup event subscriptions if widget is available
        this.setupEventSubscriptions(widget)

        // Setup keyboard shortcuts to disable/override defaults
        this.setupKeyboardShortcuts(widget)

        // Setup container keyboard event listener to ensure shortcuts work when focus is inside chart
        // Wait a bit for the container to be fully set up
        setTimeout(() => {
          this.setupContainerKeyboardListener()
        }, 500)

        // Call onWidgetReady callback if provided
        if (this.props.onWidgetReady) {
          // Widget may not be immediately ready, so we use a small delay
          setTimeout(() => {
            this.props.onWidgetReady?.(widget)
          }, 100)
        }
      } else {
        // Fallback: Show placeholder if library not loaded
        this.showPlaceholder()
      }
    } catch (error) {
      console.error('Error loading TradingView chart:', error)
      if (this.props.onError) {
        this.props.onError(error as Error)
      }
      this.showErrorPlaceholder()
    }
  }

  /**
   * Convert key name to key code for TradingView onShortcut API
   */
  private getKeyCode = (key: string): number | null => {
    const keyMap: Record<string, number> = {
      ' ': 32, // Space
      'ArrowRight': 39,
      'ArrowLeft': 37,
      'ArrowUp': 38,
      'ArrowDown': 40,
      'Enter': 13,
      'Escape': 27,
      'Tab': 9,
      'Backspace': 8,
      'Delete': 46,
      'a': 65, 'b': 66, 'c': 67, 'd': 68, 'e': 69, 'f': 70, 'g': 71, 'h': 72,
      'i': 73, 'j': 74, 'k': 75, 'l': 76, 'm': 77, 'n': 78, 'o': 79, 'p': 80,
      'q': 81, 'r': 82, 's': 83, 't': 84, 'u': 85, 'v': 86, 'w': 87, 'x': 88,
      'y': 89, 'z': 90,
      '0': 48, '1': 49, '2': 50, '3': 51, '4': 52, '5': 53, '6': 54, '7': 55,
      '8': 56, '9': 57,
      '/': 191, '?': 191,
    }
    return keyMap[key] || null
  }

  /**
   * Setup keyboard shortcuts to disable/override default TradingView shortcuts
   * Loads shortcuts from settings and only disables enabled ones
   * Can be overridden by child classes to customize shortcuts
   */
  setupKeyboardShortcuts = (widget: any) => {
    if (!widget) return

    try {
      // Wait for chart to be ready before setting up shortcuts
      widget.onChartReady?.(() => {
        try {
          // Load shortcuts from settings
          const shortcutsConfig = getShortcutsWithCustomizations()
          
          // Flatten all shortcuts from all categories
          const allShortcuts: any[] = []
          shortcutsConfig.forEach((category) => {
            category.shortcuts.forEach((shortcut) => {
              if (shortcut.enabled !== false) {
                allShortcuts.push(shortcut)
              }
            })
          })
          
          // Disable each enabled shortcut in TradingView
          allShortcuts.forEach((shortcut) => {
            try {
              const active = getActiveShortcut(shortcut)
              const keyCode = this.getKeyCode(active.key)
              
              if (keyCode === null) {
                console.warn(`Unknown key code for shortcut ${shortcut.id}: ${active.key}`)
                return
              }

              // Build shortcut array for TradingView onShortcut API
              // Note: TradingView v31+ requires numeric key codes, not string names
              // "meta" is not supported - use "ctrl" for both Ctrl and Cmd
              const shortcutArray: (string | number)[] = []
              
              // Add modifiers in correct order
              // Use 'ctrl' for both Ctrl (Windows/Linux) and Cmd (Mac)
              if (active.ctrl || active.meta) shortcutArray.push('ctrl')
              if (active.shift) shortcutArray.push('shift')
              if (active.alt) shortcutArray.push('alt')
              // Don't add 'meta' - TradingView doesn't support it, use 'ctrl' instead
              
              // Add key code (numeric)
              shortcutArray.push(keyCode)

              // Disable this shortcut in TradingView
              if (typeof widget.onShortcut === 'function') {
                widget.onShortcut(shortcutArray, () => {
                  // Disabled - do nothing, prevents default TradingView behavior
                  // The actual shortcut handling is done by the app's keyboard shortcut system
                })
              }
            } catch (e) {
              console.warn(`Could not disable shortcut ${shortcut.id}:`, e)
            }
          })

        } catch (error) {
          console.warn('Could not load shortcuts from settings:', error)
          // If settings fail to load, don't disable any shortcuts
          // Let the app handle shortcuts naturally
        }

        // Allow child classes to override this method to add custom shortcuts
        if (typeof this.handleCustomShortcuts === 'function') {
          this.handleCustomShortcuts(widget)
        }
      })
    } catch (error) {
      console.warn('Could not setup keyboard shortcuts:', error)
    }
  }

  /**
   * Setup keyboard event listener on chart container
   * This ensures shortcuts work even when focus is inside the TradingView chart
   */
  setupContainerKeyboardListener = () => {
    if (!this.containerRef.current) {
      // Retry if container isn't ready yet
      setTimeout(() => this.setupContainerKeyboardListener(), 100)
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with input fields or text areas
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Don't interfere with browser shortcuts (Ctrl+R, Ctrl+Shift+R, Ctrl+W, etc.)
      // Only handle shortcuts that are configured in our settings
      const isBrowserShortcut = 
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') || // Reload
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'r') || // Hard reload
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') || // Close tab
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') || // New tab
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') || // New window
        (event.key === 'F5') || // Reload
        (event.key === 'F12') // Dev tools

      if (isBrowserShortcut) {
        // Let browser handle these shortcuts
        return
      }

      // Load shortcuts from settings to check if this key is configured
      try {
        const shortcutsConfig = getShortcutsWithCustomizations()
        const allShortcuts: any[] = []
        shortcutsConfig.forEach((category) => {
          category.shortcuts.forEach((shortcut) => {
            if (shortcut.enabled !== false) {
              allShortcuts.push(shortcut)
            }
          })
        })

        // Check if this key combination matches any configured shortcut
        const key = event.key.toLowerCase()
        const matchesShortcut = allShortcuts.some((shortcut) => {
          const active = getActiveShortcut(shortcut)
          const keyMatch = active.key.toLowerCase() === key
          const ctrlMatch = !!active.ctrl === (event.ctrlKey || event.metaKey)
          const shiftMatch = active.shift === undefined || active.shift === event.shiftKey
          const altMatch = active.alt === undefined || active.alt === event.altKey
          const metaMatch = active.meta === undefined || active.meta === event.metaKey

          return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch
        })

        // Only prevent default if this matches a configured shortcut
        if (matchesShortcut) {
          // Prevent TradingView from handling this
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()

          // Create a synthetic event and dispatch it to document level immediately
          // This allows the app's keyboard shortcut handlers to catch it
          const syntheticEvent = new KeyboardEvent('keydown', {
            key: event.key,
            code: event.code,
            keyCode: event.keyCode,
            which: event.which,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            bubbles: true,
            cancelable: true,
          })

          // Dispatch to document immediately so app-level handlers can catch it
          document.dispatchEvent(syntheticEvent)
        }
      } catch (error) {
        console.warn('Could not check shortcuts from settings:', error)
        // If settings fail, don't prevent any shortcuts
      }
    }

    // Use capture phase to catch events before TradingView
    this.containerRef.current.addEventListener('keydown', handleKeyDown, true)

    // Also listen on the widget's iframe if it exists
    const widgetIframe = this.containerRef.current.querySelector('iframe')
    if (widgetIframe && widgetIframe.contentWindow) {
      try {
        widgetIframe.contentWindow.addEventListener('keydown', handleKeyDown, true)
      } catch (e) {
        // Cross-origin iframe, can't access
        console.warn('Cannot access widget iframe for keyboard events:', e)
      }
    }

    // Store cleanup function
    ;(this as any)._keyboardListenerCleanup = () => {
      if (this.containerRef.current) {
        this.containerRef.current.removeEventListener('keydown', handleKeyDown, true)
      }
    }
  }

  /**
   * Handle custom shortcuts - can be overridden by child classes
   * @param widget - TradingView widget instance
   */
  handleCustomShortcuts = (widget: any) => {
    // Override in child classes to add custom shortcuts
  }

  /**
   * Setup event subscriptions for the widget
   * Always subscribes to events so child classes can override handlers
   * Can be overridden by child classes if needed
   */
  setupEventSubscriptions = (widget: any) => {
    if (!widget) return

    // Always subscribe to onAutoSaveNeeded event
    // Child classes can override handleAutoSaveNeeded to customize behavior
      try {
        widget.subscribe?.('onAutoSaveNeeded', async () => {
          await this.handleAutoSaveNeeded()
        })
      } catch (error) {
        console.warn('Could not subscribe to onAutoSaveNeeded:', error)
    }

    // Always subscribe to onChartReady event
    // Child classes can override handleChartReady, handleIntervalChange, handleSymbolChange
      try {
        widget.onChartReady?.(async () => {
        // Always call handleChartReady (can be overridden by child classes)
            await this.handleChartReady()

          // Subscribe to interval and symbol changes when chart is ready
          try {
            const activeChart = widget.activeChart?.()
            
          if (activeChart) {
            // Always subscribe to interval changes
            // Child classes can override handleIntervalChange
              activeChart.onIntervalChanged?.().subscribe?.(
                null,
                (interval: any) => {
                  this.handleIntervalChange(interval)
                }
              )

            // Always subscribe to symbol changes
            // Child classes can override handleSymbolChange
              activeChart.onSymbolChanged?.().subscribe?.(
                null,
                (symbol: any) => {
                  this.handleSymbolChange(symbol?.name || symbol)
                }
              )
            }
          } catch (error) {
            console.warn('Could not subscribe to chart change events:', error)
          }
        })
      } catch (error) {
        console.warn('Could not subscribe to onChartReady:', error)
    }
  }

  showPlaceholder = () => {
    if (!this.containerRef.current) return
    const { isDark = false } = this.props
    this.containerRef.current.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: ${isDark ? '#94a3b8' : '#64748b'};
        text-align: center;
        padding: 2rem;
        flex-direction: column;
        gap: 1rem;
      ">
        <div style="
          width: 48px;
          height: 48px;
          border: 4px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)'};
          border-top-color: ${isDark ? '#94a3b8' : '#64748b'};
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
        <div style="font-size: 0.875rem; opacity: 0.8;">
          Loading Chart...
        </div>
      </div>
    `
  }

  showErrorPlaceholder = () => {
    if (!this.containerRef.current) return
    const { isDark = false } = this.props
    this.containerRef.current.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: ${isDark ? '#94a3b8' : '#64748b'};
        text-align: center;
        padding: 2rem;
        flex-direction: column;
        gap: 1rem;
      ">
        <div style="
          width: 48px;
          height: 48px;
          border: 4px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)'};
          border-top-color: ${isDark ? '#94a3b8' : '#64748b'};
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
        <div style="font-size: 0.875rem; opacity: 0.8;">
          Loading Chart...
        </div>
      </div>
    `
  }

  render() {
    const { style, className } = this.props

    return (
      <div
        ref={this.containerRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '100vh',
          position: 'relative',
          ...style,
        }}
      />
    )
  }
}

export default BaseChart

