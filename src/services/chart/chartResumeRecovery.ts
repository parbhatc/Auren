import type { TradeseaMdsClient } from '../tradesea/TradeseaMdsClient'
import type { BwcWidget } from './bwcDatafeed'

const MEANINGFUL_BACKGROUND_MS = 30_000
const RESUME_SETTLE_MS = 300
const RELOAD_SETTLE_MS = 200
const RETRY_MS = 250
const MAX_RETRIES = 24
const MAX_RECOVERY_FAILURES = 6

type RecoveryOptions = {
  connection: Pick<TradeseaMdsClient, 'on' | 'getConnectionState' | 'resendAllSubscriptions'>
  datafeed: { clearHistoryCache?(): void; refreshMdsSubscriptions?(): void }
  getWidget: () => BwcWidget | null
  onReloadStart?: () => void
  onReloadDone?: () => void
  onError?: (error: unknown) => void
  onTrace?: (phase: string, detail?: { backgroundMs?: number; snapshot?: unknown; report?: unknown }) => void
  pageDocument?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
  pageWindow?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  viewActive?: boolean
}

/**
 * Reconcile every pane after a socket outage or browser suspension. A fresh tick
 * proves the socket works; it cannot fill candles missed while Safari was asleep.
 */
export function createChartResumeRecovery(options: RecoveryOptions) {
  const { connection, datafeed, getWidget } = options
  const pageDocument = options.pageDocument ?? (typeof document === 'undefined' ? undefined : document)
  const pageWindow = options.pageWindow ?? (typeof window === 'undefined' ? undefined : window)
  let disposed = false
  let viewActive = options.viewActive !== false
  let revision = 0
  let completedRevision = 0
  let inFlight = false
  let wasConnected = connection.getConnectionState() === 'connected'
  let hiddenAt = !viewActive || pageDocument?.visibilityState === 'hidden' ? Date.now() : null
  let pendingPageGap = false
  let lastPageGapAt: number | null = null
  let retries = 0
  let recoveryFailures = 0
  let checkpoint: { widget: BwcWidget; state: unknown } | null = null
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let resumeTimer: ReturnType<typeof setTimeout> | null = null

  const isVisible = () => viewActive && pageDocument?.visibilityState !== 'hidden'
  const needsReload = () => revision > completedRevision
  const trace = (phase: string, detail?: { backgroundMs?: number; snapshot?: unknown; report?: unknown }) => {
    try { options.onTrace?.(phase, detail) } catch { /* Diagnostics cannot interrupt recovery. */ }
  }

  const scheduleReload = (delay = RELOAD_SETTLE_MS) => {
    if (disposed || !needsReload() || !isVisible()) return
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => {
      reloadTimer = null
      void reloadPending()
    }, delay)
  }

  const scheduleRetry = () => {
    if (retries >= MAX_RETRIES) return
    retries += 1
    scheduleReload(RETRY_MS)
  }

  const captureCheckpoint = () => {
    const widget = getWidget()
    if (checkpoint?.widget === widget) return
    if (widget?.captureResumeState) checkpoint = { widget, state: widget.captureResumeState() }
  }

  const markGap = () => {
    captureCheckpoint()
    revision += 1
    retries = 0
    recoveryFailures = 0
  }

  const reloadPending = async () => {
    if (disposed) return
    // Boot may finish after the page was hidden, before the widget existed at
    // visibilitychange. Capture that first loaded tail before later ticks jump.
    if (!isVisible()) {
      captureCheckpoint()
      return
    }
    if (inFlight || resumeTimer || !needsReload()) return
    if (connection.getConnectionState() !== 'connected') return
    const widget = getWidget()
    if (!widget?.recover) {
      scheduleRetry()
      return
    }
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = null
    const loadingRevision = revision
    const since = checkpoint?.widget === widget ? checkpoint.state : undefined
    inFlight = true
    let failed = false
    try {
      datafeed.refreshMdsSubscriptions?.()
      options.onReloadStart?.()
      trace('start', { snapshot: since })
      // Retain loaded candles and indicator stores. The pre-suspension checkpoint
      // stays authoritative even if the first resumed tick jumps past the gap.
      const report = await widget.recover({ since, shouldContinue: () => !disposed && getWidget() === widget })
      if (disposed || getWidget() !== widget) return
      completedRevision = loadingRevision
      retries = 0
      recoveryFailures = 0
      if (!needsReload()) checkpoint = null
      options.onReloadDone?.()
      trace('complete', { report })
      // Mark success first: this emits resubscribed synchronously and must not
      // schedule another repair for the recovery we have just completed.
      connection.resendAllSubscriptions()
    } catch (error) {
      failed = true
      trace('error')
      options.onError?.(error)
    } finally {
      inFlight = false
      if (!disposed && needsReload()) {
        if (failed) {
          recoveryFailures += 1
          if (recoveryFailures <= MAX_RECOVERY_FAILURES) {
            scheduleReload(Math.min(15_000, 1_000 * 2 ** (recoveryFailures - 1)))
          }
        }
        else scheduleReload()
      }
    }
  }

  const markDisconnected = () => {
    if (!wasConnected) return
    wasConnected = false
    markGap()
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = null
  }
  const offClose = connection.on('close', markDisconnected)
  const offConnection = connection.on('connection', (state) => {
    if (state === 'connected') {
      wasConnected = true
      scheduleReload()
    } else {
      markDisconnected()
    }
  })
  const offResubscribed = connection.on('resubscribed', () => scheduleReload())

  const onHidden = () => {
    const firstHiddenEvent = hiddenAt === null
    if (hiddenAt === null) hiddenAt = Date.now()
    captureCheckpoint()
    if (firstHiddenEvent) trace('hidden', { snapshot: checkpoint?.state })
    if (resumeTimer) clearTimeout(resumeTimer)
    resumeTimer = null
  }
  const onVisible = (event?: Event) => {
    const persisted = event?.type === 'pageshow' && (event as PageTransitionEvent).persisted
    pendingPageGap ||= Boolean(persisted)
    if (!isVisible()) return
    const now = Date.now()
    if (hiddenAt !== null || persisted) trace('visible', { backgroundMs: hiddenAt === null ? undefined : Math.max(0, now - hiddenAt) })
    pendingPageGap ||= hiddenAt !== null && now - hiddenAt >= MEANINGFUL_BACKGROUND_MS
    hiddenAt = null
    if (resumeTimer) clearTimeout(resumeTimer)
    // MDS checks/replaces zombie sockets after 150ms. Let that check run before
    // deciding whether history can be loaded on the current connection.
    resumeTimer = setTimeout(() => {
      resumeTimer = null
      if (pendingPageGap && (lastPageGapAt === null || Date.now() - lastPageGapAt >= 1_000)) {
        markGap()
        lastPageGapAt = Date.now()
      }
      pendingPageGap = false
      if (!needsReload() && !inFlight) checkpoint = null
      void reloadPending()
    }, RESUME_SETTLE_MS)
  }
  const onVisibility = (event: Event) => {
    if (isVisible()) onVisible(event)
    else onHidden()
  }
  pageDocument?.addEventListener('visibilitychange', onVisibility)
  pageWindow?.addEventListener('pagehide', onHidden)
  pageWindow?.addEventListener('pageshow', onVisible)
  pageWindow?.addEventListener('focus', onVisible)

  return {
    reloadPending,
    setViewActive(active: boolean) {
      if (disposed || viewActive === active) return
      viewActive = active
      if (isVisible()) onVisible()
      else onHidden()
    },
    dispose() {
      disposed = true
      checkpoint = null
      offClose()
      offConnection()
      offResubscribed()
      if (reloadTimer) clearTimeout(reloadTimer)
      if (resumeTimer) clearTimeout(resumeTimer)
      pageDocument?.removeEventListener('visibilitychange', onVisibility)
      pageWindow?.removeEventListener('pagehide', onHidden)
      pageWindow?.removeEventListener('pageshow', onVisible)
      pageWindow?.removeEventListener('focus', onVisible)
    },
  }
}
