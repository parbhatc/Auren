import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpenCheck } from 'lucide-react'
import { journalAPI, type JournalEntryRecord } from '../api/journal.api'
import { playbookFromRecord, type Playbook } from './journalConditions'
import { JOURNAL_TEMPLATES } from './journalTemplates'
import { isSameCapturedTrade } from './journalCapture'
import { handleApiError } from '../utils/errorHandler'
import { captureJournalChart } from './journalImages'

const JournalEntryEditor = lazy(() => import('./JournalEntryEditor'))

export default function InSessionJournalCapture({
  isDark,
  getSnapshot,
}: {
  isDark: boolean
  getSnapshot: () => JournalEntryRecord
}) {
  const [draft, setDraft] = useState<JournalEntryRecord | null>(null)
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  const open = async () => {
    if (request.current || draft) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setNotice('')
    try {
      const snapshot = getSnapshot()
      const [records, strategies] = await Promise.all([
        journalAPI.listEntries(controller.signal),
        journalAPI.listStrategies(controller.signal),
      ])
      const books = strategies.map(playbookFromRecord)
      const existing = records.find((entry) => isSameCapturedTrade(entry, snapshot))
      const template = books[0] ?? JOURNAL_TEMPLATES[0]
      const entry = existing
        ? await journalAPI.getEntry(existing.id, controller.signal)
        : {
            ...snapshot,
            playbook: template.name,
            strategyId: books[0]?.id ?? null,
            recap: { ...snapshot.recap, setupConditions: template.conditions },
          }
      if (!controller.signal.aborted) {
        setPlaybooks(books)
        setDraft(entry)
      }
    } catch (error) {
      if (!controller.signal.aborted) setNotice(handleApiError(error))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
      if (request.current === controller) request.current = null
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={loading}
        aria-label="Log current setup"
        title="Log the current position or observation without leaving the chart"
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium ${isDark ? 'border-zinc-700 text-zinc-200' : 'border-zinc-300 text-zinc-700'}`}
      >
        <BookOpenCheck className="h-4 w-4" />
        <span>{loading ? 'Loading…' : 'Log setup'}</span>
      </button>
      {notice && (
        <span role="status" className="max-w-48 text-xs text-blue-500">
          {notice}
        </span>
      )}
      {draft &&
        createPortal(
          <Suspense
            fallback={
              <div
                role="status"
                className="fixed inset-x-0 top-4 z-[100] bg-zinc-900 p-3 text-center text-white"
              >
                Loading journal editor…
              </div>
            }
          >
            <JournalEntryEditor
              initialEntry={draft}
              playbooks={playbooks}
              isDark={isDark}
              captureChart={() => captureJournalChart(getSnapshot())}
              onClose={() => setDraft(null)}
              onSave={async (entry) => {
                if (entry.id) await journalAPI.updateEntry(entry)
                else await journalAPI.createEntry(entry)
                setDraft(null)
                setNotice('Recap saved. Your trading session is still running.')
              }}
            />
          </Suspense>,
          document.body
        )}
    </>
  )
}
