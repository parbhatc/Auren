import type { JournalEntryRecord, JournalRecap } from '../src/api/journal.api'
export const MAX_JOURNAL_SCREENSHOTS: number
export const MAX_JOURNAL_IMAGE_BYTES: number
export const JOURNAL_MISTAKE_TAGS: string[]
export function isJournalImage(dataUrl: unknown): boolean
export function normalizeJournalRecap(value: unknown): JournalRecap
export function summarizeJournalEntry(entry: JournalEntryRecord): JournalEntryRecord
export function journalLocalDateTime(date?: Date): string
export function validateJournalEntry(entry: Partial<JournalEntryRecord>): string
