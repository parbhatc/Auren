import type { JournalEntryRecord, JournalRiskLeg, JournalStrategyRecord } from '../api/journal.api'

export type Playbook = {
  id: string
  name: string
  description: string
  rules: string[]
  conditions: PlaybookCondition[]
}

export type PlaybookCondition = {
  id: string
  label: string
  type:
    | 'boolean'
    | 'time'
    | 'timeframe'
    | 'timeframe_time'
    | 'liquidity_sweep'
    | 'pda_delivery'
    | 'smt'
    | 'text'
    | 'number'
}

export const BUILDING_BLOCK_DEFINITIONS: Array<{
  type: PlaybookCondition['type']
  label: string
  description: string
}> = [
  {
    type: 'liquidity_sweep',
    label: 'Sweep',
    description: 'Capture one or more timeframe or session liquidity sweeps.',
  },
  {
    type: 'pda_delivery',
    label: 'PDA delivery',
    description: 'Record the timeframe, PDA type, tap time, and source candles.',
  },
  {
    type: 'timeframe_time',
    label: 'Timeframe + time',
    description: 'Record a timeframe-specific event such as an IFVG.',
  },
  {
    type: 'smt',
    label: 'SMT',
    description: 'Record the comparison market, timeframe, and confirmation.',
  },
  { type: 'boolean', label: 'Checklist', description: 'A yes or no rule.' },
  { type: 'time', label: 'Timeline event', description: 'Record when an event occurred.' },
  { type: 'timeframe', label: 'Timeframe', description: 'Select the relevant timeframe.' },
  { type: 'text', label: 'Notes', description: 'Capture a short written detail.' },
  { type: 'number', label: 'Number', description: 'Capture a numeric measurement.' },
]

export type LiquiditySweepRow = {
  sweepTime: string
  referenceTime: string
  level: 'high' | 'low'
  price: string
  sourceLabel?: string
}

export type PdaDeliveryRow = {
  time: string
  timeframe: string
  pda: string
  candles: string[]
}

export function normalizePlaybookCondition(value: unknown, index: number): PlaybookCondition {
  if (value && typeof value === 'object') {
    const item = value as Partial<PlaybookCondition>
    const validTypes: PlaybookCondition['type'][] = [
      'boolean',
      'time',
      'timeframe',
      'timeframe_time',
      'liquidity_sweep',
      'pda_delivery',
      'smt',
      'text',
      'number',
    ]
    const label = String(item.label || `Condition ${index + 1}`)
    return {
      id: String(item.id || `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`),
      label,
      type: validTypes.includes(item.type as PlaybookCondition['type'])
        ? (item.type as PlaybookCondition['type'])
        : 'text',
    }
  }
  const label = String(value || `Condition ${index + 1}`)
  return { id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`, label, type: 'text' }
}

export const conditionTypeLabel = (type: PlaybookCondition['type']) => {
  return BUILDING_BLOCK_DEFINITIONS.find((block) => block.type === type)?.label ?? type
}

export const parseLiquiditySweeps = (value: unknown): LiquiditySweepRow[] => {
  const source = String(value ?? '')
  if (!source) return [{ sweepTime: '', referenceTime: '', level: 'high', price: '' }]
  return source.split('\n').map((line) => {
    const parts = line.split('|').map((part) => part.trim())
    const [sweepTime = '', referenceTime = '', rawLevel = 'high', price = '', sourceLabel = ''] =
      parts.length >= 4 ? parts : [parts[0] || '', '', parts[1] || 'high', parts[2] || '']
    return {
      sweepTime,
      referenceTime,
      level: rawLevel.toLowerCase() === 'low' ? ('low' as const) : ('high' as const),
      price: price.replace(/^\$/, ''),
      sourceLabel,
    }
  })
}

export const serializeLiquiditySweeps = (rows: LiquiditySweepRow[]) =>
  rows
    .map(
      (row) =>
        `${row.sweepTime} | ${row.referenceTime} | ${row.level} | ${row.price} | ${row.sourceLabel || ''}`
    )
    .join('\n')

export const extractClockValues = (value: unknown) =>
  [...String(value || '').matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)\b/gi)].map(
    (match) => match[0]
  )

export const parsePdaDeliveries = (value: unknown, legacyCandles?: unknown): PdaDeliveryRow[] => {
  const lines = String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) return [{ time: '', timeframe: '', pda: '', candles: [] }]
  const legacy = extractClockValues(legacyCandles)
  return lines.map((line, index) => {
    const [time = '', timeframe = '', pda = '', candleText = ''] = line.split(/\s*@\s*/, 4)
    const candles = extractClockValues(candleText)
    return { time, timeframe, pda, candles: candles.length ? candles : index === 0 ? legacy : [] }
  })
}

export const serializePdaDeliveries = (rows: PdaDeliveryRow[]) =>
  rows
    .map((row) =>
      [row.time, row.timeframe, row.pda, row.candles.filter(Boolean).join(', ')].join(' @ ')
    )
    .join('\n')

export const formatConditionResponse = (label: string, value: string | boolean) => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (!value) return '—'
  const normalizedLabel = label.trim().toLowerCase()
  if (normalizedLabel === 'sweep' || normalizedLabel.includes('liquidity sweep')) {
    return parseLiquiditySweeps(value)
      .map((row) => {
        const numericPrice = Number(row.price)
        const price =
          row.price && Number.isFinite(numericPrice)
            ? `$${numericPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : row.price
        const level = row.level[0].toUpperCase() + row.level.slice(1)
        const reference = row.sourceLabel
          ? `${row.sourceLabel}${row.referenceTime ? ` from ${row.referenceTime}` : ''}`
          : [row.referenceTime, level].filter(Boolean).join(' ')
        return `${row.sweepTime || 'Unknown time'} swept ${reference || level}${price ? ` at ${price}` : ''}`
      })
      .join('\n')
  }
  if (normalizedLabel === 'fvg tap') {
    return parsePdaDeliveries(value)
      .map((row) => [row.time, row.timeframe, row.pda].filter(Boolean).join(' — '))
      .join('\n')
  }
  if (label === 'HTF PDA delivery') {
    return parsePdaDeliveries(value)
      .map((row, index) => {
        const delivery = [row.time, row.timeframe, row.pda].filter(Boolean).join(' — ')
        const candles = row.candles.length ? `\nSource candles: ${row.candles.join(', ')}` : ''
        return `${index + 1}. ${delivery || 'Incomplete PDA'}${candles}`
      })
      .join('\n')
  }
  return value
}

