import JournalScreenshotView from '../../journal/JournalScreenshotView'
import { useEffect, useState } from 'react'
import { BookOpenCheck, ChevronLeft, LineChart, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { journalAPI, type JournalEntryRecord as ManualJournalEntry } from '../../api/journal.api'
import { ROUTES } from '../../constants/routes'
import { useTheme } from '../../hooks/useTheme'
import { WorkspaceShell, PageHeading, Surface } from '../../components/layout/WorkspacePrimitives'
import {
  conditionsForJournalEntry,
  formatConditionResponse,
  formatRiskLeg,
} from '../../journal/journalConditions'
import JournalReviewChart from '../../journal/JournalReviewChart'

export default function JournalTradeDetailPage() {
  const { tradeId } = useParams<{ tradeId: string }>()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [entry, setEntry] = useState<ManualJournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    if (!tradeId) {
      setError('This journal trade link is incomplete.')
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    setError('')
    setEntry(null)
    void journalAPI
      .getEntry(tradeId, controller.signal)
      .then((record) => {
        if (!cancelled) setEntry(record)
      })
      .catch(() => {
        if (!cancelled)
          setError('This journal trade could not be found or you do not have access to it.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [tradeId])

  const outcomeColor =
    entry?.outcome === 'win'
      ? 'text-emerald-500'
      : entry?.outcome === 'loss'
        ? 'text-red-500'
        : 'text-[#A1A1AA]'

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={() => navigate('/journal')}
          className={`mb-5 inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${isDark ? 'border-[#3F3F46] text-[#D4D4D8] hover:bg-[#27272A]' : 'border-[#E4E4E7] text-[#3F3F46] hover:bg-[#F4F4F5]'}`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to journal
        </button>

        {loading && (
          <Surface className="flex min-h-72 items-center justify-center p-8 text-sm text-[#71717A]">
            Loading trade review…
          </Surface>
        )}
        {!loading && error && (
          <Surface className="p-8 text-center">
            <p className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
              Trade review unavailable
            </p>
            <p className="mt-2 text-xs text-[#71717A]">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/journal')}
              className={`mt-5 h-9 rounded-lg px-4 text-xs font-semibold ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}
            >
              Return to journal
            </button>
          </Surface>
        )}

        {!loading && entry && (
          <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <PageHeading
                eyebrow="Journal trade review"
                title={`${entry.symbol} setup evidence`}
                description={`${entry.playbook} · ${new Date(entry.dateTime).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`${ROUTES.JOURNAL}?edit=${encodeURIComponent(entry.id)}`}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  Edit recap
                </Link>
                {entry.source && entry.source !== 'manual' && (
                  <span className="inline-flex rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-500">
                    {entry.source} capture
                  </span>
                )}
                {entry.source === 'replay' && entry.sourceSessionId && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `${ROUTES.BACKTESTER_CHART}?sessionId=${encodeURIComponent(entry.sourceSessionId || '')}`
                      )
                    }
                    className={`inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium ${isDark ? 'border-[#3F3F46] text-[#D4D4D8] hover:bg-[#27272A]' : 'border-[#E4E4E7] text-[#3F3F46] hover:bg-[#F4F4F5]'}`}
                  >
                    Open replay
                  </button>
                )}
                <div
                  className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${entry.outcome === 'win' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : entry.outcome === 'loss' ? 'border-red-500/30 bg-red-500/10 text-red-500' : isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#E4E4E7] text-[#52525B]'}`}
                >
                  {entry.outcome === 'breakeven' ? 'Breakeven' : entry.outcome}
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {[
                [
                  'Entry',
                  entry.entryPrice
                    ? `$${Number(entry.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : '—',
                ],
                [
                  'Close',
                  entry.closePrice
                    ? `$${Number(entry.closePrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : '—',
                ],
                [
                  entry.sourceContext?.pnlBasis === 'gross' ? 'Gross P&L' : 'Net P&L',
                  entry.pnl
                    ? `${Number(entry.pnl) >= 0 ? '+' : '-'}$${Math.abs(Number(entry.pnl)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : '—',
                ],
                ['Size', entry.size || '—'],
                ['Side', entry.side],
                [
                  'Duration',
                  entry.exitDateTime
                    ? `${Math.max(0, Math.round((new Date(entry.exitDateTime).getTime() - new Date(entry.dateTime).getTime()) / 60000))} min`
                    : '—',
                ],
              ].map(([label, value]) => (
                <Surface key={label} className="p-3 sm:p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#71717A]">
                    {label}
                  </p>
                  <p
                    className={`mt-1.5 truncate text-sm font-semibold capitalize ${label.endsWith('P&L') ? outcomeColor : isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                  >
                    {value}
                  </p>
                </Surface>
              ))}
            </div>

            {entry.recap && (
              <Surface className="mb-4 p-4 sm:p-5">
                <h2
                  className={`text-base font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}
                >
                  {entry.recap.title || 'Session recap'}
                </h2>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#71717A]">
                  {entry.recap.session && <span>{entry.recap.session}</span>}
                  {entry.recap.execution && (
                    <span className="capitalize">{entry.recap.execution}</span>
                  )}
                  {entry.recap.grade && <span>Process grade: {entry.recap.grade}</span>}
                  {(entry.recap.mistakeTags ?? []).map((tag) => (
                    <span key={tag} className="text-amber-500">
                      {tag}
                    </span>
                  ))}
                </div>
                {entry.recap.lesson && (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold text-blue-500">Lesson for next session</h3>
                    <p
                      className={`mt-2 whitespace-pre-line text-sm leading-6 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                    >
                      {entry.recap.lesson}
                    </p>
                  </div>
                )}
                {!!entry.recap.screenshots?.length && (
                  <div className="mt-5 space-y-4">
                    {entry.recap.screenshots.map((image, index) => (
                      <figure key={image.id}>
                        <JournalScreenshotView image={image} />
                        <figcaption className="mt-2 text-xs text-[#71717A]">
                          {image.caption || `Chart ${index + 1}`}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </Surface>
            )}

            <Surface className="p-2 sm:p-4">
              <JournalReviewChart entry={entry} isDark={isDark} />
              <p className="px-2 pb-1 pt-3 text-[10px] leading-4 text-[#71717A]">
                Drag to pan and scroll to zoom. BWC-native boxes mark the saved HTF PDA and IFVG
                zones; bounded level segments connect each source high or low to its sweep.
              </p>
            </Surface>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
              <Surface className="p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="h-4 w-4 text-blue-500" />
                  <h2
                    className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                  >
                    Setup details
                  </h2>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {conditionsForJournalEntry(entry).map(({ label }) => (
                    <div
                      key={label}
                      className={`rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#71717A]">
                        {label}
                      </p>
                      <p
                        className={`mt-2 whitespace-pre-line text-xs leading-5 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                      >
                        {formatConditionResponse(label, entry.conditionResponses[label] ?? '')}
                      </p>
                    </div>
                  ))}
                </div>
              </Surface>
              <Surface className="p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-blue-500" />
                  <h2
                    className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                  >
                    Execution notes
                  </h2>
                </div>
                <p
                  className={`mt-4 whitespace-pre-line text-xs leading-6 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                >
                  {entry.notes || 'No notes recorded.'}
                </p>
                {entry.riskPlan && (
                  <div
                    className={`mt-5 border-t pt-4 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                      <h3
                        className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                      >
                        Risk and exit plan
                      </h3>
                    </div>
                    <div className="mt-3 space-y-2 text-[11px]">
                      <div className="flex justify-between gap-3">
                        <span className="text-[#71717A]">Stop loss</span>
                        <span
                          className={`text-right ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                        >
                          {formatRiskLeg(entry.riskPlan.stopLoss)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#71717A]">Breakeven</span>
                        <span
                          className={`text-right ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                        >
                          {entry.riskPlan.breakEven?.enabled
                            ? formatRiskLeg(entry.riskPlan.breakEven)
                            : 'Not used'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#71717A]">Take profit</span>
                        <span
                          className={`text-right ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                        >
                          {formatRiskLeg(entry.riskPlan.takeProfit)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {entry.source && entry.source !== 'manual' && (
                  <div
                    className={`mt-5 border-t pt-4 text-[11px] ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="text-[#71717A]">Captured from</span>
                      <span className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}>
                        {entry.sourceContext?.sessionName || entry.sourceSessionId || entry.source}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between gap-3">
                      <span className="text-[#71717A]">Chart context</span>
                      <span className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}>
                        {entry.sourceContext?.chartResolution || '—'} ·{' '}
                        {entry.sourceContext?.snapshotKind?.replace('_', ' ') || 'cursor'}
                      </span>
                    </div>
                  </div>
                )}
                <div
                  className={`mt-5 border-t pt-4 text-[11px] ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}
                >
                  <div className="flex justify-between gap-3">
                    <span className="text-[#71717A]">Entry time</span>
                    <span className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}>
                      {new Date(entry.dateTime).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="text-[#71717A]">Exit time</span>
                    <span className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}>
                      {entry.exitDateTime
                        ? new Date(entry.exitDateTime).toLocaleString()
                        : 'Not recorded'}
                    </span>
                  </div>
                </div>
              </Surface>
            </div>
          </>
        )}
      </main>
    </WorkspaceShell>
  )
}
