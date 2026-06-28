import { Component, createRef, CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_BACKTESTER_SYMBOL } from '../../constants'
import type { BacktesterChartProps } from '../../../types/chart'
import { createBwcDatafeed, type BwcWidget } from '../../../services/chart/bwcDatafeed'
import type { BwcToolbarSlot, BwcToolbarSlotAnchor } from '../../../services/chart/bwcToolbarApi'
import { loadAurenChartBoot } from '../../../services/chart/loadAurenChartBoot'
import { setupChartKeyboardShortcuts } from '../../../components/common/chartKeyboardShortcuts'
import SessionDateNavigation from '../../../components/backtester/BacktesterChartView/SessionDateNavigation'
import { PadTradeSymbolPicker } from '../../../components/trading/shared/pad/TradeContractPicker'
import type { BacktesterChartDataFeed } from './BacktesterChartDataFeed'
import { CHART_ORDER_LINE_THEME } from '../../../constants/chartOrderLineTheme'

/** Wait until the chart mount has non-zero layout (avoids LWC "Value is null" on 0×0 containers). */
function waitForMountLayout(mount: HTMLElement, timeoutMs = 4000): Promise<void> {
  const hasSize = () => mount.clientWidth > 0 && mount.clientHeight > 0
  if (hasSize()) return Promise.resolve()

  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      ro?.disconnect()
      clearTimeout(timer)
      resolve()
    }

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (hasSize()) finish()
          })
        : null
    ro?.observe(mount)

    const timer = window.setTimeout(finish, timeoutMs)
  })
}

function chartShellHtml(chartId: string): string {
  return `
    <div class="tv-app" style="width:100%;height:100%;display:flex;flex-direction:column;min-height:0">
      <header class="tv-toolbar" aria-label="Chart toolbar">
        <div class="tv-toolbar__left">
          <div class="tv-symbol" id="symbol-picker">
            <button type="button" class="tv-symbol__trigger" id="symbol-trigger" aria-haspopup="listbox" aria-expanded="false">
              <span class="tv-symbol__ticker" id="symbol-ticker">—</span>
              <svg class="tv-symbol__chev" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path fill="currentColor" d="M1 1l4 4 4-4"/></svg>
            </button>
            <div class="tv-symbol__dropdown" id="symbol-dropdown" hidden>
              <input type="text" class="tv-symbol__search" id="symbol-search" placeholder="Search symbol…" autocomplete="off" spellcheck="false" />
              <ul class="tv-symbol__list" id="symbol-list" role="listbox"></ul>
            </div>
          </div>
          <div class="tv-toolbar__sep" aria-hidden="true"></div>
          <div id="timeframe-picker" class="tv-tf"></div>
        </div>
        <div class="tv-toolbar__right"></div>
      </header>
      <div class="tv-workspace" style="flex:1;min-height:0">
        <aside id="drawing-toolbar" class="drawing-toolbar" aria-label="Drawing tools"></aside>
          <main class="tv-stage" aria-busy="true" style="flex:1;min-height:0">
          <div class="tv-chart-wrap" style="height:100%">
            <div class="tv-chart-wrap__stage" style="height:100%">
              <div class="tv-watermark" aria-hidden="true"><span class="tv-watermark__text" id="watermark"></span></div>
              <div id="${chartId}" style="width:100%;height:100%"></div>
              <div class="status-line tv-ohlc" id="ohlc" aria-live="polite"></div>
            </div>
            <footer class="tv-chart-replay-bar" aria-label="Bar replay" hidden>
              <div class="tv-chart-replay-bar__grow"></div>
              <div class="tv-chart-replay-bar__controls" id="chart-replay-toolbar" role="toolbar" aria-label="Bar replay controls"></div>
              <div class="tv-chart-replay-bar__grow"></div>
            </footer>
            <footer class="tv-chart-bottom-bar" aria-label="Chart bottom bar">
              <div class="tv-chart-bottom-bar__grow"></div>
              <div class="tv-chart-bottom-bar__right" id="chart-bottom-toolbar"></div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  `
}

