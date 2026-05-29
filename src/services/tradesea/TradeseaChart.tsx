/**
 * Practice chart (delayed MDS + UDF; unified user-data WebSocket).
 */
import { CSSProperties, RefObject } from 'react'
import BaseChart from 'tradingview-chart/components/common/BaseChart'
import { registerTradeContextActions } from '../../components/common/aurenTradeContextMenu'
import {
  setupChartContainerKeyboardListener,
  setupChartKeyboardShortcuts,
} from '../../components/common/chartKeyboardShortcuts'
import { TradingViewChartProps } from '../../types/chart'
import { TradeseaTradeHandler } from './TradeseaTradeHandler'
import { PracticeTradeHandler } from '../practice/PracticeTradeHandler'
import { TradeseaDatafeed } from './TradeseaDatafeed'
import { TradeseaMdsClient } from './TradeseaMdsClient'
import { TradeseaTradesClient } from './TradeseaTradesClient'
import { getTradeseaConnectionGroupId } from './tradeseaDeviceFingerprint'
import { getApiBaseUrl, getAuthToken } from '../../api/api'
import { tradeseaAPI, TradeseaStreamConfig } from '../../api/tradesea.api'
import {
  resolveMdsSubscribeTicker,
  shouldSubscribeMdsDepth,
  shouldUseDelayedMdsSymbols,
} from './tradeseaMdsSymbols'
import { debugPracticeChartSymbol } from './practiceChartSymbolDebug'
import { DEFAULT_PRACTICE_CHART_SYMBOL } from '../../constants/practice'

export type TradeseaChartServices = {
  mds?: TradeseaMdsClient
  trades?: TradeseaTradesClient
  datafeed: TradeseaDatafeed
  streamConfig: TradeseaStreamConfig | { delayed: boolean }
  accountId: string
}

class TradeseaChart extends BaseChart {
  datafeed: TradeseaDatafeed | null = null
  services: TradeseaChartServices | null = null
  /** Practice + load_last_chart: do not emit symbol until TV restores layout. */
  private practiceRestoreLayout = false

  private getUsernameFromToken(): string {
    try {
      const token = getAuthToken()
      if (!token) return 'public_user_id'
      const parts = token.split('.')
      if (parts.length !== 3) return 'public_user_id'
      const payload = JSON.parse(atob(parts[1]))
      return payload.username || 'public_user_id'
    } catch {
      return 'public_user_id'
    }
  }

  protected init(): void {
    super.init()
    const props = this.props as TradingViewChartProps

    const services = props.tradeseaServices as TradeseaChartServices | null | undefined
    if (!services) return

    const practiceAccountId = String(props.practiceAccountId || '').trim()
    const isPracticeChart = Boolean(practiceAccountId)
    this.practiceRestoreLayout = isPracticeChart

    this.services = services
    this.datafeed = services.datafeed
    services.datafeed.setChartResetCallback(() => this.resetAllChartData())

    this.setDatafeed(services.datafeed)
    this.setInterval(props.timeframe || '1')
    this.setContainer(props.containerId || 'tv_chart_container')
    this.setTheme(props.isDark ? 'dark' : 'light')
    this.setStorageUrl(`${getApiBaseUrl()}/tradesea/chart_storage`, '1.1')

    const username = this.getUsernameFromToken()
    const storageUser = isPracticeChart
      ? `${username}__practice_${practiceAccountId}`
      : `${username}__${services.accountId}`
    this.setClientId(getAuthToken() || 'public_user_id', storageUser)
    this.setFullscreen(false)
    if (this.config) {
      // Practice: restore drawings/studies/layout per sim account. Live: avoid cross-account schema warnings.
      this.config.load_last_chart = isPracticeChart
      if (isPracticeChart && !String(props.symbol || '').trim()) {
        if (services.mds) {
          const useDelayedMd = shouldUseDelayedMdsSymbols(
            services.streamConfig as TradeseaStreamConfig
          )
          this.config.symbol = resolveMdsSubscribeTicker(
            DEFAULT_PRACTICE_CHART_SYMBOL,
            useDelayedMd
          )
        } else {
          this.config.symbol = DEFAULT_PRACTICE_CHART_SYMBOL
        }
      }
      if (isPracticeChart && this.config.load_last_chart) {
        delete (this.config as { symbol?: string }).symbol
      }
    }
    debugPracticeChartSymbol('TradeseaChart.init', {
      propsSymbol: props.symbol,
      configSymbol: this.config?.symbol,
      load_last_chart: this.config?.load_last_chart,
      practiceAccountId,
      storageUser,
    }, { force: true })
    this.addEnabledFeature('seconds_resolution')
    this.addEnabledFeature('tick_resolution')
  }

