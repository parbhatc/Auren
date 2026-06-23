import { getAuthToken, getWebSocketUrl } from '../../api/api'
import type { PracticeAccount } from '../../constants/practice'
import type { PracticePosition, PracticeTradeRecord } from '../../api/practice.api'

/**
 * Practice account WS — positions + balance only (no live prices).
 * Same four types in both directions except account_snapshot (server → client on connect).
 */
export type PracticeAccountWsEvent =
  | {
      type: 'account_snapshot'
      accountId: string
      account: PracticeAccount
      positions: PracticePosition[]
    }
  | {
      type: 'open_position'
      accountId: string
      account: PracticeAccount
      position: PracticePosition
    }
  | {
      type: 'modify_position'
      accountId: string
      account: PracticeAccount
      position: PracticePosition
    }
  | {
      type: 'close_position'
      accountId: string
      account: PracticeAccount
      positionId: string
      symbol?: string
      exitPrice?: number | null
      exitTime?: number | null
      reason?: 'stop_loss' | 'take_profit'
      trade?: PracticeTradeRecord & { id?: string }
    }

export type PracticeAccountWsHandlers = {
  onSnapshot?: (event: Extract<PracticeAccountWsEvent, { type: 'account_snapshot' }>) => void
  onOpenPosition?: (event: Extract<PracticeAccountWsEvent, { type: 'open_position' }>) => void
  onModifyPosition?: (event: Extract<PracticeAccountWsEvent, { type: 'modify_position' }>) => void
  onClosePosition?: (event: Extract<PracticeAccountWsEvent, { type: 'close_position' }>) => void
}

export type PracticeAccountWsClient = {
  openPosition: (position: Omit<PracticePosition, 'accountId'>) => void
  modifyPosition: (position: Omit<PracticePosition, 'accountId'>) => void
  closePosition: (payload: {
    positionId: string
    exitPrice?: number
    exitTime?: number
    fees?: number
    forcedExit?: boolean
  }) => void
  close: () => void
}

function sendJson(ws: WebSocket | null, payload: unknown): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  try {
    ws.send(JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function connectPracticeAccountWs(
  accountId: string,
  handlers: PracticeAccountWsHandlers
): PracticeAccountWsClient | null {
  const token = getAuthToken()
  if (!token || !accountId) return null

  const url =
    `${getWebSocketUrl('/practice-account-ws')}` +
    `?accountId=${encodeURIComponent(accountId)}` +
    `&token=${encodeURIComponent(token)}`

  let ws: WebSocket | null = new WebSocket(url)
  let closed = false

  const cleanup = () => {
    closed = true
    if (ws) {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      ws = null
    }
  }

  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(String(ev.data)) as PracticeAccountWsEvent
      switch (data.type) {
        case 'account_snapshot':
          handlers.onSnapshot?.(data)
          break
        case 'open_position':
          handlers.onOpenPosition?.(data)
          break
        case 'modify_position':
          handlers.onModifyPosition?.(data)
          break
        case 'close_position':
          handlers.onClosePosition?.(data)
          break
        default:
          break
      }
    } catch {
      /* ignore malformed */
    }
  }

  ws.onclose = () => {
    if (!closed) cleanup()
  }

  ws.onerror = () => {
    cleanup()
  }

  return {
    openPosition: (position) => {
      sendJson(ws, { type: 'open_position', position })
    },
    modifyPosition: (position) => {
      sendJson(ws, { type: 'modify_position', position })
    },
    closePosition: (payload) => {
      sendJson(ws, { type: 'close_position', ...payload })
    },
    close: cleanup,
  }
}
