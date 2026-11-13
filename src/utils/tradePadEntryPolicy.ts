import { getTradePadMicroOnly } from './tradePadSymbol'

export const MICRO_ONLY_ORDER_MESSAGE = 'Micro only allows new orders for MES and MNQ.'

export function isTradePadMicroContract(symbol: string): boolean {
  const ticker = symbol.split(':').pop()?.trim().toUpperCase() ?? ''
  return /^(MES|MNQ)(?:\d+!|[FGHJKMNQUVXZ]\d{1,4})?$/.test(ticker)
}

export function canEnterTradePadContract(accountId: string, symbol: string): boolean {
  return !getTradePadMicroOnly(accountId) || isTradePadMicroContract(symbol)
}
