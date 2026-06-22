import { HistoryQuery } from 'rithmic-api'

export function resolveRithmicBarSubscription(resolution) {
  const parsed = HistoryQuery.parseResolution(resolution)
  return { barType: parsed.barType, barPeriod: parsed.barTypePeriod }
}
