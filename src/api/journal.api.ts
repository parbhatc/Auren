import api from './api'

export type JournalStrategyRecord = {
  id: string
  name: string
  entry_conditions: string | unknown[]
}

const payload = (name: string, conditions: unknown[]) => ({
  name,
  timeframes: [],
  entry_conditions: conditions,
  invalidation_rules: [],
  max_risk: null,
})

export const journalAPI = {
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
