/** TradingView chart interval values (data-value) grouped like the TV interval picker. */
export interface CsvTimeframeOption {
  value: string
  label: string
}

export interface CsvTimeframeGroup {
  label: string
  options: CsvTimeframeOption[]
}

export const CSV_TIMEFRAME_GROUPS: CsvTimeframeGroup[] = [
  {
    label: 'Ticks',
    options: [
      { value: '1T', label: '1 tick' },
      { value: '10T', label: '10 ticks' },
      { value: '100T', label: '100 ticks' },
      { value: '1000T', label: '1000 ticks' },
    ],
  },
  {
    label: 'Seconds',
    options: [
      { value: '1S', label: '1 second' },
      { value: '5S', label: '5 seconds' },
      { value: '10S', label: '10 seconds' },
      { value: '15S', label: '15 seconds' },
      { value: '30S', label: '30 seconds' },
      { value: '45S', label: '45 seconds' },
    ],
  },
  {
    label: 'Minutes',
    options: [
      { value: '1', label: '1 minute' },
      { value: '2', label: '2 minutes' },
      { value: '3', label: '3 minutes' },
      { value: '5', label: '5 minutes' },
      { value: '10', label: '10 minutes' },
      { value: '15', label: '15 minutes' },
      { value: '30', label: '30 minutes' },
      { value: '45', label: '45 minutes' },
    ],
  },
  {
    label: 'Hours',
    options: [
      { value: '60', label: '1 hour' },
      { value: '120', label: '2 hours' },
      { value: '180', label: '3 hours' },
      { value: '240', label: '4 hours' },
    ],
  },
  {
    label: 'Days',
    options: [
      { value: '1D', label: '1 day' },
      { value: '1W', label: '1 week' },
      { value: '1M', label: '1 month' },
      { value: '3M', label: '3 months' },
      { value: '6M', label: '6 months' },
      { value: '12M', label: '12 months' },
    ],
  },
  {
    label: 'Ranges',
    options: [
      { value: '1R', label: '1 range' },
      { value: '10R', label: '10 ranges' },
      { value: '100R', label: '100 ranges' },
      { value: '1000R', label: '1000 ranges' },
    ],
  },
]

export const CSV_TIMEFRAME_OPTIONS: CsvTimeframeOption[] = CSV_TIMEFRAME_GROUPS.flatMap((g) => g.options)

export const DEFAULT_CSV_CHART_RESOLUTION = '1'

/** Chart interval → on-disk CSV folder name. */
export function chartResolutionToCsvFolder(chartResolution: string): string {
  const raw = String(chartResolution ?? '').trim()
  if (!raw) return '1m'

  const upper = raw.toUpperCase()

  const tickMatch = upper.match(/^(\d+)T$/)
  if (tickMatch) return `${tickMatch[1]}t`

  const rangeMatch = upper.match(/^(\d+)R$/)
  if (rangeMatch) return `${rangeMatch[1]}r`

  const secLower = raw.match(/^(\d+)s$/)
  if (secLower) return `${secLower[1]}s`

  if (/^\d+S$/.test(upper)) return `${parseInt(upper.slice(0, -1), 10)}s`

  if (raw === '1m') return '1m'

  return '1m'
}

export function csvFolderToChartResolution(csvFolder: string): string {
  if (csvFolder === '1m') return '1'
  const sec = csvFolder.match(/^(\d+)s$/i)
  if (sec) return `${sec[1]}S`
  const tick = csvFolder.match(/^(\d+)t$/i)
  if (tick) return `${tick[1]}T`
  const range = csvFolder.match(/^(\d+)r$/i)
  if (range) return `${range[1]}R`
  return '1'
}

export function timeframeLabel(chartResolution: string): string {
  const found = CSV_TIMEFRAME_OPTIONS.find((o) => o.value === chartResolution)
  if (found) return found.label
  if (chartResolution === '1m') return '1 minute'
  const sec = chartResolution.match(/^(\d+)s$/i)
  if (sec) return `${sec[1]} sec`
  return chartResolution
}