const SESSION_DATE_TOOLBAR_SLOT_ID = 'session-date'
const TRADE_SYMBOL_TOOLBAR_SLOT_ID = 'trade-symbol'
const BWC_NEWS_SETTINGS_KEY = 'bwc-news-settings'

const TOOLBAR_ANCHOR_SELECTORS: Record<string, string> = {
  symbol: '#symbol-picker',
  timeframe: '#timeframe-picker',
  indicators: '#header-toolbar-indicators',
  replay: '#header-toolbar-replay',
}

function disableBwcNewsForBacktester(): void {
  try {
    const raw = localStorage.getItem(BWC_NEWS_SETTINGS_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    localStorage.setItem(BWC_NEWS_SETTINGS_KEY, JSON.stringify({ ...parsed, enabled: false }))
  } catch {
    // ignore
  }
}

type BacktesterChartState = Record<string, never>

class BacktesterChart extends Component<BacktesterChartProps, BacktesterChartState> {
  widgetRef: BwcWidget | null = null
  private shellRef = createRef<HTMLDivElement>()
  private bootGeneration = 0
  private chartMountEl: HTMLElement | null = null
  private dateNavSlot: BwcToolbarSlot | null = null
  private tradeSymbolSlot: BwcToolbarSlot | null = null
  private dateNavMountEl: HTMLElement | null = null
  private tradeSymbolMountEl: HTMLElement | null = null
  private toolbarSlotMountRaf: number | null = null
  private toolbarSlotWarned = false

  state: BacktesterChartState = {}

  getDatafeed(): BacktesterChartDataFeed | undefined {
    return this.props.datafeed as BacktesterChartDataFeed | undefined
  }

  getChartWidget(): { chart: () => { symbol: () => string; resolution: () => string }; activeChart: () => { symbol: () => string; resolution: () => string } } | null {
    const widget = this.widgetRef
    if (!widget) return null
    const chartApi = () => ({
      symbol: () => String(widget.getSymbol?.() || this.props.symbol || ''),
      resolution: () => String(widget.getResolution?.() || this.props.timeframe || '1'),
      requestSelectBar: () => Promise.reject(new Error('Bar replay picker is not available on BWC')),
      cancelSelectBar: () => {},
    })
    return {
      chart: chartApi,
      activeChart: chartApi,
    }
  }

  /** Reload history from the server anchor and reset viewport (practice-trade style). */
  reloadSessionDate = async (): Promise<void> => {
    const datafeed = this.props.datafeed as { resetSessionState?: () => void } | undefined
    datafeed?.resetSessionState?.()

    const widget = this.widgetRef
    if (!widget?.reset) return
    try {
      await widget.reset({ data: true, viewport: true, price: true, time: true })
      widget.replay?.enter?.()
    } catch (err) {
      console.warn('[BacktesterChart] session date reload failed:', err)
    }
  }

  resetAllChartData = async (): Promise<void> => {
    await this.reloadSessionDate()
  }

  private cancelToolbarSlotMount(): void {
    if (this.toolbarSlotMountRaf != null) {
      cancelAnimationFrame(this.toolbarSlotMountRaf)
      this.toolbarSlotMountRaf = null
    }
  }

  private clearToolbarSlots(): void {
    this.cancelToolbarSlotMount()
    this.dateNavSlot?.remove()
    this.tradeSymbolSlot?.remove()
    this.dateNavSlot = null
    this.tradeSymbolSlot = null
    const hadPortals = this.dateNavMountEl != null || this.tradeSymbolMountEl != null
    this.dateNavMountEl = null
    this.tradeSymbolMountEl = null
    if (hadPortals) this.forceUpdate()
  }

  /** Same shell scoping BWC toolbarHost uses (mount → .tv-app → .tv-toolbar → left). */
  private getToolbarLeftRegion(): HTMLElement | null {
    const mount = this.chartMountEl
    if (!mount?.isConnected) return null
    const root = mount.closest('.tv-app')
    if (!(root instanceof HTMLElement) || !root.isConnected) return null
    const chrome = root.querySelector('.tv-toolbar')
    if (!(chrome instanceof HTMLElement) || !chrome.isConnected) return null
    const left = chrome.querySelector('.tv-toolbar__left')
    return left instanceof HTMLElement && left.isConnected ? left : null
  }

  private isToolbarSlotHostReady(): boolean {
    const left = this.getToolbarLeftRegion()
    if (!left) return false
    return Boolean(left.querySelector('#header-toolbar-indicators'))
  }

  private resolveToolbarAnchor(regionEl: HTMLElement, after: BwcToolbarSlotAnchor): HTMLElement | null {
    if (after === 'end') return null
    const staticSel = TOOLBAR_ANCHOR_SELECTORS[after]
    if (staticSel) {
      const el = regionEl.querySelector(staticSel)
      if (el instanceof HTMLElement) return el
    }
    const hostSlot = regionEl.querySelector(`[data-toolbar-slot="${after}"]`)
    return hostSlot instanceof HTMLElement ? hostSlot : null
  }

  private insertToolbarSlotAfterAnchor(
    regionEl: HTMLElement,
    mount: HTMLElement,
    after: BwcToolbarSlotAnchor,
  ): void {
    if (after === 'end') {
      regionEl.appendChild(mount)
      return
    }
    const anchor = this.resolveToolbarAnchor(regionEl, after)
    if (anchor) {
      anchor.insertAdjacentElement('afterend', mount)
      return
    }
    regionEl.appendChild(mount)
  }

  /** Mount into the embed shell directly — avoids BWC ctx.chromeEl pointing at another chart. */
  private createLocalToolbarSlot(
    regionEl: HTMLElement,
    opts: {
      id: string
      className?: string
      after?: BwcToolbarSlotAnchor
      separator?: boolean
    },
  ): BwcToolbarSlot {
    const { id, className = '', after = 'end', separator = false } = opts
    const existing = regionEl.querySelector(`[data-toolbar-slot="${id}"]`)
    if (existing instanceof HTMLElement) {
      return {
        id,
        region: 'left',
        element: existing,
        remove: () => {
          regionEl.querySelector(`[data-toolbar-slot-sep="${id}"]`)?.remove()
          existing.remove()
        },
      }
    }

    const mount = document.createElement('div')
    mount.className = ['tv-toolbar__slot', className].filter(Boolean).join(' ')
    mount.dataset.toolbarSlot = id

    let sepEl: HTMLElement | null = null
    if (separator) {
      sepEl = document.createElement('div')
      sepEl.className = 'tv-toolbar__sep tv-toolbar__sep--host-slot'
      sepEl.dataset.toolbarSlotSep = id
      sepEl.setAttribute('aria-hidden', 'true')
      this.insertToolbarSlotAfterAnchor(regionEl, sepEl, after)
      sepEl.insertAdjacentElement('afterend', mount)
    } else {
      this.insertToolbarSlotAfterAnchor(regionEl, mount, after)
    }

    return {
      id,
      region: 'left',
      element: mount,
      remove: () => {
        sepEl?.remove()
        mount.remove()
      },
    }
  }

  private syncToolbarPortalTargets(
    tradeSymbolMountEl: HTMLElement | null,
    dateNavMountEl: HTMLElement | null,
  ): void {
    const changed =
      tradeSymbolMountEl !== this.tradeSymbolMountEl || dateNavMountEl !== this.dateNavMountEl
    this.tradeSymbolMountEl = tradeSymbolMountEl
    this.dateNavMountEl = dateNavMountEl
    if (changed) this.forceUpdate()
  }

  private mountToolbarSlots(_widget: BwcWidget, attempt = 0): boolean {
    if (attempt === 0) {
      this.clearToolbarSlots()
      this.toolbarSlotWarned = false
    }
    const regionEl = this.getToolbarLeftRegion()
    if (!regionEl || !this.isToolbarSlotHostReady()) return false

    let tradeSymbolMountEl: HTMLElement | null = null
    let dateNavMountEl: HTMLElement | null = null

    if (this.props.tradeToolbarProps?.chartSymbol) {
      try {
        const slot = this.createLocalToolbarSlot(regionEl, {
          id: TRADE_SYMBOL_TOOLBAR_SLOT_ID,
          after: 'indicators',
          separator: true,
          className: 'tv-toolbar__trade-symbol',
        })
        this.tradeSymbolSlot = slot
        tradeSymbolMountEl = slot.element
      } catch (err) {
        if (attempt >= 30) {
          console.warn('[BacktesterChart] Failed to mount trade symbol toolbar slot:', err)
        }
      }
    }

    if (this.props.session) {
      try {
        const slot = this.createLocalToolbarSlot(regionEl, {
          id: SESSION_DATE_TOOLBAR_SLOT_ID,
          after: this.props.tradeToolbarProps?.chartSymbol
            ? TRADE_SYMBOL_TOOLBAR_SLOT_ID
            : 'indicators',
          separator: !this.props.tradeToolbarProps?.chartSymbol,
          className: 'tv-toolbar__date-nav',
        })
        this.dateNavSlot = slot
        dateNavMountEl = slot.element
      } catch (err) {
        if (attempt >= 30) {
          console.warn('[BacktesterChart] Failed to mount session date toolbar slot:', err)
        }
      }
    }

    this.syncToolbarPortalTargets(tradeSymbolMountEl, dateNavMountEl)

    const needSymbol = Boolean(this.props.tradeToolbarProps?.chartSymbol)
    const needDate = Boolean(this.props.session)
    const ok = (!needSymbol || tradeSymbolMountEl != null) && (!needDate || dateNavMountEl != null)
    if (!ok && attempt >= 30 && !this.toolbarSlotWarned) {
      this.toolbarSlotWarned = true
      console.warn('[BacktesterChart] Toolbar slots not mounted after retries', {
        needSymbol,
        needDate,
        mountConnected: this.chartMountEl?.isConnected ?? false,
        toolbarReady: this.isToolbarSlotHostReady(),
      })
    }
    return ok
  }

  private scheduleToolbarSlotMount(widget: BwcWidget, generation: number, attempt = 0): void {
    this.cancelToolbarSlotMount()
    if (generation !== this.bootGeneration || this.widgetRef !== widget) return

    const ok = this.mountToolbarSlots(widget, attempt)
    if (ok || attempt >= 30) return

    this.toolbarSlotMountRaf = requestAnimationFrame(() => {
      this.toolbarSlotMountRaf = null
      this.scheduleToolbarSlotMount(widget, generation, attempt + 1)
    })
  }

  private async bootChart(): Promise<void> {
    const shell = this.shellRef.current
    if (!shell || !this.props.datafeed) return

    const generation = ++this.bootGeneration
    const chartId = `backtest-chart-${generation}`
    this.chartMountEl = null
    this.clearToolbarSlots()
    shell.innerHTML = chartShellHtml(chartId)
    const mount = shell.querySelector(`#${chartId}`) as HTMLElement | null
    if (!mount) return
    this.chartMountEl = mount

    await waitForMountLayout(mount)
    if (generation !== this.bootGeneration) return

    const { symbol = DEFAULT_BACKTESTER_SYMBOL, timeframe = '1', isDark = true, datafeed } = this.props
    const theme = isDark === false ? 'light' : 'dark'

    try {
      disableBwcNewsForBacktester()
      const { bootChart, registerAurenChartIndicators, registerTradeContextActions, clearChartContextActions } =
        await loadAurenChartBoot()
      if (generation !== this.bootGeneration) return

      try {
        await registerAurenChartIndicators()
      } catch (err) {
        console.warn('[BacktesterChart] Optional indicators skipped:', err)
      }
      if (generation !== this.bootGeneration) return

      const bwcFeed = createBwcDatafeed(datafeed as never)
      const { onReplayHostAction } = this.props
      const widget = (await bootChart({
        mount,
        symbol,
        resolution: timeframe,
        theme,
        drawings: true,
        chrome: true,
        replay: true,
        skipAppLoader: true,
        // Load more history up front; backtester CSV data is local so larger batches are cheap.
        countBack: 2000,
        historyChunk: 500,
        datafeed: bwcFeed,
        replayHideSelectModeMenu: true,
        replayHostControlled: true,
        replayAutoEnter: true,
        replayPersistent: true,
        replayHideJumpEnd: true,
        replayHideToggle: true,
        replayHideExit: true,
        orderLineTheme: CHART_ORDER_LINE_THEME,
        onReplayHostAction: (action: string, payload: Record<string, unknown>) => {
          onReplayHostAction?.(action, payload)
        },
        onSymbolChange: (sym) => {
          this.props.onSymbolChange?.(sym)
        },
      })) as BwcWidget

      if (generation !== this.bootGeneration) {
        widget.destroy?.()
        return
      }

      this.widgetRef = widget
      widget.replay?.enter?.()
      await this.handleChartReady()
      this.scheduleToolbarSlotMount(widget, generation)
      setupChartKeyboardShortcuts(widget)
      clearChartContextActions()
      registerTradeContextActions({})

      this.props.onWidgetReady?.(widget)
      this.props.onReady?.(widget)
    } catch (err) {
      console.error('[BacktesterChart] boot failed:', err)
    }
  }

  handleChartReady = async (): Promise<void> => {
    await this.props.onChartReady?.()
  }

  handleIntervalChange = (interval: string): void => {
    this.props.onIntervalChange?.(interval)
  }

  componentDidMount(): void {
    void this.bootChart()
  }

  componentDidUpdate(prevProps: BacktesterChartProps): void {
    const widget = this.widgetRef
    if (!widget) return

    if (prevProps.symbol !== this.props.symbol && this.props.symbol) {
      void widget.setSymbol?.(this.props.symbol)
    }
    if (prevProps.isDark !== this.props.isDark) {
      void this.bootChart()
      return
    }
    if (
      prevProps.session !== this.props.session ||
      prevProps.tradeToolbarProps?.chartSymbol !== this.props.tradeToolbarProps?.chartSymbol
    ) {
      const needsDate =
        Boolean(this.props.session) &&
        (!this.dateNavSlot?.element.isConnected || !this.dateNavMountEl)
      const needsSymbol =
        Boolean(this.props.tradeToolbarProps?.chartSymbol) &&
        (!this.tradeSymbolSlot?.element.isConnected || !this.tradeSymbolMountEl)
      if (needsDate || needsSymbol) {
        this.scheduleToolbarSlotMount(widget, this.bootGeneration)
      }
    }
  }

  componentWillUnmount(): void {
    this.bootGeneration += 1
    this.chartMountEl = null
    this.clearToolbarSlots()
    this.widgetRef?.destroy?.()
    this.widgetRef = null
  }

  render() {
    const { style, className, session, isDark, tradeHandler, tradeToolbarProps } = this.props
    const { tradeSymbolMountEl, dateNavMountEl } = this

    return (
      <>
        <div
          ref={this.shellRef}
          className={className}
          style={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            ...(style as CSSProperties),
          }}
        />
        {tradeSymbolMountEl &&
          tradeToolbarProps?.chartSymbol &&
          createPortal(
            <PadTradeSymbolPicker props={tradeToolbarProps} />,
            tradeSymbolMountEl,
          )}
        {dateNavMountEl &&
          session &&
          createPortal(
            <SessionDateNavigation
              isDark={isDark !== false}
              session={session}
              tradeHandler={tradeHandler ?? null}
              compact
            />,
            dateNavMountEl,
          )}
      </>
    )
  }
}

/**
 * BetterweightChart shell for CSV replay backtesting.
 * Exposes TV-compatible helpers (getChartWidget, resetAllChartData) for BacktesterTradeHandler.
 */
export default BacktesterChart
