import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpenCheck, Image, Plus, Search, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { journalAPI, type JournalEntryRecord } from '../../api/journal.api'
import { WorkspaceShell, PageHeading, Surface } from '../../components/layout/WorkspacePrimitives'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { ROUTES } from '../../constants/routes'
import { useTheme } from '../../hooks/useTheme'
import JournalEntryEditor from '../../journal/JournalEntryEditor'
import { playbookFromRecord, type Playbook } from '../../journal/journalConditions'
import { JOURNAL_TEMPLATES } from '../../journal/journalTemplates'
import { journalLocalDateTime, summarizeJournalEntry } from '../../../shared/journalRecap.js'
import { createJournalDraft } from '../../journal/journalCapture'

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
  const [pendingDelete, setPendingDelete] = useState<JournalEntryRecord | null>(null)
  const deletingRef = useRef(false)
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [outcome, setOutcome] = useState('all')
  const [playbook, setPlaybook] = useState('all')
  const [execution, setExecution] = useState('all')
  const [reload, setReload] = useState(0)
  const inputClass = `h-10 min-w-0 rounded-lg border px-3 text-sm outline-none focus:border-blue-500 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void journalAPI
      .listEntries(controller.signal)
      .then((records) => {
        if (!controller.signal.aborted) setEntries(records)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Journal entries could not be loaded. Try again when the server is available.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    void journalAPI
      .listStrategies(controller.signal)
      .then((records) => {
        if (!controller.signal.aborted) setPlaybooks(records.map(playbookFromRecord))
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'Your saved playbooks could not be loaded. Built-in recap templates are still available.'
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
          setError('This entry could not be opened for editing. Your saved data has not changed.')
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
    const template = playbooks[0] ?? JOURNAL_TEMPLATES[0]
    setDraft(
      createJournalDraft({
        strategyId: playbooks[0]?.id ?? null,
        playbook: template.name,
        recap: { setupConditions: template.conditions, execution: 'taken', screenshots: [] },
      })
    )
  }
  const saveEntry = async (entry: JournalEntryRecord) => {
    const saved = entry.id
      ? await journalAPI.updateEntry(entry)
      : await journalAPI.createEntry(entry)
    const summary = summarizeJournalEntry(saved)
    setEntries((items) => [summary, ...items.filter((item) => item.id !== saved.id)])
    closeEditor()
  }
  const deleteEntry = async () => {
    if (!pendingDelete || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    try {
      await journalAPI.deleteEntry(pendingDelete.id)
      setEntries((items) => items.filter((item) => item.id !== pendingDelete.id))
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
          (!month || journalLocalDateTime(new Date(entry.dateTime)).startsWith(month)) &&
          (outcome === 'all' || entry.outcome === outcome) &&
          (playbook === 'all' || entry.playbook === playbook) &&
          (execution === 'all' || (entry.recap?.execution ?? 'taken') === execution) &&
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
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <PageHeading
            eyebrow="Your trading notebook"
            title="A clear recap for every setup"
            description="Save the chart, record your confirmations, and carry one lesson into the next session."
          />
          <Link
            to="/journal/reviews"
            className="rounded-lg border border-blue-500/30 px-3 py-2 text-sm text-blue-500"
          >
            Daily / weekly reviews
          </Link>
          <button
            type="button"
            disabled={editLoading}
            onClick={startNew}
            className="mb-5 inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New recap
          </button>
        </div>
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
        <Surface className="mb-6 p-4">
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
                className={`rounded-lg border px-3 py-1.5 text-xs ${execution === value ? 'border-blue-500/40 bg-blue-500/10 text-blue-500' : 'border-zinc-500/20 text-[#71717A]'}`}
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
              className="text-xs text-blue-500"
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
            <BookOpenCheck className="mx-auto mb-4 h-8 w-8 text-blue-500" />
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              {entries.length ? 'No recaps match these filters' : 'Start with your next setup'}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-[#71717A]">
              Choose a sweep / FVG / IFVG template or your own playbook. You can journal a missed
              setup without entering a trade.
            </p>
            <button
              type="button"
              onClick={startNew}
              className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
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
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-500">
                    {dayEntries.length}
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {dayEntries.map((entry) => (
                    <Surface key={entry.id} className="flex flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to={`${ROUTES.JOURNAL}/${encodeURIComponent(entry.id)}`}
                            className={`block break-words text-base font-semibold hover:text-blue-500 ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                          >
                            {entry.recap?.title || `${entry.symbol} · ${entry.playbook}`}
                          </Link>
                          <p className="mt-1 text-xs text-[#71717A]">
                            {new Date(entry.dateTime).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}{' '}
                            · {entry.symbol} · {entry.side}
                            {entry.recap?.session ? ` · ${entry.recap.session}` : ''}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold capitalize ${entry.outcome === 'win' ? 'bg-emerald-500/10 text-emerald-500' : entry.outcome === 'loss' ? 'bg-red-500/10 text-red-500' : 'bg-zinc-500/10 text-[#71717A]'}`}
                        >
                          {entry.outcome}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-[#71717A]">{entry.playbook}</p>
                      <p
                        className={`mt-2 line-clamp-2 text-sm leading-6 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}
                      >
                        {entry.recap?.lesson ||
                          entry.notes ||
                          'Open this recap to review setup confirmations and chart evidence.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#71717A]">
                        {entry.recap?.grade && <span>Process {entry.recap.grade}</span>}
                        {entry.recap?.execution && entry.recap.execution !== 'taken' && (
                          <span className="capitalize">{entry.recap.execution}</span>
                        )}
                        {(entry.recap?.screenshotCount ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Image className="h-3.5 w-3.5" />
                            {entry.recap?.screenshotCount} charts
                          </span>
                        )}
                        {entry.source && entry.source !== 'manual' && (
                          <span className="capitalize">{entry.source}</span>
                        )}
                        {(entry.recap?.mistakeTags ?? []).map((tag) => (
                          <span key={tag} className="text-amber-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="mt-auto flex items-center gap-2 pt-4">
                        <span
                          className={`mr-auto text-sm font-semibold tabular-nums ${Number(entry.pnl) < 0 ? 'text-red-500' : 'text-emerald-500'}`}
                        >
                          {entry.pnl.trim() && Number.isFinite(Number(entry.pnl))
                            ? `${Number(entry.pnl) < 0 ? '-' : ''}$${Math.abs(Number(entry.pnl)).toLocaleString()}`
                            : ''}
                        </span>
                        <Link
                          to={`${ROUTES.JOURNAL}/${encodeURIComponent(entry.id)}`}
                          className="rounded-lg border border-zinc-500/20 px-3 py-2 text-xs text-[#71717A]"
                        >
                          Review
                        </Link>
                        <button
                          type="button"
                          disabled={editLoading}
                          onClick={() => setSearchParams({ edit: entry.id })}
                          className="rounded-lg bg-blue-500/10 px-3 py-2 text-xs text-blue-500"
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
                    </Surface>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {draft && (
          <JournalEntryEditor
            key={draft.id || 'new'}
            initialEntry={draft}
            playbooks={playbooks}
            isDark={isDark}
            onSave={saveEntry}
            onClose={closeEditor}
          />
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
