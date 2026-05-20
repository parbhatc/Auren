import { toTradeseaDelayedTicker, toTradeseaProdTicker } from './tradeseaStreamSymbol'

/** True when MDS upstream is the delayed market data stream (sandbox). */
export function shouldUseDelayedMdsSymbols(config: {
  delayed?: boolean
  mdsStreamBase?: string
}): boolean {
  if (config.delayed) return true
  return /mds-stream-delayed/i.test(String(config.mdsStreamBase || ''))
}

/**
 * f:4 marketDepthDef only on delayed sandbox. Prod/Lucid DOM uses f:1 bidAskDef + f:6 + f:7 ttvDef.
 * Subscribing f:4 on prod yields 400-1 "full depth not allowed".
 */
export function shouldSubscribeMdsDepth(config: {
  delayed?: boolean
  mdsStreamBase?: string
}): boolean {
  return shouldUseDelayedMdsSymbols(config)
}

/** Wire ticker for MDS subscribe frames (`s` array). */
export function resolveMdsSubscribeTicker(symbol: string, useDelayed: boolean): string {
  const trimmed = String(symbol || '').trim()
  if (!trimmed) return useDelayed ? 'CME-Delayed:NQ' : 'CME:NQ'
  return useDelayed ? toTradeseaDelayedTicker(trimmed) : toTradeseaProdTicker(trimmed)
}