  componentDidUpdate(prevProps: TradingViewChartProps) {
    const props = this.props as TradingViewChartProps & { practiceAccountId?: string }
    const practiceAccountId = props.practiceAccountId
    const practiceRestoreLayout = Boolean(practiceAccountId && this.config?.load_last_chart)
    const symbolChanged = prevProps.symbol !== props.symbol && !practiceRestoreLayout

    if (practiceAccountId && prevProps.symbol !== props.symbol) {
      debugPracticeChartSymbol(
        'TradeseaChart.componentDidUpdate',
        {
          prevSymbol: prevProps.symbol,
          nextSymbol: props.symbol,
          practiceRestoreLayout,
          symbolChanged,
        },
        { force: true }
      )
    }

    if (
      symbolChanged ||
      prevProps.timeframe !== props.timeframe ||
      prevProps.isDark !== props.isDark ||
      JSON.stringify(prevProps.widgetConfig) !== JSON.stringify(props.widgetConfig)
    ) {
      this.cleanup()
      this.loadChart()
    }
  }

  handleAutoSaveNeeded = async () => {
    const props = this.props as TradingViewChartProps & { practiceAccountId?: string }
    if (!props.practiceAccountId) {
      if (this.props.onAutoSaveNeeded) await this.props.onAutoSaveNeeded()
      return
    }

    try {
      const widget = (this as unknown as { widgetRef?: { saveChartToServer?: Function } }).widgetRef
      if (!widget?.saveChartToServer) return

      await new Promise<void>((resolve, reject) => {
        widget.saveChartToServer!(
          () => resolve(),
          (error: unknown) => reject(error),
          { defaultChartName: 'Practice' }
        )
      })
    } catch (error) {
      console.warn('[TradeseaChart] practice chart auto-save failed:', error)
    }

    if (this.props.onAutoSaveNeeded) {
      await this.props.onAutoSaveNeeded()
    }
  }

  handleSymbolChange = (symbol: string) => {
    debugPracticeChartSymbol('TradeseaChart.handleSymbolChange', { symbol }, { force: true })
    const props = this.props as TradingViewChartProps
    const symbolHandler = props.tradeseaTradeHandler as TradeseaTradeHandler | PracticeTradeHandler | undefined
    symbolHandler?.handleSymbolChange(symbol)
    if (this.props.onSymbolChange) {
      this.props.onSymbolChange(symbol)
    }
  }

  handleChartReady = async () => {
    const widget = (this as unknown as { widgetRef?: unknown }).widgetRef
    const props = this.props as TradingViewChartProps

    if (widget) {
      setupChartKeyboardShortcuts(widget)
      setTimeout(
        () =>
          setupChartContainerKeyboardListener(
            this as unknown as {
              containerRef: RefObject<HTMLDivElement>
              _keyboardListenerCleanup?: (() => void) | null
            }
          ),
        500
      )
    }

    const handler = props.tradeseaTradeHandler as unknown as
      | TradeseaTradeHandler
      | PracticeTradeHandler
      | undefined
    if (handler && widget) {
      // Wire to the datafeed this widget subscribed with (may differ from propFirm.chartServices after reconnect).
      if (this.datafeed) {
        this.datafeed.setTradeHandler(handler)
      }
      handler.onReady(widget, this.datafeed ?? undefined)
      if (handler instanceof PracticeTradeHandler) {
        const practiceHandler = handler
        registerTradeContextActions({
          onMarketBuy: (quantity: number) => {
            void practiceHandler.logButtonPress('Buy', { quantity })
          },
          onMarketSell: (quantity: number) => {
            void practiceHandler.logButtonPress('Sell', { quantity })
          },
          onLimitBuy: (quantity: number, limitPrice: number) => {
            void practiceHandler.placeLimitOrder('buy', quantity, limitPrice)
          },
          onStopSell: (quantity: number, stopPrice: number) => {
            void practiceHandler.placeLimitOrder('sell', quantity, stopPrice)
          },
        })
      } else {
        const liveHandler = handler as TradeseaTradeHandler
        registerTradeContextActions({
          onMarketBuy: (quantity: number) => {
            void liveHandler.logButtonPress('Buy', { quantity })
          },
          onMarketSell: (quantity: number) => {
            void liveHandler.logButtonPress('Sell', { quantity })
          },
        })
      }
    }

    this.emitActiveChartSymbol('emitReady')
    setTimeout(() => this.emitActiveChartSymbol('emitReady+400ms'), 400)

    if (this.props.onChartReady) {
      await this.props.onChartReady()
    }
  }

