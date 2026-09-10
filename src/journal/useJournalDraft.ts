import { useEffect, useRef, useState } from 'react'
import api from '../api/api'
import type { JournalEntryRecord } from '../api/journal.api'
import { journalDraftKey, journalDraftStorage, type StoredJournalDraft } from './journalDraftStore'

export function useJournalDraft(initial: JournalEntryRecord, draft: JournalEntryRecord) {
  const [recovery, setRecovery] = useState<StoredJournalDraft | null>(null)
  const [status, setStatus] = useState('Preparing draft recovery…')
  const [ready, setReady] = useState(false)
  const key = useRef('')
  const latest = useRef(draft)
  latest.current = draft
  const enabled = useRef(false)
  const stopped = useRef(false)
  const pending = useRef<Promise<unknown>>(Promise.resolve())
  const flush = () => {
    if (stopped.current) return pending.current
    if (!enabled.current || !key.current)
      return Promise.reject(new Error('Draft recovery is not ready.'))
    const value = { entry: latest.current, savedAt: new Date().toISOString() }
    pending.current = pending.current
      .catch(() => {})
      .then(() => journalDraftStorage(key.current, 'write', value))
    return pending.current
  }
  useEffect(() => {
    const controller = new AbortController()
    void api
      .get('/auth/validate', { signal: controller.signal })
      .then(async ({ data }) => {
        const owner = data.user?.id
        if (!owner) throw new Error('No verified draft owner')
        key.current = journalDraftKey(String(owner), initial)
        const stored = await journalDraftStorage(key.current, 'read')
        if (controller.signal.aborted) return
        if (stored?.entry && JSON.stringify(stored.entry) !== JSON.stringify(initial)) {
          setRecovery(stored)
          setStatus('A recoverable draft is available on this device.')
        } else {
          enabled.current = true
          setStatus('Draft recovery ready on this device.')
        }
        setReady(true)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus('Local draft recovery unavailable. Keep this window open until saved.')
      })
    const persist = () => {
      void flush().catch(() => {})
    }
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', persist)
    return () => {
      controller.abort()
      persist()
      window.removeEventListener('pagehide', persist)
      document.removeEventListener('visibilitychange', persist)
    }
  }, [])
  useEffect(() => {
    if (!ready || recovery || stopped.current) return
    setStatus('Saving draft on this device…')
    const timer = setTimeout(() => {
      void flush()
        .then(() => setStatus('Draft saved on this device'))
        .catch(() => setStatus('Draft storage full or unavailable. Save the recap before leaving.'))
    }, 500)
    return () => clearTimeout(timer)
  }, [draft, ready, recovery])
  return {
    status,
    recovery,
    resume: () => {
      enabled.current = true
      setRecovery(null)
    },
    flush,
    clear: async () => {
      stopped.current = true
      enabled.current = false
      await pending.current.catch(() => {})
      if (key.current) await journalDraftStorage(key.current, 'delete')
    },
  }
}
