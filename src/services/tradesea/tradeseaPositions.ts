export interface TradeseaPosition {
  id: string
  instrument?: string
  qty?: number
  side?: string
  avgPrice?: number
  stopLoss?: number
  takeProfit?: number
  unrealizedPl?: number
  accountId?: string
}

function normalizeInstrumentKey(value: string): string {
  const t = String(value || '')
    .trim()
    .replace(/-DELAYED:/gi, '-Delayed:')
    .toUpperCase()
  if (!t) return ''
  return t
}

function readNumber(...values: unknown[]): number | undefined {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v.replace(/,/g, ''))
      if (Number.isFinite(n)) return n
    }
  }
  return undefined
}

export function instrumentsMatch(a: string, b: string): boolean {
  const keyA = normalizeInstrumentKey(a)
  const keyB = normalizeInstrumentKey(b)
  if (!keyA || !keyB) return false
  if (keyA === keyB) return true
  const tail = (s: string) => (s.includes(':') ? s.split(':').pop()! : s)
  return tail(keyA) === tail(keyB)
}

export function parseTradeseaPosition(row: unknown): TradeseaPosition | null {
  if (!row || typeof row !== 'object') return null
  const p = row as Record<string, unknown>
  const id = String(p.id || p.positionId || p.position_id || '').trim()
  if (!id) return null

  const rawQty = readNumber(p.qty, p.quantity, p.size, p.netQty, p.openQty)
  let sideRaw = p.side != null ? String(p.side).toLowerCase() : ''
  let qty = rawQty
  if (qty != null && qty < 0) {
    if (!sideRaw) sideRaw = 'sell'
    qty = Math.abs(qty)
  }

  return {
    id,
    instrument: String(p.instrument || p.symbol || '').trim() || undefined,
    qty,
    side: sideRaw || undefined,
    avgPrice: readNumber(
      p.avgPrice,
      p.avg_price,
      p.averagePrice,
      p.average_price,
      p.netPrice,
      p.net_price,
      p.entryPrice,
      p.entry_price,
      p.price,
      p.openPrice,
      p.open_price
    ),
    stopLoss: readNumber(p.stopLoss, p.stop_loss),
    takeProfit: readNumber(p.takeProfit, p.take_profit),
    unrealizedPl: readNumber(
      p.unrealizedPl,
      p.unrealized_pl,
      p.upl,
      p.openPnl,
      p.open_pnl,
      p.profit,
      p.unrealizedProfit
    ),
    accountId: p.accountId != null ? String(p.accountId) : undefined,
  }
}

export function findPositionsForInstrument(
  positions: unknown[] | undefined,
  instrument: string
): TradeseaPosition[] {
  if (!Array.isArray(positions) || !instrument) return []
  const target = normalizeInstrumentKey(instrument)
  const tail = target.includes(':') ? target.split(':').pop()! : target

  const out: TradeseaPosition[] = []
  for (const row of positions) {
    const pos = parseTradeseaPosition(row)
    if (!pos?.instrument) continue
    const key = normalizeInstrumentKey(pos.instrument)
    const posTail = key.includes(':') ? key.split(':').pop()! : key
    if (key === target || posTail === tail) {
      out.push(pos)
    }
  }
  return out
}
