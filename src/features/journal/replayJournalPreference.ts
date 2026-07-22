const REPLAY_JOURNAL_KEY = 'auren:replay-journal-capture:v1'
export const REPLAY_JOURNAL_PREFERENCE_EVENT = 'auren:replay-journal-preference'

export function isReplayJournalEnabled(): boolean {
  try {
    return localStorage.getItem(REPLAY_JOURNAL_KEY) === '1'
  } catch {
    return false
  }
}

export function setReplayJournalEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(REPLAY_JOURNAL_KEY, enabled ? '1' : '0')
  } catch {
    // Private browsing can disable storage. The event still updates this tab.
  }
  window.dispatchEvent(new CustomEvent(REPLAY_JOURNAL_PREFERENCE_EVENT, { detail: { enabled } }))
}
