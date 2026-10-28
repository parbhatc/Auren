import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Image,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { journalAPI, type JournalEntryRecord } from '../../api/journal.api'
import {
  WorkspaceShell,
  PageHeading,
  Surface,
} from '../../components/layout/WorkspacePrimitives'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { ROUTES } from '../../constants/routes'
import { useTheme } from '../../hooks/useTheme'
import {
  journalOutcomeLabel,
  journalSetupStages,
  playbookFromRecord,
  type Playbook,
} from '../../journal/journalConditions'
import {
  journalLocalDateTime,
  summarizeJournalEntry,
} from '../../../shared/journalRecap.js'
import { createJournalDraft } from '../../journal/journalCapture'

const JournalEntryEditor = lazy(
  () => import('../../journal/JournalEntryEditor')
)

const journalPrice = (value?: string) => {
  if (value == null || String(value).trim() === '') return '—'
  const price = Number(value)
  return Number.isFinite(price)
    ? price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}

const journalRiskReward = (entry: JournalEntryRecord) => {
  if (entry.riskPlan?.stopLoss?.mode === 'dynamic') return 'Close rule'
  const entryPrice = Number(entry.entryPrice)
  const stop = Number(
    entry.riskPlan?.stopLoss?.price || entry.sourceContext?.stopLossPrice
  )
  const target = Number(
    entry.riskPlan?.takeProfit?.price || entry.sourceContext?.takeProfitPrice
  )
  const risk = Math.abs(entryPrice - stop)
  const reward = Math.abs(target - entryPrice)
  return risk > 0 && Number.isFinite(reward)
    ? `${(reward / risk).toFixed(2)}R`
    : 'Plan'
}

const journalEntryTime = (value: string) => {
  const date = new Date(value)
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    ...(date.getSeconds() ? { second: '2-digit' as const } : {}),
  })
}

