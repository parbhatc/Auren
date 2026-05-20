import { TradeseaAccount } from '../../api/tradesea.api'
import { TradeseaTradeOrder } from './tradeseaTradesMessages'
import { TradeseaPosition } from './tradeseaPositions'

/** Keys used to match WS `accountId` on orders, positions, and fullStates rows. */
export function buildTradeseaWsAccountKeys(
  account: TradeseaAccount | null | undefined,
  options?: {
    orders?: TradeseaTradeOrder[]
    positions?: TradeseaPosition[] | unknown[]
  }
): string[] {
  const keys = new Set<string>()

  const add = (value: unknown) => {
    const s = String(value ?? '').trim()
    if (s) keys.add(s)
  }

  add(account?.id)
  add(account?.externalAccountId)
  add(account?.userId)
  add(account?.name)
  add(account?.externalUserId)

  for (const order of options?.orders ?? []) {
    add(order.accountId)
  }

  for (const row of options?.positions ?? []) {
    if (!row || typeof row !== 'object') continue
    const p = row as Record<string, unknown>
    add(p.accountId)
  }

  return [...keys]
}

export function wsRowMatchesAccount(
  rowAccountId: string | undefined,
  accountKeys: string[]
): boolean {
  const id = String(rowAccountId ?? '').trim()
  if (!id) return false
  if (accountKeys.includes(id)) return true
  return accountKeys.some((key) => key && (id.includes(key) || key.includes(id)))
}
