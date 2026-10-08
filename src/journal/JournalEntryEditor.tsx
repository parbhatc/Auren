import { useEffect, useRef, useState } from 'react'
import type { JournalEntryRecord, JournalRecap, JournalScreenshot } from '../api/journal.api'
import { normalizeJournalRecap, validateJournalEntry } from '../../shared/journalRecap.js'
import { conditionsForJournalEntry, type Playbook } from './journalConditions'
import JournalConditionFields from './JournalConditionFields'
import JournalRecapFields from './JournalRecapFields'
import { handleApiError } from '../utils/errorHandler'
import { useJournalDraft } from './useJournalDraft'
import JournalExecutionUpdate from './JournalExecutionUpdate'
import ConfirmDialog from '../components/common/ConfirmDialog'

type Props = {
  initialEntry: JournalEntryRecord
  playbooks: Playbook[]
  isDark: boolean
  onSave: (entry: JournalEntryRecord) => Promise<void>
  onClose: () => void
  captureChart?: () => Promise<JournalScreenshot>
}

export default function JournalEntryEditor({
  initialEntry,
  playbooks,
  isDark,
  onSave,
  onClose,
  captureChart,
}: Props) {
  const [draft, setDraft] = useState<JournalEntryRecord>(() => ({
    ...initialEntry,
    clientRequestId: initialEntry.clientRequestId || crypto.randomUUID(),
  }))
  const recovery = useJournalDraft(initialEntry, draft)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [confirmAction, setConfirmAction] = useState<'close' | 'replace-recovery' | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const busy = saving || processing
  const selectedPlaybook = playbooks.find(
    (book) => book.id === draft.strategyId || book.name === draft.playbook
  )
  const legacyPlaybook = initialEntry.id && draft.playbook && !selectedPlaybook
    ? draft.playbook
    : ''
  const allConditions = conditionsForJournalEntry(draft, selectedPlaybook?.conditions)
  const inputClass = `h-11 min-w-0 rounded-lg border px-3 text-base outline-none focus:border-blue-500 sm:h-9 sm:text-sm ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`
  const update = (patch: Partial<JournalEntryRecord>) =>
    setDraft((entry) => ({ ...entry, ...patch }))
  const updateRecap = (patch: Partial<JournalRecap>) =>
    setDraft((entry) => ({ ...entry, recap: { ...entry.recap, ...patch } }))

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [])

  const close = async () => {
    if (busy) return
    try {
      await recovery.flush()
    } catch {
      if (!recovery.recovery) {
        setConfirmAction('close')
        return
      }
    }
    onClose()
  }
  const save = async () => {
    if (busy || recovery.recovery) return
    const validation = validateJournalEntry(draft)
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    setError('')
    try {
      await recovery.flush().catch(() => {})
      await onSave({
        ...draft,
        recap: normalizeJournalRecap({ ...draft.recap, setupConditions: allConditions }),
      })
      await recovery.clear().catch(() => {})
    } catch (error) {
      setError(handleApiError(error))
      setSaving(false)
    }
  }
  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center sm:p-5">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-editor-title"
        onKeyDown={(event) => {
          // Trade hotkeys must never execute while entering a recap.
          event.stopPropagation()
          if (event.key === 'Escape') {
            event.stopPropagation()
            close()
          }
          if (event.key !== 'Tab') return
          const focusable = Array.from(
            dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
            ) ?? []
          )
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
        className={`flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border sm:rounded-2xl ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'}`}
      >
        <div className="flex items-center justify-between border-b border-zinc-500/20 px-5 py-4">
          <div>
            <h2
              id="journal-editor-title"
              className={`text-base font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}
            >
              {initialEntry.id ? 'Edit recap' : 'New setup recap'}
            </h2>
            <p className="mt-1 text-xs text-[#71717A]">
              Playbook → building blocks → chart evidence → lesson
            </p>
            <p role="status" className="mt-1 text-xs text-blue-500">
              {recovery.status}
            </p>
            {recovery.recovery && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(recovery.recovery!.entry)
                    recovery.resume()
                  }}
                  className="rounded bg-blue-600 px-3 py-2 text-white"
                >
                  Restore draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmAction('replace-recovery')
                  }}
                  className="rounded border border-zinc-500 px-3 py-2"
                >
                  Use saved entry
                </button>
              </div>
            )}
            {draft.source && draft.source !== 'manual' && (
              <p className="mt-1 text-xs text-blue-500">
                {draft.source} snapshot ·{' '}
                {draft.sourceContext?.sessionName || draft.sourceSessionId} · Verify the captured
                details. Quotes and execution continue; closing a trade will not automatically
                update this recap.
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={busy}
            aria-label="Close journal editor"
            onClick={close}
            className="rounded-lg px-3 py-2 text-xl text-[#71717A]"
          >
            ×
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <fieldset disabled={busy || !!recovery.recovery} className="min-h-0 overflow-y-auto p-5">
            <JournalExecutionUpdate entry={draft} onApply={setDraft} />
            {error && (
              <p role="alert" className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
                {error}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-[#71717A] sm:col-span-2">
                Playbook
                <select
                  aria-label="Journal playbook"
                  value={selectedPlaybook?.id ?? (legacyPlaybook ? '__legacy__' : '')}
                  disabled={playbooks.length === 0}
                  onChange={(event) => {
                    const selected = playbooks.find((book) => book.id === event.target.value)
                    if (selected)
                      update({
                        playbook: selected.name,
                        strategyId: selected.id,
                        recap: { ...draft.recap, setupConditions: selected.conditions },
                      })
                  }}
                  className={`${inputClass} mt-1.5 w-full`}
                >
                  {!selectedPlaybook && !legacyPlaybook && (
                    <option value="">
                      {playbooks.length ? 'Select a playbook' : 'No playbooks available'}
                    </option>
                  )}
                  {legacyPlaybook && (
                    <option value="__legacy__">Previously saved: {legacyPlaybook}</option>
                  )}
                  {playbooks.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.name}
                    </option>
                  ))}
                </select>
                {playbooks.length === 0 && !legacyPlaybook && (
                  <span className="mt-2 block text-xs text-[#71717A]">
                    You have no playbooks.{' '}
                    <a href="/analytics" className="font-semibold text-blue-500">
                      Create a playbook
                    </a>{' '}
                    before saving this recap.
                  </span>
                )}
              </label>
              <label className="text-xs text-[#71717A]">
                Entry date and time
                <input
                  required
                  aria-label="Journal entry date and time"
                  type="datetime-local"
                  value={draft.dateTime}
                  onChange={(event) => update({ dateTime: event.target.value })}
                  className={`${inputClass} mt-1.5 w-full`}
                />
              </label>
              <label className="text-xs text-[#71717A]">
                Exit date and time
                <input
                  aria-label="Journal exit date and time"
                  type="datetime-local"
                  value={draft.exitDateTime || ''}
                  onChange={(event) => update({ exitDateTime: event.target.value })}
                  className={`${inputClass} mt-1.5 w-full`}
                />
              </label>
              <label className="text-xs text-[#71717A]">
                Symbol
                <input
                  required
                  aria-label="Journal symbol"
                  value={draft.symbol}
                  onChange={(event) => update({ symbol: event.target.value.toUpperCase() })}
                  placeholder="NQ"
                  className={`${inputClass} mt-1.5 w-full`}
                />
              </label>
              <label className="text-xs text-[#71717A]">
                Side
                <select
                  aria-label="Journal side"
                  value={draft.side}
                  onChange={(event) =>
                    update({ side: event.target.value as JournalEntryRecord['side'] })
                  }
                  className={`${inputClass} mt-1.5 w-full`}
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </label>
              {(
                [
                  ['entryPrice', 'Entry price'],
                  ['closePrice', 'Close price'],
                  ['size', 'Position size'],
                  ['pnl', 'Net P&L'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="text-xs text-[#71717A]">
                  {field === 'pnl' && draft.sourceContext?.pnlBasis === 'gross'
                    ? 'Gross P&L — replace with verified net P&L'
                    : label}
                  <input
                    aria-label={`Journal ${label}`}
                    inputMode="decimal"
                    value={draft[field]}
                    onChange={(event) => {
                      const value = event.target.value
                      update({
                        [field]: value,
                        ...(field === 'pnl' && value.trim() && Number.isFinite(Number(value))
                          ? {
                              sourceContext: { ...draft.sourceContext, pnlBasis: 'recorded' },
                              outcome:
                                Number(value) > 0
                                  ? 'win'
                                  : Number(value) < 0
                                    ? 'loss'
                                    : 'breakeven',
                            }
                          : {}),
                      })
                    }}
                    className={`${inputClass} mt-1.5 w-full`}
                  />
                </label>
              ))}
              <label className="text-xs text-[#71717A]">
                Result
                <select
                  aria-label="Journal outcome"
                  value={draft.outcome}
                  onChange={(event) =>
                    update({ outcome: event.target.value as JournalEntryRecord['outcome'] })
                  }
                  className={`${inputClass} mt-1.5 w-full`}
                >
                  <option value="planned">Planned / not closed</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="breakeven">Breakeven</option>
                </select>
              </label>
              <div className="rounded-xl border border-zinc-500/20 p-4 sm:col-span-2">
                <h3
                  className={`mb-3 text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}
                >
                  Playbook building blocks
                </h3>
                <JournalConditionFields
                  conditions={allConditions}
                  responses={draft.conditionResponses}
                  onChange={(conditionResponses) => update({ conditionResponses })}
                  isDark={isDark}
                  inputClass={inputClass}
                />
              </div>
              <JournalRecapFields
                recap={draft.recap ?? {}}
                onChange={updateRecap}
                isDark={isDark}
                inputClass={inputClass}
                onProcessing={setProcessing}
                captureChart={captureChart}
              />
              <label className="text-xs text-[#71717A] sm:col-span-2">
                Execution notes
                <textarea
                  aria-label="Journal execution notes"
                  value={draft.notes}
                  onChange={(event) => update({ notes: event.target.value })}
                  rows={4}
                  className={`${inputClass} mt-1.5 !h-auto w-full resize-y py-2`}
                />
              </label>
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 border-t border-zinc-500/20 px-5 py-4">
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className="rounded-lg border border-zinc-500/30 px-4 py-2 text-sm text-[#71717A]"
            >
              Close (keep draft)
            </button>
            <button
              type="submit"
              disabled={busy || (!selectedPlaybook && !legacyPlaybook)}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {processing ? 'Preparing images…' : saving ? 'Saving…' : 'Save recap'}
            </button>
          </div>
        </form>
      </div>
    </div>
    <ConfirmDialog
      isOpen={confirmAction === 'close'}
      title="Close without a recoverable draft?"
      message="This draft could not be saved on your device. Closing now will discard the unsaved changes."
      confirmText="Close and discard"
      cancelText="Keep editing"
      variant="warning"
      isDark={isDark}
      onConfirm={() => {
        setConfirmAction(null)
        onClose()
      }}
      onCancel={() => setConfirmAction(null)}
    />
    <ConfirmDialog
      isOpen={confirmAction === 'replace-recovery'}
      title="Replace the device draft?"
      message="The recoverable draft on this device will be replaced with the current saved entry."
      confirmText="Use saved entry"
      cancelText="Keep device draft"
      variant="warning"
      isDark={isDark}
      onConfirm={() => {
        setConfirmAction(null)
        recovery.resume()
      }}
      onCancel={() => setConfirmAction(null)}
    />
    </>
  )
}