export const formatRiskLeg = (leg?: JournalRiskLeg) => {
  if (!leg?.mode || leg.mode === 'none') return 'Not set'
  const mode = leg.mode === 'strict_r' ? 'Strict R' : leg.mode[0].toUpperCase() + leg.mode.slice(1)
  const detail = leg.mode === 'fixed' ? leg.price : leg.value
  return [mode, detail, leg.basis, leg.timeframe].filter(Boolean).join(' · ')
}

export const journalOutcomeLabel = (entry: JournalEntryRecord) => {
  if (entry.outcome === 'planned' && entry.recap?.execution === 'observation') return 'Not taken'
  if (entry.outcome === 'planned' && entry.recap?.execution === 'taken') return 'Open'
  return entry.outcome === 'breakeven' ? 'Breakeven' : entry.outcome
}

export const journalSetupStages = (entry: JournalEntryRecord) => {
  const isMidTapSetup =
    /mid\s*tap/i.test(entry.playbook) || Boolean(entry.conditionResponses?.['MID Tap'])
  const isFvgTapSetup =
    /fvg\s*tap/i.test(entry.playbook) || Boolean(entry.conditionResponses?.['FVG Tap'])
  const hasSmt = /smt/i.test(entry.playbook) || Boolean(entry.conditionResponses?.SMT)
  if (isMidTapSetup) return ['MID Tap', 'IFVG']
  if (isFvgTapSetup) return hasSmt ? ['Sweep', 'SMT', 'FVG Tap', 'IFVG'] : ['Sweep', 'FVG Tap', 'IFVG']
  return hasSmt ? ['Sweep', 'SMT', 'IFVG'] : ['Sweep', 'IFVG']
}

export const toTimeInputValue = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return value.match(/^\d{2}:\d{2}$/) ? value : ''
  let hour = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hour += 12
  return `${String(hour).padStart(2, '0')}:${match[2]}`
}

export const fromTimeInputValue = (value: string) => {
  if (!value) return ''
  const [hourText, minute = '00'] = value.split(':')
  const hour = Number(hourText)
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function playbookFromRecord(strategy: JournalStrategyRecord): Playbook {
  let conditions: unknown = strategy.entry_conditions
  let rules: unknown = strategy.invalidation_rules
  try {
    if (typeof conditions === 'string') conditions = JSON.parse(conditions)
  } catch {
    conditions = []
  }
  try {
    if (typeof rules === 'string') rules = JSON.parse(rules)
  } catch {
    rules = []
  }
  return {
    id: String(strategy.id),
    name: String(strategy.name),
    description: String(strategy.description || ''),
    rules: Array.isArray(rules) ? rules.map(String).filter(Boolean) : [],
    conditions: Array.isArray(conditions) ? conditions.map(normalizePlaybookCondition) : [],
  }
}

/** The saved checklist survives edits/deletion of the original playbook. */
export function conditionsForJournalEntry(
  entry: JournalEntryRecord,
  fallback: PlaybookCondition[] = []
): PlaybookCondition[] {
  const conditions = entry.recap?.setupConditions?.length
    ? entry.recap.setupConditions.map(normalizePlaybookCondition)
    : fallback
  const extra = Object.keys(entry.conditionResponses ?? {})
    .filter((label) => !conditions.some((condition) => condition.label === label))
    .map((label, index) => ({
      id: `saved-${index}`,
      label,
      type:
        typeof entry.conditionResponses[label] === 'boolean'
          ? ('boolean' as const)
          : ('text' as const),
    }))
  return [...conditions, ...extra]
}
