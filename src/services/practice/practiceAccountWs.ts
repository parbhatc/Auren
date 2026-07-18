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
  | { type: 'mutation_ack'; mutationId: string }
  | { type: 'mutation_error'; mutationId?: string; message: string }

export type PracticeAccountWsHandlers = {
  onSnapshot?: (event: Extract<PracticeAccountWsEvent, { type: 'account_snapshot' }>) => void
  onOpenPosition?: (event: Extract<PracticeAccountWsEvent, { type: 'open_position' }>) => void
  onModifyPosition?: (event: Extract<PracticeAccountWsEvent, { type: 'modify_position' }>) => void
  onClosePosition?: (event: Extract<PracticeAccountWsEvent, { type: 'close_position' }>) => void
  onMutationError?: (message: string) => void
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
  if (!getAuthToken() || !accountId) return null

  type QueuedMutation = { mutationId: string; payload: Record<string, unknown> }
  const pending = new Map<string, QueuedMutation>()
  let ws: WebSocket | null = null
  let manuallyClosed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempt = 0
  let inFlightId: string | null = null
  let snapshotReady = false

  const mutationId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `pm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  const flushNext = () => {
    if (inFlightId || !snapshotReady || !ws || ws.readyState !== WebSocket.OPEN) return
    const next = pending.values().next().value as QueuedMutation | undefined
    if (!next) return
    if (sendJson(ws, { ...next.payload, mutationId: next.mutationId })) {
      inFlightId = next.mutationId
    }
  }

  const enqueue = (payload: Record<string, unknown>) => {
    const id = mutationId()
    pending.set(id, { mutationId: id, payload })
    flushNext()
  }

  const scheduleReconnect = () => {
    if (manuallyClosed || reconnectTimer) return
    const delay = Math.min(10_000, 250 * 2 ** Math.min(reconnectAttempt, 6))
    reconnectAttempt += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      openSocket()
    }, delay)
  }

  const openSocket = () => {
    if (manuallyClosed) return
    const token = getAuthToken()
    if (!token) {
      scheduleReconnect()
      return
    }
    const url =
      `${getWebSocketUrl('/practice-account-ws')}` +
      `?accountId=${encodeURIComponent(accountId)}` +
      `&token=${encodeURIComponent(token)}`
    const socket = new WebSocket(url)
    ws = socket

    socket.onopen = () => {
      if (ws !== socket) return
      reconnectAttempt = 0
      inFlightId = null
      snapshotReady = false
    }

    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as PracticeAccountWsEvent
        switch (data.type) {
          case 'account_snapshot':
            handlers.onSnapshot?.(data)
            snapshotReady = true
            flushNext()
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
          case 'mutation_ack':
            pending.delete(data.mutationId)
            if (inFlightId === data.mutationId) inFlightId = null
            flushNext()
            break
          case 'mutation_error':
            if (data.mutationId) pending.delete(data.mutationId)
            if (!data.mutationId || inFlightId === data.mutationId) inFlightId = null
            handlers.onMutationError?.(data.message)
            flushNext()
            break
          default:
            break
        }
      } catch {
        /* ignore malformed */
      }
    }

    socket.onclose = () => {
      if (ws === socket) ws = null
      inFlightId = null
      snapshotReady = false
      scheduleReconnect()
    }

    socket.onerror = () => {
      // Browsers follow an error with close; close is the single reconnect path.
    }
  }

  const cleanup = () => {
    manuallyClosed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    pending.clear()
    inFlightId = null
    snapshotReady = false
    if (ws) {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      ws = null
    }
  }

  openSocket()

  return {
    openPosition: (position) => {
      enqueue({ type: 'open_position', position })
    },
    modifyPosition: (position) => {
      enqueue({ type: 'modify_position', position })
    },
    closePosition: (payload) => {
      enqueue({ type: 'close_position', ...payload })
    },
    close: cleanup,
  }
}
