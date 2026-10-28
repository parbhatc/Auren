import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  journalAPI,
  type JournalReview,
  type JournalReviewResponse,
} from '../../api/journal.api'
import {
  WorkspaceShell,
  PageHeading,
  Surface,
} from '../../components/layout/WorkspacePrimitives'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { journalLocalDateTime } from '../../../shared/journalRecap.js'
import { handleApiError } from '../../utils/errorHandler'
import { journalMoney } from '../../journal/journalFormat'
import { useTheme } from '../../hooks/useTheme'
import { journalOutcomeLabel } from '../../journal/journalConditions'

type PendingReviewChange =
  | { type: 'journal' }
  | { type: 'kind'; value: 'daily' | 'weekly' }
  | { type: 'date'; value: string }
  | { type: 'reload' }

function periodStart(date: string, weekly: boolean) {
  if (!weekly || !date) return date
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7))
  return journalLocalDateTime(value).slice(0, 10)
}
export default function JournalReviewsPage() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [kind, setKind] = useState<'daily' | 'weekly'>('daily'),
    [date, setDate] = useState(journalLocalDateTime().slice(0, 10))
  const [data, setData] = useState<JournalReviewResponse | null>(null),
    [draft, setDraft] = useState<JournalReview | null>(null)
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [reload, setReload] = useState(0)
  const [previousFocus, setPreviousFocus] = useState('')
  const [pendingChange, setPendingChange] =
    useState<PendingReviewChange | null>(null)
  const start = periodStart(date, kind === 'weekly')
  const dirty =
    draft && data && JSON.stringify(draft) !== JSON.stringify(data.review)
  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setDraft(null)
    setError('')
    setNotice('')
    setPreviousFocus('')
    if (!start) return
    void journalAPI
      .getReview(kind, start, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result)
          setDraft(result.review)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(handleApiError(e))
      })
    const previous = new Date(`${start}T12:00:00`)
    previous.setDate(previous.getDate() - (kind === 'weekly' ? 7 : 1))
    void journalAPI
      .getReview(
        kind,
        journalLocalDateTime(previous).slice(0, 10),
        controller.signal
      )
      .then((result) => {
        if (!controller.signal.aborted)
          setPreviousFocus(result.review.focusRule || '')
      })
      .catch(() => {})
    return () => controller.abort()
  }, [kind, start, reload])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const applyChange = (change: PendingReviewChange) => {
    if (change.type === 'journal') navigate('/journal')
    else if (change.type === 'kind') setKind(change.value)
    else if (change.type === 'date') setDate(change.value)
    else setReload((value) => value + 1)
  }
  const requestChange = (change: PendingReviewChange) => {
    if (dirty) setPendingChange(change)
    else applyChange(change)
  }
  const input = `mt-2 w-full rounded-xl border p-3 text-sm font-normal outline-none focus:border-zinc-400 ${isDark ? 'border-[var(--app-border)] bg-[var(--app-inset)] text-[#F4F4F5]' : 'border-[var(--app-border)] bg-[var(--app-inset)] text-[#18181B]'}`
  const update = (patch: Partial<JournalReview>) =>
    setDraft((value) => (value ? { ...value, ...patch } : value))
  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 sm:py-9 xl:px-9">
        <PageHeading
          eyebrow="Review your process"
          title="Daily & weekly reviews"
          description="Turn your actual journal evidence into one focus rule for the next session."
        />
        <Link
          to="/journal"
          onClick={(e) => {
            if (!dirty) return
            e.preventDefault()
            setPendingChange({ type: 'journal' })
          }}
          className="text-sm text-[var(--workspace-accent)]"
        >
          ← Journal
        </Link>
        <Surface className="my-5 flex flex-wrap items-center gap-3 p-4 sm:p-5">
          <select
            aria-label="Review period"
            disabled={busy}
            className={input + ' !mt-0 !w-auto'}
            value={kind}
            onChange={(e) => {
              requestChange({
                type: 'kind',
                value: e.target.value as typeof kind,
              })
            }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <input
            aria-label="Review date"
            disabled={busy}
            className={input + ' !mt-0 !w-auto'}
            type="date"
            value={date}
            onChange={(e) => {
              requestChange({ type: 'date', value: e.target.value })
            }}
          />
          <button
            disabled={busy}
            onClick={() => {
              requestChange({ type: 'reload' })
            }}
            className="ml-auto rounded-xl border border-[var(--workspace-border)] px-4 py-3 text-xs font-medium text-[var(--workspace-text)]"
          >
            Reload
          </button>
        </Surface>
        {kind === 'weekly' && (
          <p className="mb-3 text-sm text-zinc-500">
            Week beginning Monday {start}; dates use the recorded journal day.
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 text-red-500">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-4 text-[var(--workspace-success)]">
            {notice}
          </p>
        )}
        {!data && !error && (
          <p role="status">
            {start ? 'Loading review…' : 'Choose a review date.'}
          </p>
        )}
        {data && draft && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (busy) return
              setBusy(true)
              setError('')
              try {
                const review = await journalAPI.saveReview(draft)
                setDraft(review)
                setData({ ...data, review })
                setNotice('Review saved')
              } catch (e) {
                setError(handleApiError(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            <fieldset
              disabled={busy}
              className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.65fr)]"
            >
              <p role="status" className="text-xs text-zinc-500 lg:col-span-2">
                {dirty
                  ? 'Unsaved review — select Save review before leaving.'
                  : 'Reviews use explicit saving; recap draft autosave is separate.'}
              </p>
              <Surface className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 sm:p-6 lg:col-span-2 xl:grid-cols-6">
                {[
                  ['Recaps', data.entries.length],
                  ['Measured trades', data.analytics.count],
                  [
                    'Net P&L',
                    journalMoney(
                      data.analytics.count ? data.analytics.netPnl : null
                    ),
                  ],
                  ['Missed setups', data.analytics.missed],
                  ['Observations', data.analytics.observations],
                  ['Missing / gross P&L', data.analytics.missingPnl],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] text-[var(--workspace-muted)]">
                      {label}
                    </p>
                    <p
                      className={`mt-2 text-xl font-semibold tabular-nums tracking-tight ${label === 'Net P&L' && data.analytics.netPnl > 0 ? 'text-[var(--workspace-success)]' : label === 'Net P&L' && data.analytics.netPnl < 0 ? 'text-[var(--workspace-danger)]' : 'text-[var(--workspace-text)]'}`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </Surface>
              <Surface className="space-y-5 p-5 sm:p-6">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--workspace-text)]">
                    Reflect on your process
                  </h2>
                  <p className="mt-1.5 text-xs text-[var(--workspace-muted)]">
                    Use the evidence to choose one clear improvement.
                  </p>
                </div>
                {previousFocus && (
                  <div className="rounded-lg bg-[var(--workspace-accent-soft)] p-3 text-sm">
                    <p>
                      Previous {kind === 'weekly' ? 'week' : 'day'} focus:{' '}
                      {previousFocus}
                    </p>
                    <button
                      type="button"
                      onClick={() => update({ focusRule: previousFocus })}
                      className="mt-2 text-[var(--workspace-accent)]"
                    >
                      Carry this focus forward
                    </button>
                  </div>
                )}
                <label className="block text-xs font-medium text-[var(--workspace-text)]">
                  Did you follow your rules?
                  <select
                    aria-label="Review rule adherence"
                    value={draft.followedRules ?? ''}
                    onChange={(e) => update({ followedRules: e.target.value })}
                    className={input}
                  >
                    <option value="">Not reviewed</option>
                    <option value="yes">Yes</option>
                    <option value="mixed">Mixed</option>
                    <option value="no">No</option>
                  </select>
                </label>
                {(
                  [
                    ['bestExecution', 'Best execution'],
                    ['mistake', 'Recurring mistake'],
                    ['focusRule', 'Next focus rule'],
                    ['notes', 'Review notes'],
                  ] as const
                ).map(([field, label]) => (
                  <label
                    key={field}
                    className="block text-xs font-medium text-[var(--workspace-text)]"
                  >
                    {label}
                    <textarea
                      aria-label={label}
                      maxLength={8000}
                      rows={3}
                      className={input}
                      value={draft[field] ?? ''}
                      onChange={(e) => update({ [field]: e.target.value })}
                    />
                  </label>
                ))}
              </Surface>
              <Surface className="p-5 sm:p-6">
                <h2 className="mb-2 text-sm font-semibold text-[var(--workspace-text)]">
                  Evidence from this period
                </h2>
                <p className="mb-4 text-xs leading-5 text-[var(--workspace-muted)]">
                  Link the recaps that support your review.
                </p>
                {data.entries.length ? (
                  data.entries.map((entry) => (
                    <label
                      key={entry.id}
                      className="flex items-start gap-3 border-t border-zinc-500/20 py-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Link ${entry.recap?.title || entry.symbol} ${entry.id}`}
                        checked={draft.entryIds?.includes(entry.id) ?? false}
                        onChange={(e) =>
                          update({
                            entryIds: e.target.checked
                              ? [...(draft.entryIds ?? []), entry.id]
                              : draft.entryIds?.filter((id) => id !== entry.id),
                          })
                        }
                      />
                      <span>
                        <Link
                          to={`/journal/${encodeURIComponent(entry.id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--workspace-accent)]"
                        >
                          {entry.recap?.title ||
                            `${entry.symbol} · ${entry.playbook}`}
                        </Link>
                        <p>
                          {entry.dateTime} · {entry.recap?.execution || 'taken'}{' '}
                          · {journalOutcomeLabel(entry)} · {entry.recap?.lesson}
                        </p>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">
                    No recaps in this period. You can still write a
                    preparation/review note.
                  </p>
                )}
              </Surface>
              <button
                type="submit"
                className={`justify-self-start rounded-xl px-5 py-3 text-xs font-semibold ${isDark ? 'bg-[var(--app-button)] text-[var(--app-button-text)]' : 'bg-[var(--app-button)] text-[var(--app-button-text)]'}`}
              >
                {busy ? 'Saving…' : 'Save review'}
              </button>
            </fieldset>
          </form>
        )}
      </main>
      <ConfirmDialog
        isOpen={Boolean(pendingChange)}
        title="Discard unsaved review changes?"
        message="Your changes to this review have not been saved. Continuing will discard them."
        confirmText="Discard changes"
        cancelText="Keep editing"
        variant="warning"
        isDark={isDark}
        onConfirm={() => {
          const change = pendingChange
          setPendingChange(null)
          if (change) applyChange(change)
        }}
        onCancel={() => setPendingChange(null)}
      />
    </WorkspaceShell>
  )
}
