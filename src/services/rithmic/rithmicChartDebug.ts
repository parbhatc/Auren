/**
 * Rithmic chart console debug (matches rithmic-api live-chart.js style).
 * Enable: localStorage rithmic_chart_debug=1 or rithmicChartDebug(true) in DevTools.
 */

const STORAGE_KEY = 'rithmic_chart_debug'

export function isRithmicChartDebug(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === '1' || v === 'true'
  } catch {
    return false
  }
}

export function setRithmicChartDebug(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  console.info(
    `[Rithmic chart] debug ${enabled ? 'ON' : 'OFF'} — localStorage.${STORAGE_KEY}=${enabled ? '1' : '0'}`,
  )
}

declare global {
  interface Window {
    rithmicChartDebug?: (enabled?: boolean) => boolean
  }
}

if (typeof window !== 'undefined') {
  window.rithmicChartDebug = (enabled?: boolean) => {
    const next = enabled ?? !isRithmicChartDebug()
    setRithmicChartDebug(next)
    return next
  }
}

const fmtPrice = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toFixed(2)
const fmtQty = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? '—' : String(n)

export function fmtRithmicTime(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(Number(sec))) return '—'
  const s = Number(sec)
  const ms = s > 1e12 ? s : s * 1000
  return new Date(ms).toLocaleString()
}

export function logRithmicQuote(sym: string, q: { bid?: number; ask?: number; bidSize?: number; askSize?: number }): void {
  if (!isRithmicChartDebug()) return
  console.log(
    `[Rithmic] ${sym}  Bid ${fmtPrice(q.bid)} x ${fmtQty(q.bidSize)}  |  Ask ${fmtPrice(q.ask)} x ${fmtQty(q.askSize)}`,
  )
}

export function logRithmicTrade(
  sym: string,
  t: { price?: number; size?: number; side?: string },
): void {
  if (!isRithmicChartDebug()) return
  const sideLabel = t.side ? `  ${t.side}` : ''
  console.log(`[Rithmic] ${sym}  Last ${fmtPrice(t.price)} x ${fmtQty(t.size)}${sideLabel}`)
}

export function logRithmicBar(
  sym: string,
  b: { time: number; close: number; volume?: number; resolution?: string },
): void {
  if (!isRithmicChartDebug()) return
  const res = b.resolution ? ` [${b.resolution}]` : ''
  console.log(
    `[Rithmic] ${sym}${res}  Bar ${fmtRithmicTime(b.time)}  close ${fmtPrice(b.close)}  vol ${fmtQty(b.volume)}`,
  )
}

export function logRithmicHistory(
  sym: string,
  bars: { time: number; close: number }[],
  meta?: { from?: number; to?: number; resolution?: string },
): void {
  if (!isRithmicChartDebug()) return
  const res = meta?.resolution ? ` res=${meta.resolution}` : ''
  console.log(`[Rithmic] History ${sym}${res}: ${bars.length} bars`, meta ?? '')
  if (!bars.length) return
  const first = bars[0]!
  const last = bars[bars.length - 1]!
  console.log(`[Rithmic]   first: ${fmtRithmicTime(first.time)}  close ${fmtPrice(first.close)}`)
  console.log(`[Rithmic]   last:  ${fmtRithmicTime(last.time)}  close ${fmtPrice(last.close)}`)
}

export function logRithmicLatestHighLow(
  sym: string,
  row: { high?: number; low?: number },
): void {
  if (!isRithmicChartDebug()) return
  console.log(`[Rithmic] ${sym}  latest_high_low  high ${fmtPrice(row.high)}  low ${fmtPrice(row.low)}`)
}

export function logRithmicLatestClose(
  sym: string,
  row: { close?: number; settlement?: number; price_type?: string; close_date?: string; settlement_date?: string },
): void {
  if (!isRithmicChartDebug()) return
  const type = row.price_type ? `  (${row.price_type})` : ''
  console.log(
    `[Rithmic] ${sym}  latest_close  ${row.close_date ?? '—'}  ${fmtPrice(row.close)}  settlement ${row.settlement_date ?? '—'}  ${fmtPrice(row.settlement)}${type}`,
  )
}

export function logRithmicChartDebug(label: string, detail?: Record<string, unknown>): void {
  if (!isRithmicChartDebug()) return
  console.log(`[Rithmic] ${label}`, detail ?? '')
}