export default function JournalPage() {
  const { isDark } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [entries, setEntries] = useState<JournalEntryRecord[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<JournalEntryRecord | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<JournalEntryRecord | null>(
    null
  )
  const deletingRef = useRef(false)
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [outcome, setOutcome] = useState('all')
  const [playbook, setPlaybook] = useState('all')
  const [execution, setExecution] = useState('all')
  const [reload, setReload] = useState(0)
  const inputClass = `h-10 min-w-0 rounded-lg border px-3 text-sm outline-none focus:border-[var(--workspace-accent)] ${isDark ? 'border-[var(--app-border)] bg-[var(--app-panel)] text-[#FAFAFA]' : 'border-[var(--app-border)] bg-white text-[#09090B]'}`

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void journalAPI
      .listEntries(controller.signal)
      .then((records) => {
        if (!controller.signal.aborted) setEntries(records)
      })
      .catch((error) => {
        if (!controller.signal.aborted && error?.name !== 'AbortError')
          setError(
            'Journal entries could not be loaded. Try again when the server is available.'
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    void journalAPI
      .listStrategies(controller.signal)
      .then((records) => {
        if (!controller.signal.aborted)
          setPlaybooks(records.map(playbookFromRecord))
      })
      .catch((error) => {
        if (!controller.signal.aborted && error?.name !== 'AbortError')
          setError(
            'Your saved playbooks could not be loaded. Refresh to try again.'
          )
      })
    return () => controller.abort()
  }, [reload])

  useEffect(() => {
    if (!editId) return
    const controller = new AbortController()
    setEditLoading(true)
    setDraft(null)
    void journalAPI
      .getEntry(editId, controller.signal)
      .then((entry) => {
        if (!controller.signal.aborted) setDraft(entry)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'This entry could not be opened for editing. Your saved data has not changed.'
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setEditLoading(false)
      })
    return () => controller.abort()
  }, [editId])

  const closeEditor = () => {
    setDraft(null)
    if (editId)
      setSearchParams(
        (params) => {
          params.delete('edit')
          return params
        },
        { replace: true }
      )
  }
  const startNew = () => {
    const selectedPlaybook = playbooks[0]
    setDraft(
      createJournalDraft({
        strategyId: selectedPlaybook?.id ?? null,
        playbook: selectedPlaybook?.name ?? '',
        recap: {
          setupConditions: selectedPlaybook?.conditions ?? [],
          execution: 'taken',
          screenshots: [],
        },
      })
    )
  }
  const saveEntry = async (entry: JournalEntryRecord) => {
    const saved = entry.id
      ? await journalAPI.updateEntry(entry)
      : await journalAPI.createEntry(entry)
    const summary = summarizeJournalEntry(saved)
    setEntries((items) => [
      summary,
      ...items.filter((item) => item.id !== saved.id),
    ])
    closeEditor()
  }
  const deleteEntry = async () => {
    if (!pendingDelete || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    try {
      await journalAPI.deleteEntry(pendingDelete.id)
      setEntries((items) =>
        items.filter((item) => item.id !== pendingDelete.id)
      )
      setPendingDelete(null)
    } catch {
      setPendingDelete(null)
      setError('The entry could not be deleted. Please try again.')
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return entries
      .filter(
        (entry) =>
          (!month ||
            journalLocalDateTime(new Date(entry.dateTime)).startsWith(month)) &&
          (outcome === 'all' || entry.outcome === outcome) &&
          (playbook === 'all' || entry.playbook === playbook) &&
          (execution === 'all' ||
            (entry.recap?.execution ?? 'taken') === execution) &&
          (!query ||
            [
              entry.symbol,
              entry.source,
              entry.sourceContext?.sessionName,
              entry.playbook,
              entry.notes,
              entry.recap?.title,
              entry.recap?.lesson,
              ...(entry.recap?.mistakeTags ?? []),
              ...Object.values(entry.conditionResponses),
            ]
              .join(' ')
              .toLowerCase()
              .includes(query))
      )
      .sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime))
  }, [entries, search, month, outcome, playbook, execution])
  const days = useMemo(() => {
    const groups = new Map<string, JournalEntryRecord[]>()
    for (const entry of filtered) {
      const day = journalLocalDateTime(new Date(entry.dateTime)).slice(0, 10)
      const group = groups.get(day) ?? []
      group.push(entry)
      groups.set(day, group)
    }
    return [...groups]
  }, [filtered])

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 sm:py-9 xl:px-9">
        <PageHeading
          eyebrow="Your trading notebook"
          title="Trading journal"
          description="Save the setup. Find your patterns. Carry one lesson into the next session."
          actions={
            <>
              <Link
                to="/journal/reviews"
                className="inline-flex h-10 items-center rounded-xl border border-[var(--workspace-border)] px-4 text-xs font-medium text-[var(--workspace-accent)]"
              >
                Daily / weekly reviews
              </Link>
              <button
                type="button"
                disabled={editLoading}
                onClick={startNew}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--app-button)] !text-[var(--app-button-text)] px-4 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                New recap
              </button>
            </>
          }
        />
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setReload((value) => value + 1)}
              className="shrink-0 rounded-lg border border-red-500/30 px-3 py-2"
            >
              Retry
            </button>
          </div>
        )}
        {editLoading && (
          <p role="status" className="mb-4 text-sm text-[#71717A]">
            Opening complete entry and screenshots…
          </p>
        )}
        <Surface className="mb-7 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <label className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#71717A]" />
              <input
                aria-label="Search journal"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search setups, symbols, notes, mistakes…"
                className={`${inputClass} w-full pl-9`}
              />
            </label>
            <input
              aria-label="Filter journal month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className={inputClass}
            />
            <select
              aria-label="Filter journal outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              className={inputClass}
            >
              <option value="all">All results</option>
              <option value="planned">Planned / not closed</option>
              <option value="win">Wins</option>
              <option value="loss">Losses</option>
              <option value="breakeven">Breakeven</option>
            </select>
            <select
              aria-label="Filter journal playbook"
              value={playbook}
              onChange={(event) => setPlaybook(event.target.value)}
              className={inputClass}
            >
              <option value="all">All playbooks</option>
              {Array.from(new Set(entries.map((entry) => entry.playbook)))
                .sort()
                .map((name) => (
                  <option key={name}>{name}</option>
                ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              ['all', 'All entries'],
              ['taken', 'Taken'],
              ['missed', 'Missed'],
              ['observation', 'Observations'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={execution === value}
                onClick={() => setExecution(value)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${execution === value ? 'border-[var(--workspace-border)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]' : 'border-zinc-500/20 text-[#71717A]'}`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-xs text-[#71717A]">
              {filtered.length} {filtered.length === 1 ? 'recap' : 'recaps'}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setMonth('')
                setOutcome('all')
                setPlaybook('all')
                setExecution('all')
              }}
              className="text-xs text-[var(--workspace-accent)]"
            >
              Clear filters
            </button>
          </div>
        </Surface>
        {loading ? (
          <p role="status" className="py-16 text-center text-sm text-[#71717A]">
            Loading your journal…
          </p>
        ) : !filtered.length ? (
          <Surface className="p-10 text-center">
            <BookOpenCheck className="mx-auto mb-4 h-8 w-8 text-[var(--workspace-accent)]" />
            <h2
              className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}
            >
              {entries.length
                ? 'No recaps match these filters'
                : 'Start with your next setup'}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-[#71717A]">
              Choose one of your playbooks to review a setup. You can journal a
              missed setup without entering a trade.
            </p>
            <button
              type="button"
              onClick={startNew}
              className="mt-5 rounded-lg bg-[var(--app-button)] !text-[var(--app-button-text)] px-4 py-2 text-sm font-semibold text-white"
            >
              Write a recap
            </button>
          </Surface>
        ) : (
          <div className="space-y-7">
            {days.map(([day, dayEntries]) => (
              <section key={day} aria-label={`Recaps for ${day}`}>
                <div className="mb-3 flex items-center gap-3">
                  <h2
                    className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                  >
                    {new Date(`${day}T12:00`).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </h2>
                  <span className="rounded-full bg-[var(--workspace-accent-soft)] px-2 py-0.5 text-xs text-[var(--workspace-accent)]">
                    {dayEntries.length}
                  </span>
                </div>
                <div className="grid gap-4">
                  {dayEntries.map((entry) => (
                    <Surface
                      key={entry.id}
                      className="relative overflow-hidden p-0"
                    >
                      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--workspace-accent)]" />
                      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_310px]">
                        <div className="min-w-0 p-5 pl-6 sm:p-6 sm:pl-7">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#71717A]">
                                <span>{entry.symbol}</span>
                                <span>·</span>
                                <span>{entry.side}</span>
                                <span>·</span>
                                <span>{journalEntryTime(entry.dateTime)}</span>
                                {entry.recap?.session && (
                                  <>
                                    <span>·</span>
                                    <span>{entry.recap.session}</span>
                                  </>
                                )}
                              </div>
                              <Link
                                to={`${ROUTES.JOURNAL}/${encodeURIComponent(entry.id)}`}
                                className={`block break-words text-lg font-semibold leading-tight hover:text-[var(--workspace-accent)] ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                              >
                                {entry.recap?.title ||
                                  `${entry.symbol} · ${entry.playbook}`}
                              </Link>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${entry.outcome === 'win' ? 'border-emerald-500/30 bg-emerald-500/10 text-[var(--workspace-success)]' : entry.outcome === 'loss' ? 'border-red-500/30 bg-red-500/10 text-red-500' : 'border-zinc-500/20 bg-zinc-500/10 text-[#A1A1AA]'}`}
                            >
                              {journalOutcomeLabel(entry)}
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            {journalSetupStages(entry).map((stage, index) => (
                              <div
                                key={stage}
                                className="flex items-center gap-2"
                              >
                                <span
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${index === 1 ? 'border-[var(--workspace-border)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]' : index === 2 ? 'border-zinc-500/30 bg-zinc-500/10 text-[var(--workspace-accent)]' : 'border-[var(--workspace-border)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]'}`}
                                >
                                  {index + 1}. {stage}
                                </span>
                                {index <
                                  journalSetupStages(entry).length - 1 && (
                                  <ArrowRight className="h-3.5 w-3.5 text-[#52525B]" />
                                )}
                              </div>
                            ))}
                          </div>

                          {entry.recap?.pros?.length ||
                          entry.recap?.cons?.length ? (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--workspace-success)]">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Pros
                                </div>
                                <ul
                                  className={`mt-2 space-y-1.5 text-xs leading-5 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                                >
                                  {(entry.recap?.pros ?? [])
                                    .slice(0, 3)
                                    .map((item) => (
                                      <li key={item} className="flex gap-2">
                                        <span className="text-[var(--workspace-success)]">
                                          +
                                        </span>
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                </ul>
                              </div>
                              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
                                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--workspace-warning)]">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Cons
                                </div>
                                <ul
                                  className={`mt-2 space-y-1.5 text-xs leading-5 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                                >
                                  {(entry.recap?.cons ?? [])
                                    .slice(0, 4)
                                    .map((item) => (
                                      <li key={item} className="flex gap-2">
                                        <span className="text-[var(--workspace-warning)]">
                                          −
                                        </span>
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            </div>
                          ) : (
                            <p
                              className={`mt-4 max-w-4xl text-sm leading-6 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                            >
                              {entry.recap?.lesson ||
                                entry.notes ||
                                'Open this recap to review the setup sequence and chart evidence.'}
                            </p>
                          )}

                          <div className="mt-5 flex flex-wrap items-center gap-2">
                            {entry.recap?.execution && (
                              <span className="rounded-md bg-zinc-500/10 px-2 py-1 text-[11px] font-medium capitalize text-[#A1A1AA]">
                                {entry.recap.execution}
                              </span>
                            )}
                            {(entry.recap?.screenshotCount ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-500/10 px-2 py-1 text-[11px] font-medium text-[#A1A1AA]">
                                <Image className="h-3.5 w-3.5" />
                                {entry.recap?.screenshotCount}{' '}
                                {entry.recap?.screenshotCount === 1
                                  ? 'chart'
                                  : 'charts'}
                              </span>
                            )}
                            {entry.source && entry.source !== 'manual' && (
                              <span className="rounded-md bg-zinc-500/10 px-2 py-1 text-[11px] font-medium capitalize text-[#A1A1AA]">
                                {entry.source} capture
                              </span>
                            )}
                            <span
                              className={`ml-auto text-sm font-semibold tabular-nums ${Number(entry.pnl) < 0 ? 'text-[var(--workspace-danger)]' : Number(entry.pnl) > 0 ? 'text-[var(--workspace-success)]' : 'text-zinc-500'}`}
                            >
                              {entry.pnl.trim() &&
                              Number.isFinite(Number(entry.pnl))
                                ? `${Number(entry.pnl) < 0 ? '-' : ''}$${Math.abs(Number(entry.pnl)).toLocaleString()}`
                                : ''}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`flex flex-col border-t p-5 xl:border-l xl:border-t-0 ${isDark ? 'border-[var(--app-border)] bg-[var(--app-inset)]' : 'border-[var(--app-border)] bg-[var(--app-inset)]'}`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#71717A]">
                              Trade map
                            </p>
                            <span className="rounded-md bg-[var(--workspace-accent-soft)] px-2 py-1 text-xs font-semibold text-[var(--workspace-accent)]">
                              {journalRiskReward(entry)}
                            </span>
                          </div>
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between rounded-lg border border-zinc-500/20 bg-zinc-500/5 px-3 py-2">
                              <span className="text-[11px] text-[var(--workspace-accent)]">
                                Target
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-[var(--workspace-accent)]">
                                {journalPrice(
                                  entry.riskPlan?.takeProfit?.price ||
                                    entry.sourceContext?.takeProfitPrice
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-accent-soft)] px-3 py-2">
                              <span className="text-[11px] text-[var(--workspace-accent)]">
                                Entry
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-[var(--workspace-accent)]">
                                {journalPrice(entry.entryPrice)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                              <span className="text-[11px] text-red-400">
                                Stop
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-red-400">
                                {entry.riskPlan?.stopLoss?.mode === 'dynamic'
                                  ? 'Close rule'
                                  : journalPrice(
                                      entry.riskPlan?.stopLoss?.price ||
                                        entry.sourceContext?.stopLossPrice
                                    )}
                              </span>
                            </div>
                          </div>
                          <div className="mt-auto flex items-center gap-2 pt-4">
                            <Link
                              to={`${ROUTES.JOURNAL}/${encodeURIComponent(entry.id)}`}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--app-button)] !text-[var(--app-button-text)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--workspace-accent)]"
                            >
                              View setup <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              type="button"
                              disabled={editLoading}
                              onClick={() =>
                                setSearchParams({ edit: entry.id })
                              }
                              className="rounded-lg border border-zinc-500/20 px-3 py-2 text-xs text-[#A1A1AA] hover:text-[var(--workspace-accent)]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${entry.symbol} journal entry`}
                              onClick={() => setPendingDelete(entry)}
                              className="rounded-lg p-2 text-[#71717A] hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Surface>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {draft && (
          <Suspense
            fallback={
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
                role="status"
              >
                <p className="rounded-lg bg-zinc-900 px-5 py-4 text-sm text-white">
                  Opening journal editor…
                </p>
              </div>
            }
          >
            <JournalEntryEditor
              key={draft.id || 'new'}
              initialEntry={draft}
              playbooks={playbooks}
              isDark={isDark}
              onSave={saveEntry}
              onClose={closeEditor}
            />
          </Suspense>
        )}
        <ConfirmDialog
          isOpen={!!pendingDelete}
          title="Delete this recap?"
          message="This permanently removes the saved entry and its screenshots."
          confirmText={deleting ? 'Deleting…' : 'Delete recap'}
          onConfirm={() => void deleteEntry()}
          onCancel={() => {
            if (!deleting) setPendingDelete(null)
          }}
          isDark={isDark}
        />
      </main>
    </WorkspaceShell>
  )
}
