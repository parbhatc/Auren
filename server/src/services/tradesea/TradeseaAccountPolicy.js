/** Tradesea accounts supported in Nexus (sandbox / sandbox-2 + Lucid). */

export const TRADESEA_DELAYED = {
  MDS_STREAM: 'wss://api-mds-stream-delayed.tradesea.ai/v1/wss',
  UDF: 'https://api-udf-delayed.tradesea.ai/v1',
  INSTRUMENTS: 'https://api-instruments-delayed.tradesea.ai',
}

export const TRADESEA_PROD = {
  MDS_STREAM: 'wss://prod-market-data.tradesea.ai/v1/wss',
  UDF: 'https://prod-market-data.tradesea.ai/v1',
}

/** RD / sandbox-2 / delayed accounts (matches app: accountType === "RD") */
export const TRADESEA_TRADES_DELPROD = {
  TRADE_READ: 'https://api-trades-r-delprod.tradesea.ai/v1',
  TRADE_WRITE: 'https://api-trades-w-delprod.tradesea.ai/v1',
}

/** Live / non-delayed accounts (non-Lucid brokers) */
export const TRADESEA_TRADES_PROD = {
  TRADE_READ: 'https://api-trades-r.tradesea.ai/v1',
  TRADE_WRITE: 'https://api-trades-w.tradesea.ai/v1',
}

/** Lucid live funded accounts (prod market data + prod trade write/read) */
export const TRADESEA_TRADES_LIVE = {
  TRADE_READ: 'https://prod-trade-read.tradesea.ai/v1',
  TRADE_WRITE: 'https://prod-trade-write.tradesea.ai/v1',
}

/** @deprecated use TRADESEA_TRADES_LIVE */
export const TRADESEA_LUCID_TRADES = TRADESEA_TRADES_LIVE

export function isSandboxAccount(account) {
  if (!account) return false
  const firm = String(account.propFirm || '').toLowerCase()
  return firm === 'sandbox' || firm === 'sandbox-2'
}

export function isLucidAccount(account) {
  if (!account) return false
  const firm = String(account.propFirm || '').toLowerCase()
  const display = String(account.propFirmDisplayName || '').toLowerCase()
  return firm.includes('lucid') || display.includes('lucid')
}

export function isSupportedTradeseaAccount(account) {
  return isSandboxAccount(account) || isLucidAccount(account)
}

/** Sandbox-2 / RD use delayed MDS+UDF; Lucid uses prod market data (see getStreamEndpoints). */
export function usesDelayedMarketData(account) {
  if (isLucidAccount(account)) return false
  return account?.accountType === 'RD' || isSandboxAccount(account)
}

/** Delayed trades REST (sandbox + RD). Lucid live uses TRADESEA_TRADES_LIVE. */
export function isDelayedTradeseaAccount(account) {
  return usesDelayedMarketData(account)
}

export function pickDefaultAccountId(accounts) {
  const sandbox = accounts.find((a) => isSandboxAccount(a))
  if (sandbox) return sandbox.id
  const lucid = accounts.find((a) => isLucidAccount(a))
  if (lucid) return lucid.id
  return accounts[0]?.id || null
}

export function getTradesRestOrigins(account) {
  if (isDelayedTradeseaAccount(account)) return TRADESEA_TRADES_DELPROD
  if (isLucidAccount(account)) return TRADESEA_TRADES_LIVE
  return TRADESEA_TRADES_PROD
}

/** User-data unified WS: wss://…/v1/users/{account.id}/ws/unified */
export function buildTradesUnifiedWsUrl(account) {
  if (!account?.id) return null
  const readOrigin = getTradesRestOrigins(account).TRADE_READ
  if (!readOrigin) return null
  const parsed = new URL(readOrigin)
  const pathBase = parsed.pathname.replace(/\/$/, '')
  return `wss://${parsed.host}${pathBase}/users/${encodeURIComponent(account.id)}/ws/unified`
}

export function getStreamEndpoints(account) {
  const lucid = isLucidAccount(account)
  const delayedMd = usesDelayedMarketData(account)
  const trades = getTradesRestOrigins(account)

  return {
    mode: lucid ? 'lucid' : 'sandbox',
    /** When false, client uses prod MDS/UDF (CME:NQ) — required for Lucid. */
    delayed: delayedMd,
    mdsStreamBase: (delayedMd ? TRADESEA_DELAYED.MDS_STREAM : TRADESEA_PROD.MDS_STREAM).replace(
      /\/$/,
      ''
    ),
    udfOrigin: delayedMd ? TRADESEA_DELAYED.UDF : TRADESEA_PROD.UDF,
    /** Symbol catalog (pip/tick metadata); same host for sandbox + Lucid — client maps prod tickers when !delayedMd */
    instrumentsOrigin: TRADESEA_DELAYED.INSTRUMENTS,
    tradesReadOrigin: trades.TRADE_READ,
    tradesWriteOrigin: trades.TRADE_WRITE,
  }
}
