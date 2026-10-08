const DEFAULT_RESOLUTION = '1'

export function normalizeChartResolution(value: unknown): string {
  const raw = String(value ?? '').trim().toUpperCase()
  if (!raw) return DEFAULT_RESOLUTION
  if (/^\d+$/.test(raw)) return String(Math.max(1, Number(raw)))
  if (/^\d+S$/.test(raw)) return `${Math.max(1, Number(raw.slice(0, -1)))}S`
  if (/^\d+H$/.test(raw)) return `${Math.max(1, Number(raw.slice(0, -1)))}H`
  if (/^\d+[DWM]$/.test(raw)) return raw
  if (raw === 'D') return '1D'
  if (raw === 'W') return '1W'
  if (raw === 'M') return '1M'
  return DEFAULT_RESOLUTION
}

export function chartResolutionToMs(value: unknown): number {
  const resolution = normalizeChartResolution(value)
  const amount = Math.max(1, Number.parseInt(resolution, 10) || 1)
  if (resolution.endsWith('S')) return amount * 1_000
  if (resolution.endsWith('H')) return amount * 60 * 60_000
  if (resolution.endsWith('D')) return amount * 24 * 60 * 60_000
  if (resolution.endsWith('W')) return amount * 7 * 24 * 60 * 60_000
  if (resolution.endsWith('M')) return amount * 30 * 24 * 60 * 60_000
  return amount * 60_000
}

export function formatChartResolution(value: unknown): string {
  const resolution = normalizeChartResolution(value)
  const amount = Math.max(1, Number.parseInt(resolution, 10) || 1)
  if (resolution.endsWith('S')) return `${amount}-second`
  if (resolution.endsWith('H')) return `${amount}-hour`
  if (resolution.endsWith('D')) return `${amount}-day`
  if (resolution.endsWith('W')) return `${amount}-week`
  if (resolution.endsWith('M')) return `${amount}-month`
  return `${amount}-minute`
}
