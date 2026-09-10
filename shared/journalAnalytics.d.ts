import type { JournalEntryRecord } from '../src/api/journal.api'
export type JournalMetrics = {
  count: number
  netPnl: number
  wins: number
  winRate: number | null
  expectancy: number | null
  profitFactor: number | null
  rCount: number
  averageR: number | null
  rDistribution: number[]
}
export type JournalAnalytics = JournalMetrics & {
  total: number
  open: number
  missed: number
  observations: number
  missingPnl: number
  mistakeLoss: number
  byPlaybook: JournalGroup[]
  bySession: JournalGroup[]
  byGrade: JournalGroup[]
  bySource: JournalGroup[]
  byTimeframe: JournalGroup[]
  byMistake: JournalGroup[]
  byCondition: JournalGroup[]
}
export type JournalGroup = JournalMetrics & { label: string }
export function journalAnalytics(entries: JournalEntryRecord[]): JournalAnalytics
export function journalPeriod(kind: string, start: string): { start: string; end: string }
