import { chartSymbolToProductRoot } from '../tradesea/tradeseaSymbolInfo'

const MINI_TO_MICRO: Record<string, string> = {
  NQ: 'MNQ',
  ES: 'MES',
  YM: 'MYM',
  RTY: 'M2K',
  GC: 'MGC',
  CL: 'MCL',
}

const MICRO_TO_MINI = Object.fromEntries(
  Object.entries(MINI_TO_MICRO).map(([mini, micro]) => [micro, mini])
) as Record<string, string>

export function practiceContractRoot(symbol: string): string {
  return chartSymbolToProductRoot(symbol).toUpperCase()
}

export function practiceMiniRoot(symbol: string): string {
  const root = practiceContractRoot(symbol)
  return MICRO_TO_MINI[root] ?? root
}

export function practiceMicroRoot(symbol: string): string | null {
  const root = practiceContractRoot(symbol)
  if (MICRO_TO_MINI[root]) return root
  return MINI_TO_MICRO[root] ?? null
}

export function isPracticeContractFamilyMatch(a: string, b: string): boolean {
  return Boolean(a && b && practiceMiniRoot(a) === practiceMiniRoot(b))
}

export function practiceMicroEquivalent(symbol: string, contracts: number): number {
  const root = practiceContractRoot(symbol)
  return contracts * (MICRO_TO_MINI[root] ? 1 : MINI_TO_MICRO[root] ? 10 : 1)
}

export type PracticeFamilyPosition = {
  symbol: string
  contracts: number
}

export type PracticePositionFamilySummary = {
  miniSymbol: string
  microSymbol: string | null
  positions: PracticeFamilyPosition[]
  microEquivalent: number
  miniEquivalent: number
}

export function summarizePracticePositionFamily(
  chartSymbol: string,
  positions: PracticeFamilyPosition[]
): PracticePositionFamilySummary | null {
  const miniSymbol = practiceMiniRoot(chartSymbol)
  const microSymbol = practiceMicroRoot(miniSymbol)
  const related = positions.filter(
    (position) => position.contracts !== 0 && practiceMiniRoot(position.symbol) === miniSymbol
  )
  if (!related.length) return null
  const microEquivalent = related.reduce(
    (total, position) => total + practiceMicroEquivalent(position.symbol, position.contracts),
    0
  )
  return {
    miniSymbol,
    microSymbol,
    positions: related.map((position) => ({
      symbol: practiceContractRoot(position.symbol),
      contracts: position.contracts,
    })),
    microEquivalent,
    miniEquivalent: microSymbol ? microEquivalent / 10 : microEquivalent,
  }
}

export function formatPracticePositionFamily(summary: PracticePositionFamilySummary): string {
  const terms = summary.positions.map((position, index) => {
    const amount = Math.abs(position.contracts)
    const sign = position.contracts < 0 ? '−' : index > 0 ? '+' : ''
    return `${sign}${amount} ${position.symbol}`
  })
  if (!summary.microSymbol) return terms.join(' ')
  const microLabel = summary.microSymbol ?? summary.miniSymbol
  return `${terms.join(' ')} = ${summary.miniEquivalent.toLocaleString()} ${summary.miniSymbol} (${summary.microEquivalent.toLocaleString()} ${microLabel})`
}
