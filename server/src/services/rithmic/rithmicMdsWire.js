import { findRithmicSymbol } from './RithmicSymbolsService.js'

/** Chart-style symbol label, e.g. CME:NQ */
export function formatChartSymbol(exchange, symbol) {
  const raw = String(symbol || '').trim().toUpperCase()
  if (raw.includes(':')) return raw
  const ex = String(exchange || 'CME').trim().toUpperCase()
  return `${ex}:${raw}`
}

export function parseSubscribeMessage(msg) {
  const parsed = parseClientSymbol(msg.symbol || msg.ticker)
  if (!parsed?.symbol) return null
  const exchange = String(msg.exchange || parsed.exchange || 'CME').trim().toUpperCase()
  const resolution = String(msg.resolution || '1')
  const chartSymbol = formatChartSymbol(exchange, parsed.symbol)
  return { chartSymbol, symbol: parsed.symbol, exchange, resolution }
}

function parseClientSymbol(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  const catalog = findRithmicSymbol(raw)
  if (catalog) {
    return {
      symbol: catalog.symbol,
      exchange: catalog.exchange || 'CME',
    }
  }
  if (raw.includes(':')) {
    const [exchange, symbol] = raw.split(':')
    return {
      exchange: (exchange || 'CME').trim().toUpperCase(),
      symbol: (symbol || '').trim().toUpperCase(),
    }
  }
  return { symbol: raw.toUpperCase(), exchange: 'CME' }
}

function quoteTime(quote) {
  const ssboe = Number(quote?.ssboe)
  if (Number.isFinite(ssboe) && ssboe > 0) return ssboe
  const updated = Number(quote?.updated_at)
  if (Number.isFinite(updated) && updated > 0) {
    return updated > 1e12 ? Math.floor(updated / 1000) : updated
  }
  return Math.floor(Date.now() / 1000)
}

export function formatQuoteWire(quote, chartSymbol) {
  const payload = {
    type: 'quote',
    symbol: chartSymbol,
    time: quoteTime(quote),
  }
  if (quote?.bid != null && Number.isFinite(Number(quote.bid))) {
    payload.bid = {
      price: Number(quote.bid),
      size: Number(quote.bid_size ?? 0),
    }
  }
  if (quote?.ask != null && Number.isFinite(Number(quote.ask))) {
    payload.ask = {
      price: Number(quote.ask),
      size: Number(quote.ask_size ?? 0),
    }
  }
  return payload
}

/** Rithmic LastTrade aggressor → display side (matches live-chart.js). */
export function resolveTradeSide(aggressor) {
  if (aggressor === 1 || aggressor === 'BUY') return 'Buy'
  if (aggressor === 2 || aggressor === 'SELL') return 'Sell'
  return null
}

export function formatUpdateWire(trade, chartSymbol) {
  const payload = {
    type: 'update',
    symbol: chartSymbol,
    time: quoteTime(trade),
  }
  if (trade?.price != null && Number.isFinite(Number(trade.price))) {
    payload.price = Number(trade.price)
  }
  if (trade?.size != null && Number.isFinite(Number(trade.size))) {
    payload.size = Number(trade.size)
  }
  if (trade?.volume != null && Number.isFinite(Number(trade.volume))) {
    payload.volume = Number(trade.volume)
  }
  const side = resolveTradeSide(trade?.aggressor)
  if (side) payload.side = side
  else if (trade?.aggressor != null && trade.aggressor !== '') {
    payload.aggressor = trade.aggressor
  }
  return payload
}

export function formatLatestHighLowWire(row, chartSymbol) {
  return {
    type: 'latest_high_low',
    symbol: chartSymbol,
    time: quoteTime(row),
    high: row?.high_price != null ? Number(row.high_price) : undefined,
    low: row?.low_price != null ? Number(row.low_price) : undefined,
  }
}

export function formatLatestCloseWire(row, chartSymbol) {
  const payload = {
    type: 'latest_close',
    symbol: chartSymbol,
    time: quoteTime(row),
  }
  if (row?.close_price != null && Number.isFinite(Number(row.close_price))) {
    payload.close = Number(row.close_price)
    payload.close_date = row.close_date
  }
  if (row?.settlement_price != null && Number.isFinite(Number(row.settlement_price))) {
    payload.settlement = Number(row.settlement_price)
    payload.settlement_date = row.settlement_date
  }
  if (row?.price_type != null && row.price_type !== '') {
    payload.price_type = row.price_type
  }
  return payload
}

export function formatBarWire(bar, chartSymbol, resolution) {
  const marker = Number(bar?.marker)
  const time =
    Number.isFinite(marker) && marker > 0 ? (marker > 1e12 ? marker : marker * 1000) : Date.now()
  return {
    type: 'bar',
    symbol: chartSymbol,
    resolution: String(resolution || '1'),
    time,
    o: Number(bar.open),
    h: Number(bar.high),
    l: Number(bar.low),
    c: Number(bar.close),
    v: Number(bar.volume ?? 0),
  }
}
