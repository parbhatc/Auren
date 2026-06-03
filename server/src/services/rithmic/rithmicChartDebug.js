import { rithmicEnvFlag } from './rithmicDebug.js'

/** Live chart debug (history + quote/trade/bar). Enable: RITHMIC_CHART_DEBUG=1 in server/.env */
export function isRithmicChartDebug() {
  return rithmicEnvFlag('RITHMIC_CHART_DEBUG')
}

const fmtPrice = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toFixed(2))
const fmtQty = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : String(n))

export function fmtRithmicTime(sec) {
  if (sec == null || !Number.isFinite(Number(sec))) return '—'
  const s = Number(sec)
  const ms = s > 1e12 ? s : s * 1000
  return new Date(ms).toLocaleString()
}

export function logRithmicQuote(q, symbol) {
  if (!isRithmicChartDebug()) return
  const sym = q?.symbol ?? symbol ?? '?'
  console.log(
    `[Rithmic] ${sym}  Bid ${fmtPrice(q?.bid)} x ${fmtQty(q?.bid_size)}  |  Ask ${fmtPrice(q?.ask)} x ${fmtQty(q?.ask_size)}`,
  )
}

export function logRithmicTrade(t, symbol) {
  if (!isRithmicChartDebug()) return
  const sym = t?.symbol ?? symbol ?? '?'
  const side =
    t?.aggressor === 1 || t?.aggressor === 'BUY'
      ? 'Buy'
      : t?.aggressor === 2 || t?.aggressor === 'SELL'
        ? 'Sell'
        : null
  const sideLabel = side ? `  ${side}` : ''
  console.log(
    `[Rithmic] ${sym}  Last ${fmtPrice(t?.price)} x ${fmtQty(t?.size)}${sideLabel}`,
  )
}

export function logRithmicBar(b, symbol) {
  if (!isRithmicChartDebug()) return
  const sym = b?.symbol ?? symbol ?? '?'
  console.log(
    `[Rithmic] ${sym}  Bar ${fmtRithmicTime(b?.marker)}  close ${fmtPrice(b?.close)}  vol ${fmtQty(b?.volume)}`,
  )
}

export function logRithmicLatestHighLow(row, symbol) {
  if (!isRithmicChartDebug()) return
  const sym = row?.symbol ?? symbol ?? '?'
  console.log(`[Rithmic] ${sym}  latest_high_low  high ${fmtPrice(row?.high_price)}  low ${fmtPrice(row?.low_price)}`)
}

export function logRithmicLatestClose(row, symbol) {
  if (!isRithmicChartDebug()) return
  const sym = row?.symbol ?? symbol ?? '?'
  const close = row?.close_price ?? row?.close
  const settlement = row?.settlement_price ?? row?.settlement
  const type = row?.price_type ? `  (${row.price_type})` : ''
  console.log(
    `[Rithmic] ${sym}  latest_close  ${row?.close_date ?? '—'}  ${fmtPrice(close)}  settlement ${row?.settlement_date ?? '—'}  ${fmtPrice(settlement)}${type}`,
  )
}

export function logRithmicHistory(symbol, bars) {
  if (!isRithmicChartDebug()) return
  const sym = symbol ?? '?'
  console.log(`[Rithmic] History ${sym}: ${bars?.length ?? 0} bars`)
  if (!bars?.length) return
  const first = bars[0]
  const last = bars[bars.length - 1]
  console.log(`[Rithmic]   first: ${fmtRithmicTime(first?.marker)}  close ${fmtPrice(first?.close)}`)
  console.log(`[Rithmic]   last:  ${fmtRithmicTime(last?.marker)}  close ${fmtPrice(last?.close)}`)
}

export function logRithmicChartDebug(label, detail) {
  if (!isRithmicChartDebug()) return
  console.log(`[Rithmic] ${label}`, detail ?? '')
}
