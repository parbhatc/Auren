import { getApiBaseUrl, getAuthHeaders } from '../../api/api'

export type UdfHistoryPayload = {
  s?: string
  t?: number[]
  o?: number[]
  h?: number[]
  l?: number[]
  c?: number[]
  v?: number[]
}

/** On only when `localStorage auren.debug.candles === '1'`. Off by default (including dev). */
export function isCandleDebugCaptureEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('auren.debug.candles') === '1'
}

let lastSaveKey = ''
let lastSaveAt = 0
const MIN_SAVE_INTERVAL_MS = 2000

/**
 * Persist a TradingView history (UDF) chunk on the API server for offline FVG debugging.
 */
export async function saveLoadedCandlesChunk(options: {
  symbol: string
  resolution: string
  from: number
  to: number
  udf: UdfHistoryPayload
  note?: string
}): Promise<void> {
  if (!isCandleDebugCaptureEnabled()) return

  const barCount = options.udf.t?.length ?? 0
  if (barCount === 0) return

  const saveKey = `${options.symbol}|${options.resolution}|${options.from}|${options.to}|${barCount}`
  const now = Date.now()
  if (saveKey === lastSaveKey && now - lastSaveAt < MIN_SAVE_INTERVAL_MS) return
  lastSaveKey = saveKey
  lastSaveAt = now

  try {
    const res = await fetch(`${getApiBaseUrl()}/debug/candles/chunk`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        symbol: options.symbol,
        resolution: options.resolution,
        from: options.from,
        to: options.to,
        udf: options.udf,
        note: options.note,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.warn('[candle-debug] save failed:', data?.message || res.status)
      return
    }
    console.info(
      `[candle-debug] saved ${options.symbol} ${options.resolution} → ${data.slug} (${data.barCount} bars merged, ${data.chunkCount} chunks)`
    )
  } catch (err) {
    console.warn('[candle-debug] save error:', err)
  }
}

/** Import several UDF payloads at once (e.g. paste from Network tab). */
export async function importCandleDebugPaste(
  symbol: string,
  resolution: string,
  payloads: UdfHistoryPayload[],
  replace = true
): Promise<unknown> {
  const chunks = payloads.map((udf, i) => ({
    udf,
    from: udf.t?.[0],
    to: udf.t?.length ? udf.t[udf.t.length - 1] : undefined,
    note: `paste-${i + 1}`,
  }))
  const res = await fetch(`${getApiBaseUrl()}/debug/candles/import`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ symbol, resolution, chunks, replace }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || `import failed (${res.status})`)
  console.info('[candle-debug] import ok', data)
  return data
}

/** Expose on window for manual import / inspection in devtools. */
export function registerCandleDebugGlobals(): void {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return
  const w = window as Window & {
    saveCandleDebugChunk?: typeof saveLoadedCandlesChunk
    importCandleDebugPaste?: typeof importCandleDebugPaste
    listCandleDebugSnapshots?: () => Promise<unknown>
  }
  w.saveCandleDebugChunk = saveLoadedCandlesChunk
  w.importCandleDebugPaste = importCandleDebugPaste
  w.listCandleDebugSnapshots = async () => {
    const res = await fetch(`${getApiBaseUrl()}/debug/candles`, {
      headers: { ...getAuthHeaders(), Accept: 'application/json' },
    })
    const data = await res.json()
    console.table(data.snapshots)
    return data
  }
}
