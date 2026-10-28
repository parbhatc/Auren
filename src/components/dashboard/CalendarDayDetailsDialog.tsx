import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CalendarDays, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { getAuthToken } from '../../api/api'
import { useTheme } from '../../hooks/useTheme'
import { subscribeAuthEvents } from '../../services/auth/authEvents'
import type { DashboardAccountSelection } from '../../services/dashboard/dashboardAccountSelection'
import {
  loadDashboardDayDetails,
  type DashboardDayDetails,
} from '../../services/dashboard/dashboardDayDetails'
import './CalendarDayDetailsDialog.css'

export interface CalendarDayDetailsDialogProps {
  selection: DashboardAccountSelection
  date: string
  accountName: string
  formatPnl: (value: number) => string
  onClose: () => void
  calendarPnl?: number
}

type RequestState = {
  key: string
  owner: string | null
  status: 'loading' | 'ready' | 'error'
  details: DashboardDayDetails | null
  error: string
  canRetry: boolean
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const amount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })

function known(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value)
}

function dateTitle(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function displayTime(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  })
}

function pnlClass(value: number | null): string {
  return known(value) && value !== 0 ? value > 0 ? 'is-positive' : 'is-negative' : ''
}

export default function CalendarDayDetailsDialog({
  selection,
  date,
  accountName,
  formatPnl,
  onClose,
  calendarPnl,
}: CalendarDayDetailsDialogProps) {
  const { isDark } = useTheme()
  const headingId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openedForOwner = useRef(getAuthToken())
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [attempt, setAttempt] = useState(0)
  const requestKey = JSON.stringify([selection.source, selection.accountId, date])
  const [request, setRequest] = useState<RequestState>(() => ({
    key: requestKey, owner: getAuthToken(), status: 'loading', details: null, error: '', canRetry: true,
  }))

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const html = document.documentElement
    const body = document.body
    const previousStyles = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    closeRef.current?.focus()

    const focusableElements = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      .filter((element) => element.getClientRects().length > 0)
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusableElements()
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (!first) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const focused = document.activeElement
      if (!dialogRef.current?.contains(focused) || event.shiftKey && focused === first) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const keepFocusInside = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) closeRef.current?.focus()
    }
    document.addEventListener('keydown', keyDown, true)
    document.addEventListener('focusin', keepFocusInside)
    return () => {
      document.removeEventListener('keydown', keyDown, true)
      document.removeEventListener('focusin', keepFocusInside)
      html.style.overflow = previousStyles.htmlOverflow
      body.style.overflow = previousStyles.bodyOverflow
      html.style.overscrollBehavior = previousStyles.htmlOverscroll
      body.style.overscrollBehavior = previousStyles.bodyOverscroll
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const owner = getAuthToken()
    const key = JSON.stringify([selection.source, selection.accountId, date])
    const current = () => active && !controller.signal.aborted && owner === getAuthToken()
    setRequest({ key, owner, status: 'loading', details: null, error: '', canRetry: true })
    const stopAuth = subscribeAuthEvents(() => {
      if (!active || owner === getAuthToken()) return
      controller.abort()
      setRequest({
        key, owner: getAuthToken(), status: 'error', details: null,
        error: 'Your sign-in session changed. Close this window and open the day again.', canRetry: false,
      })
    })
    if (!owner) {
      setRequest({
        key, owner, status: 'error', details: null,
        error: 'Sign in to view daily statistics.', canRetry: false,
      })
    } else {
      void loadDashboardDayDetails({ source: selection.source, accountId: selection.accountId }, date, {
        signal: controller.signal,
        dateBasis: 'practice-session',
      }).then((details) => {
        if (current()) setRequest({ key, owner, status: 'ready', details, error: '', canRetry: true })
      }).catch((error: unknown) => {
        if (!current() || error instanceof Error && error.name === 'AbortError') return
        setRequest({
          key, owner, status: 'error', details: null,
          error: 'Daily statistics could not be loaded. Try again.', canRetry: true,
        })
      })
    }
    return () => {
      active = false
      controller.abort()
      stopAuth()
    }
  }, [selection.source, selection.accountId, date, attempt])

  const currentRequest = request.key === requestKey && request.owner === getAuthToken()
  const status = currentRequest ? request.status : 'loading'
  const details = currentRequest ? request.details : null
  const fallbackPnl = openedForOwner.current === getAuthToken() && known(calendarPnl) ? calendarPnl : null
  const netPnl = details?.netPnl ?? fallbackPnl
  const usingCalendarPnl = details?.netPnl == null && fallbackPnl != null
  const trades = details?.trades ?? []
  const retry = () => setAttempt((value) => value + 1)
  const empty = status === 'ready' && details?.detailsStatus === 'available' && details.totalTrades === 0
  const metrics = [
    { label: 'Closed trades', value: known(details?.totalTrades) ? amount.format(details.totalTrades) : '—' },
    { label: 'Win rate', value: known(details?.winRate) ? `${details.winRate.toFixed(1)}%` : '—' },
    { label: 'Fees', value: known(details?.totalFees) ? currency.format(details.totalFees) : '—' },
  ]

  return createPortal(
    <div className="calendar-day-details" data-theme={isDark ? 'dark' : 'light'}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close daily statistics"
        className="calendar-day-details__backdrop"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        aria-busy={status === 'loading'}
        tabIndex={-1}
        className="calendar-day-details__dialog"
      >
        <header className="calendar-day-details__header">
          <div>
            <p className="calendar-day-details__eyebrow"><CalendarDays aria-hidden />Trading day</p>
            <h2 id={headingId}>{dateTitle(date)}</h2>
            <p id={descriptionId} className="calendar-day-details__account">
              {accountName} <span aria-hidden>·</span> {selection.source === 'replay' ? 'Replay' : selection.source === 'tradesea' ? 'Tradesea' : 'Practice session'}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="calendar-day-details__close" aria-label="Close daily statistics">
            <X aria-hidden />
          </button>
        </header>

        <div className="calendar-day-details__body">
          <div className="calendar-day-details__summary">
            <div className="calendar-day-details__net">
              <span>Net P&amp;L{usingCalendarPnl ? <small>Calendar total</small> : null}</span>
              <strong className={pnlClass(netPnl)}>{known(netPnl) ? formatPnl(netPnl) : '—'}</strong>
            </div>
            {metrics.map((metric) => (
              <div className="calendar-day-details__metric" key={metric.label}>
                <span>{metric.label}</span><strong>{metric.value}</strong>
              </div>
            ))}
          </div>

          {status === 'loading' ? (
            <div className="calendar-day-details__state" role="status">
              <LoaderCircle className="calendar-day-details__spinner" aria-hidden />
              <p>Loading daily statistics…</p>
            </div>
          ) : status === 'error' ? (
            <div className="calendar-day-details__state" role="alert">
              <AlertCircle aria-hidden /><h3>Statistics unavailable</h3><p>{request.error}</p>
              {request.canRetry ? (
                <button type="button" onClick={retry} className="calendar-day-details__retry"><RefreshCw aria-hidden />Try again</button>
              ) : null}
            </div>
          ) : (
            <>
              {details?.detailsStatus !== 'available' ? (
                <div className="calendar-day-details__notice" role="status">
                  <AlertCircle aria-hidden />
                  <div>
                    <strong>{details?.detailsStatus === 'unavailable' ? 'Trade details unavailable' : 'Some details are unavailable'}</strong>
                    <p>{details?.message || 'The platform did not return complete trade details for this day.'}</p>
                  </div>
                  <button type="button" onClick={retry} aria-label="Retry daily statistics"><RefreshCw aria-hidden /></button>
                </div>
              ) : null}
              {empty ? (
                <div className="calendar-day-details__state">
                  <CalendarDays aria-hidden /><h3>No closed trades</h3><p>No closed trades were recorded for this day.</p>
                </div>
              ) : trades.length > 0 ? (
                <div className="calendar-day-details__trades">
                  <div className="calendar-day-details__trades-title"><h3>Closed trades</h3><span>{trades.length} returned</span></div>
                  <div className="calendar-day-details__table-wrap" role="region" tabIndex={0} aria-label="Daily closed trades">
                    <table>
                      <thead><tr>
                        <th scope="col">Closed</th><th scope="col">Trade</th><th scope="col">Size</th>
                        <th scope="col">Entry / exit</th><th scope="col">Fees</th><th scope="col">Net P&amp;L</th>
                      </tr></thead>
                      <tbody>{trades.map((trade) => (
                        <tr key={trade.id}>
                          <td><time dateTime={trade.exitTime ?? undefined}>{displayTime(trade.exitTime)}</time></td>
                          <td><strong>{trade.symbol || '—'}</strong><small>{trade.direction ? trade.direction === 'long' ? 'Long' : 'Short' : '—'}</small></td>
                          <td>{known(trade.contracts) ? amount.format(trade.contracts) : '—'}</td>
                          <td>{known(trade.entryPrice) ? amount.format(trade.entryPrice) : '—'}<small>{known(trade.exitPrice) ? amount.format(trade.exitPrice) : '—'}</small></td>
                          <td>{known(trade.fees) ? currency.format(trade.fees) : '—'}</td>
                          <td className={pnlClass(trade.netPnl)}>{known(trade.netPnl) ? formatPnl(trade.netPnl) : '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="calendar-day-details__footer">
          <span>{selection.source === 'practice' ? 'Practice sessions reset at 5:59 PM ET on weekdays.' : selection.source === 'replay' ? 'Replay results use each trade’s closing date in your local timezone.' : 'Dates follow the platform’s reported trading day.'}</span>
          <button type="button" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
