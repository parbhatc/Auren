import { useEffect, useRef, useState } from 'react'
import type { JournalEntryRecord } from '../api/journal.api'
import {
  applyJournalExecution,
  loadJournalExecutions,
  type JournalExecution,
} from './journalExecutions'
import { handleApiError } from '../utils/errorHandler'

export default function JournalExecutionUpdate({
  entry,
  onApply,
}: {
  entry: JournalEntryRecord
  onApply: (entry: JournalEntryRecord) => void
}) {
  const [candidates, setCandidates] = useState<JournalExecution[] | null>(null),
    [selected, setSelected] = useState<JournalExecution | null>(null)
  const [loading, setLoading] = useState(false),
    [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  if (!entry.sourceSessionId || !['practice', 'live', 'replay'].includes(entry.source ?? ''))
    return null
  return (
    <section className="mb-4 rounded-lg border border-blue-500/25 p-3 text-sm">
      <button
        type="button"
        disabled={loading}
        className="text-blue-500"
        onClick={async () => {
          setLoading(true)
          setError('')
          setSelected(null)
          try {
            const rows = await loadJournalExecutions(entry)
            if (active.current) setCandidates(rows)
          } catch (e) {
            if (active.current) setError(handleApiError(e))
          } finally {
            if (active.current) setLoading(false)
          }
        }}
      >
        {loading ? 'Loading closed executions…' : 'Update from closed execution'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-red-500">
          {error}
        </p>
      )}
      {candidates && (
        <>
          <p className="my-2 text-xs text-zinc-500">
            Choose the matching execution. Nothing changes until you apply the preview and save the
            recap. This never sends an order.
          </p>
          <select
            aria-label="Closed execution"
            className="w-full rounded border border-zinc-500/30 bg-transparent p-2"
            value={selected?.id || ''}
            onChange={(e) => setSelected(candidates.find((t) => t.id === e.target.value) || null)}
          >
            <option value="">
              {candidates.length
                ? 'Select a closed execution'
                : 'No compatible closed executions found'}
            </option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.symbol} · {t.side} {t.size} · {t.dateTime} → {t.exitDateTime} · {t.entryPrice} →{' '}
                {t.closePrice}
              </option>
            ))}
          </select>
          {selected && (
            <div className="mt-3">
              <p className="mb-2 text-xs text-amber-500">{selected.note}</p>
              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Current</th>
                      <th>Selected execution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        'entryPrice',
                        'closePrice',
                        'size',
                        'dateTime',
                        'exitDateTime',
                        'pnl',
                      ] as const
                    ).map((key) => (
                      <tr key={key}>
                        <td className="py-1">{key}</td>
                        <td>{entry[key] || 'Unknown'}</td>
                        <td>{selected[key] || 'Unknown — enter manually'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs">
                Recorded fees: {selected.fees || 'Unknown'}. Notes, screenshots, checklist and
                initial risk are preserved.
              </p>
              <button
                type="button"
                className="mt-3 rounded bg-blue-600 px-3 py-2 text-white"
                onClick={() => {
                  try {
                    onApply(applyJournalExecution(entry, selected))
                    setSelected(null)
                    setCandidates(null)
                  } catch (e) {
                    setError(handleApiError(e))
                  }
                }}
              >
                Apply execution details
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