  private resolveDefaultChartTvSymbol(): string {
    if (!this.services?.mds) {
      return DEFAULT_PRACTICE_CHART_SYMBOL
    }
    const useDelayedMd = shouldUseDelayedMdsSymbols(
      this.services.streamConfig as TradeseaStreamConfig
    )
    return resolveMdsSubscribeTicker(DEFAULT_PRACTICE_CHART_SYMBOL, useDelayedMd)
  }

  /** After load_last_chart, align app symbol with whatever TradingView restored. */
  private emitActiveChartSymbol(label = 'emit'): void {
    try {
      const widget = (this as unknown as {
        widgetRef?: {
          activeChart?: () => {
            symbol?: () => string
            setSymbol?: (symbol: string, callback?: () => void) => void
          }
        }
      }).widgetRef
      const chart = widget?.activeChart?.()
      if (!chart) return

      const sym = chart.symbol?.()?.trim()
      debugPracticeChartSymbol(`TradeseaChart.${label}`, {
        activeSymbol: sym ?? null,
        propsSymbol: (this.props as TradingViewChartProps).symbol,
      }, { force: true })

      if (sym) {
        this.handleSymbolChange(sym)
        return
      }

      const fallback = this.resolveDefaultChartTvSymbol()
      debugPracticeChartSymbol(`TradeseaChart.${label}:defaultSymbol`, { fallback }, { force: true })
      chart.setSymbol?.(fallback, () => {
        this.handleSymbolChange(fallback)
      })
    } catch (err) {
      debugPracticeChartSymbol(`TradeseaChart.${label}:notReady`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  render() {
    const props = this.props as TradingViewChartProps & {
      style?: CSSProperties
      className?: string
    }
    const { style, className, containerId = 'tv_chart_container' } = props
    const containerRef = (this as unknown as { containerRef: RefObject<HTMLDivElement> })
      .containerRef

    return (
      <div
        ref={containerRef}
        id={containerId}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          flex: '1 1 auto',
          display: 'block',
          position: 'relative',
          ...style,
        }}
      />
    )
  }
}

export async function prepareTradeseaChartServices(
  accountId: string,
  existing?: {
    mds?: TradeseaMdsClient
    trades?: TradeseaTradesClient
    accountId?: string
    datafeed?: TradeseaDatafeed
    bootstrapSymbol?: string
    bootstrapResolution?: string
  } | null,
  options?: { connectTrades?: boolean }
): Promise<TradeseaChartServices> {
  const connectTrades = options?.connectTrades !== false
  const streamConfig = await tradeseaAPI.getStreamConfig(accountId)
  if (!streamConfig.success || !streamConfig.userId) {
    throw new Error(streamConfig.error || 'Failed to load market data stream config')
  }

  const connectionGroupId = await getTradeseaConnectionGroupId(streamConfig.userId)

  const mds = existing?.mds ?? new TradeseaMdsClient()
  mds.configureMarketDepth(shouldSubscribeMdsDepth(streamConfig))
  const useDelayedMd = shouldUseDelayedMdsSymbols(streamConfig)

  const bootstrapSymbol = existing?.bootstrapSymbol
  if (bootstrapSymbol) {
    const ticker = resolveMdsSubscribeTicker(bootstrapSymbol, useDelayedMd)
    const bootstrap = {
      symbols: [ticker],
      resolution: existing?.bootstrapResolution || '1',
    }
    if (existing?.accountId !== accountId || !mds.isConnectedOrConnecting()) {
      mds.connect(accountId, connectionGroupId, bootstrap)
    } else {
      mds.setBootstrap(bootstrap)
    }
  } else if (existing?.accountId !== accountId || !mds.isConnectedOrConnecting()) {
    mds.connect(accountId, connectionGroupId, null)
  }

  const trades = existing?.trades ?? new TradeseaTradesClient()
  if (connectTrades && streamConfig.tradesReadOrigin) {
    trades.connect(accountId)
  } else {
    trades.disconnect()
  }

  const sameAccount = existing?.accountId === accountId
  const delayedMd = useDelayedMd
  const datafeedDelayed = existing?.datafeed?.isDelayedMarketData()
  const needsNewDatafeed = !sameAccount || !existing?.datafeed || datafeedDelayed !== delayedMd
  const datafeed = needsNewDatafeed
    ? new TradeseaDatafeed({
        mds,
        accountId,
        userId: streamConfig.userId,
        connectionGroupId,
        delayed: delayedMd,
      })
    : existing!.datafeed!

  return { mds, trades, datafeed, streamConfig, accountId }
}

export function teardownTradeseaChartServices(services: TradeseaChartServices | null): void {
  if (!services?.mds) return
  services.datafeed.setChartResetCallback(null)
  services.mds.disconnect()
  services.trades?.disconnect()
}

export default TradeseaChart
