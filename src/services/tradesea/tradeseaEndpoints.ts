import { getApiBaseUrl } from '../../api/api'

/** Public delayed instruments catalog origin (reference). */
export const TRADESEA_DELAYED_INSTRUMENTS_ORIGIN = 'https://api-instruments-delayed.tradesea.ai'

const INSTRUMENTS_ALL_SYMBOLS_PATH = '/v1/all/symbols'

function instrumentsProxyBase(accountId: string): string {
  const base = getApiBaseUrl().replace(/\/$/, '')
  return `${base}/tradesea/proxy/instruments`
}

/** Instruments catalog via Nexus API (works with Vite `/api` proxy and production). */
export function tradeseaInstrumentsAllSymbolsUrl(accountId: string): string {
  const params = new URLSearchParams({ accountId })
  return `${instrumentsProxyBase(accountId)}${INSTRUMENTS_ALL_SYMBOLS_PATH}?${params.toString()}`
}

export function tradeseaInstrumentsSearchUrl(accountId: string, query: string): string {
  const params = new URLSearchParams({ accountId, query })
  return `${instrumentsProxyBase(accountId)}/v1/search?${params.toString()}`
}

/** @deprecated use tradeseaInstrumentsAllSymbolsUrl(accountId) */
export const TRADESEA_INSTRUMENTS_ALL_SYMBOLS_URL = `${TRADESEA_DELAYED_INSTRUMENTS_ORIGIN}${INSTRUMENTS_ALL_SYMBOLS_PATH}`
