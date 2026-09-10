import type { JournalEntryRecord } from '../api/journal.api'

export type StoredJournalDraft = { entry: JournalEntryRecord; savedAt: string }
export function journalDraftKey(owner: string, entry: JournalEntryRecord): string {
  if (!owner) throw new Error('A verified user is required for draft storage.')
  return JSON.stringify([
    owner,
    entry.id || [
      entry.source || 'manual',
      entry.sourceSessionId || '',
      entry.sourceTradeId || 'new',
    ],
  ])
}

export async function journalDraftStorage(
  key: string,
  action: 'read' | 'write' | 'delete',
  value?: StoredJournalDraft
): Promise<StoredJournalDraft | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('auren-journal-drafts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('drafts')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('drafts', action === 'read' ? 'readonly' : 'readwrite')
      const store = transaction.objectStore('drafts')
      const request =
        action === 'read'
          ? store.get(key)
          : action === 'delete'
            ? store.delete(key)
            : store.put(value, key)
      transaction.oncomplete = () => resolve(action === 'read' ? request.result : undefined)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error || new Error('Draft storage aborted'))
    })
  } finally {
    db.close()
  }
}
