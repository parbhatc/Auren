import api from './api'

export type JournalStrategyRecord = {
  id: string
  name: string
  entry_conditions: string | unknown[]
}

export type JournalEntryRecord = {
  id: string
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
  source?: 'manual' | 'replay'
  sourceSessionId?: string
  sourceTradeId?: string
  sourceContext?: JournalSourceContext
  riskPlan?: JournalRiskPlan
  notes: string
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
  async listEntries(): Promise<JournalEntryRecord[]> {
    const response = await api.get('/trading-journal/entries')
    return response.data?.entries ?? []
  },
  async getEntry(id: string): Promise<JournalEntryRecord> {
    const response = await api.get(`/trading-journal/entries/${id}`)
    return response.data.entry
  },
  async createEntry(entry: JournalEntryRecord): Promise<JournalEntryRecord> {
    const response = await api.post('/trading-journal/entries', entry)
    return response.data.entry
  },
  async updateEntry(entry: JournalEntryRecord): Promise<JournalEntryRecord> {
    const response = await api.put(`/trading-journal/entries/${entry.id}`, entry)
    return response.data.entry
  },
  async deleteEntry(id: string): Promise<void> {
    await api.delete(`/trading-journal/entries/${id}`)
  },
  async listStrategies(): Promise<JournalStrategyRecord[]> {
    const response = await api.get('/trading-journal/strategies')
    return response.data?.strategies ?? []
  },
  async createStrategy(name: string, conditions: unknown[]): Promise<JournalStrategyRecord> {
    const response = await api.post('/trading-journal/strategies', payload(name, conditions))
    return response.data.strategy
  },
  async updateStrategy(id: string, name: string, conditions: unknown[]): Promise<JournalStrategyRecord> {
    const response = await api.put(`/trading-journal/strategies/${id}`, payload(name, conditions))
    return response.data.strategy
  },
  async deleteStrategy(id: string): Promise<void> {
    await api.delete(`/trading-journal/strategies/${id}`)
  },
}
