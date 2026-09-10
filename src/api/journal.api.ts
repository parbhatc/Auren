import api from './api'
import type { JournalAnalytics } from '../../shared/journalAnalytics.js'

export type JournalReview = {
  kind: 'daily' | 'weekly'
  start: string
  version: number
  focusRule?: string
  bestExecution?: string
  mistake?: string
  notes?: string
  followedRules?: string
  entryIds?: string[]
}
export type JournalReviewResponse = {
  review: JournalReview
  entries: JournalEntryRecord[]
  analytics: JournalAnalytics
}

export type JournalStrategyRecord = {
  id: string
  name: string
  entry_conditions: string | unknown[]
}

export type JournalEntryRecord = {
  id: string
  version?: number
  clientRequestId?: string
  strategyId?: string | null
  playbook: string
  dateTime: string
  exitDateTime: string
  symbol: string
  side: 'long' | 'short'
  entryPrice: string
  closePrice: string
  size: string
  pnl: string
  outcome: 'planned' | 'win' | 'loss' | 'breakeven'
  conditionResponses: Record<string, string | boolean>
  source?: 'manual' | 'replay' | 'practice' | 'live'
  sourceSessionId?: string
  sourceTradeId?: string
  sourceContext?: JournalSourceContext
  riskPlan?: JournalRiskPlan
  recap?: JournalRecap
  notes: string
}

export type JournalAnnotation = {
  kind: 'arrow' | 'level'
  x1: number
  y1: number
  x2: number
  y2: number
}
export type JournalScreenshot = {
  id: string
  caption: string
  dataUrl: string
  annotations?: JournalAnnotation[]
  capturedAt?: string
  chartResolution?: string
  cursorTime?: string
}
export type JournalRecap = {
  riskDollars?: string
  title?: string
  session?: string
  execution?: 'taken' | 'missed' | 'observation'
  grade?: '' | 'A' | 'B' | 'C'
  lesson?: string
  mistakeTags?: string[]
  screenshots?: JournalScreenshot[]
  screenshotCount?: number
  setupConditions?: { id: string; label: string; type: string }[]
}

export type JournalRiskMode = 'none' | 'dynamic' | 'fixed' | 'strict_r' | 'manual'

export type JournalRiskLeg = {
  mode: JournalRiskMode
  value?: string
  price?: string
  basis?: string
  timeframe?: string
}

export type JournalRiskPlan = {
  stopLoss: JournalRiskLeg
  breakEven: JournalRiskLeg & { enabled: boolean }
  takeProfit: JournalRiskLeg
}

export type JournalSourceContext = {
  pnlBasis?: 'net' | 'gross' | 'recorded'
  fees?: string
  executionId?: string
  sessionName?: string
  cursorTime?: string
  chartResolution?: string
  snapshotKind?: 'cursor' | 'open_position' | 'closed_trade'
  stopLossPrice?: string
  takeProfitPrice?: string
}

const payload = (name: string, conditions: unknown[]) => ({
  name,
  timeframes: [],
  entry_conditions: conditions,
  invalidation_rules: [],
  max_risk: null,
})

export const journalAPI = {
  async analytics(
    filters: { from?: string; to?: string; source?: string },
    signal?: AbortSignal
  ): Promise<JournalAnalytics> {
    return (await api.get('/trading-journal/analytics', { params: filters, signal })).data.analytics
  },
  async getReview(
    kind: string,
    start: string,
    signal?: AbortSignal
  ): Promise<JournalReviewResponse> {
    return (
      await api.get(
        `/trading-journal/reviews/${encodeURIComponent(kind)}/${encodeURIComponent(start)}`,
        { signal }
      )
    ).data
  },
  async saveReview(review: JournalReview): Promise<JournalReview> {
    return (
      await api.put(
        `/trading-journal/reviews/${review.kind}/${encodeURIComponent(review.start)}`,
        review
      )
    ).data.review
  },
  async listEntries(signal?: AbortSignal): Promise<JournalEntryRecord[]> {
    const response = await api.get('/trading-journal/entries', { signal })
    return response.data?.entries ?? []
  },
  async getEntry(id: string, signal?: AbortSignal): Promise<JournalEntryRecord> {
    const response = await api.get(`/trading-journal/entries/${encodeURIComponent(id)}`, { signal })
    return response.data.entry
  },
  async createEntry(entry: JournalEntryRecord): Promise<JournalEntryRecord> {
    const response = await api.post('/trading-journal/entries', entry)
    return response.data.entry
  },
  async updateEntry(entry: JournalEntryRecord): Promise<JournalEntryRecord> {
    const response = await api.put(
      `/trading-journal/entries/${encodeURIComponent(entry.id)}`,
      entry
    )
    return response.data.entry
  },
  async deleteEntry(id: string): Promise<void> {
    await api.delete(`/trading-journal/entries/${encodeURIComponent(id)}`)
  },
  async listStrategies(signal?: AbortSignal): Promise<JournalStrategyRecord[]> {
    const response = await api.get('/trading-journal/strategies', { signal })
    return response.data?.strategies ?? []
  },
  async createStrategy(name: string, conditions: unknown[]): Promise<JournalStrategyRecord> {
    const response = await api.post('/trading-journal/strategies', payload(name, conditions))
    return response.data.strategy
  },
  async updateStrategy(
    id: string,
    name: string,
    conditions: unknown[]
  ): Promise<JournalStrategyRecord> {
    const response = await api.put(
      `/trading-journal/strategies/${encodeURIComponent(id)}`,
      payload(name, conditions)
    )
    return response.data.strategy
  },
  async deleteStrategy(id: string): Promise<void> {
    await api.delete(`/trading-journal/strategies/${encodeURIComponent(id)}`)
  },
}
