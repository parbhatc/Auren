import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { journalAPI, type JournalReview, type JournalReviewResponse } from '../../api/journal.api'
import { WorkspaceShell, PageHeading } from '../../components/layout/WorkspacePrimitives'
import { journalLocalDateTime } from '../../../shared/journalRecap.js'
import { handleApiError } from '../../utils/errorHandler'
import { journalMoney } from '../../journal/JournalAnalyticsPanel'

function periodStart(date: string, weekly: boolean) {
  if (!weekly || !date) return date
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7))
  return journalLocalDateTime(value).slice(0, 10)
}
export default function JournalReviewsPage() {
  const [kind, setKind] = useState<'daily' | 'weekly'>('daily'),
    [date, setDate] = useState(journalLocalDateTime().slice(0, 10))
  const [data, setData] = useState<JournalReviewResponse | null>(null),
    [draft, setDraft] = useState<JournalReview | null>(null)
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [reload, setReload] = useState(0)
  const [previousFocus, setPreviousFocus] = useState('')
  const start = periodStart(date, kind === 'weekly')
  const dirty = draft && data && JSON.stringify(draft) !== JSON.stringify(data.review)
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
      .getReview(kind, journalLocalDateTime(previous).slice(0, 10), controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setPreviousFocus(result.review.focusRule || '')
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
  const canLeave = () => !dirty || window.confirm('Discard unsaved review changes?')
  const input = 'w-full rounded-lg border border-zinc-500/30 bg-transparent p-3 text-sm'
  const update = (patch: Partial<JournalReview>) =>
    setDraft((value) => (value ? { ...value, ...patch } : value))
  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-5xl p-4 sm:p-8">
        <PageHeading
          eyebrow="Review your process"
          title="Daily & weekly reviews"
          description="Turn your actual journal evidence into one focus rule for the next session."
        />
        <Link
          to="/journal"
          onClick={(e) => {
            if (!canLeave()) e.preventDefault()
          }}
          className="text-sm text-blue-500"
        >
          ← Journal
        </Link>
        <div className="my-5 flex flex-wrap gap-3">
          <select
            aria-label="Review period"
            disabled={busy}
            className={input + ' !w-auto'}
            value={kind}
            onChange={(e) => {
              if (canLeave()) setKind(e.target.value as typeof kind)
            }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <input
            aria-label="Review date"
            disabled={busy}
            className={input + ' !w-auto'}
            type="date"
            value={date}
            onChange={(e) => {
              if (canLeave()) setDate(e.target.value)
            }}
          />
          <button
            disabled={busy}
            onClick={() => {
              if (canLeave()) setReload((n) => n + 1)
            }}
            className="text-blue-500"
          >
            Reload
          </button>
        </div>
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
          <p role="status" className="mb-4 text-blue-500">
            {notice}
          </p>
        )}
        {!data && !error && (
          <p role="status">{start ? 'Loading review…' : 'Choose a review date.'}</p>
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
            <fieldset disabled={busy} className="space-y-5">
              <p role="status" className="text-sm text-zinc-500">
                {dirty
                  ? 'Unsaved review — select Save review before leaving.'
                  : 'Reviews use explicit saving; recap draft autosave is separate.'}
              </p>
              <p className="rounded-xl border border-zinc-500/20 p-4 text-sm">
                {data.entries.length} recaps · {data.analytics.count} measured trades ·{' '}
                {journalMoney(data.analytics.count ? data.analytics.netPnl : null)} ·{' '}
                {data.analytics.missed} missed · {data.analytics.observations} observations ·{' '}
                {data.analytics.missingPnl} missing/gross P&L
              </p>
              {previousFocus && (
                <div className="rounded-lg bg-blue-500/10 p-3 text-sm">
                  <p>
                    Previous {kind === 'weekly' ? 'week' : 'day'} focus: {previousFocus}
                  </p>
                  <button
                    type="button"
                    onClick={() => update({ focusRule: previousFocus })}
                    className="mt-2 text-blue-500"
                  >
                    Carry this focus forward
                  </button>
                </div>
              )}
              <label className="block text-sm">
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
                <label key={field} className="block text-sm">
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
              <div>
                <h2 className="mb-2 font-semibold">Link evidence from this period</h2>
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
                          className="text-blue-500"
                        >
                          {entry.recap?.title || `${entry.symbol} · ${entry.playbook}`}
                        </Link>
                        <p>
                          {entry.dateTime} · {entry.recap?.execution || 'taken'} · {entry.outcome} ·{' '}
                          {entry.recap?.lesson}
                        </p>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">
                    No recaps in this period. You can still write a preparation/review note.
                  </p>
                )}
              </div>
              <button type="submit" className="rounded-lg bg-blue-600 px-5 py-3 text-white">
                {busy ? 'Saving…' : 'Save review'}
              </button>
            </fieldset>
          </form>
        )}
      </main>
    </WorkspaceShell>
  )
}
