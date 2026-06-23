/** Fan-out practice account WS events to trade-page clients (no live prices). */

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const listenersByKey = new Map()

function roomKey(userId, accountId) {
  return `${userId}:${accountId}`
}

export function subscribePracticeAccountFeed(userId, accountId, ws) {
  const key = roomKey(userId, accountId)
  let set = listenersByKey.get(key)
  if (!set) {
    set = new Set()
    listenersByKey.set(key, set)
  }
  set.add(ws)
  return () => {
    set.delete(ws)
    if (set.size === 0) listenersByKey.delete(key)
  }
}

export function broadcastPracticeAccountEvent(userId, accountId, payload) {
  const set = listenersByKey.get(roomKey(userId, accountId))
  if (!set?.size) return
  const raw = JSON.stringify(payload)
  for (const ws of set) {
    if (ws.readyState !== 1) continue
    try {
      ws.send(raw)
    } catch {
      /* ignore */
    }
  }
}

export function broadcastAccountSnapshot(ws, accountId, account, positions) {
  safeSendWs(ws, { type: 'account_snapshot', accountId, account, positions })
}

function safeSendWs(ws, payload) {
  if (ws.readyState !== 1) return
  try {
    ws.send(JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function broadcastOpenPosition(userId, accountId, account, position) {
  broadcastPracticeAccountEvent(userId, accountId, {
    type: 'open_position',
    accountId,
    account,
    position,
  })
}

export function broadcastModifyPosition(userId, accountId, account, position) {
  broadcastPracticeAccountEvent(userId, accountId, {
    type: 'modify_position',
    accountId,
    account,
    position,
  })
}

export function broadcastClosePosition(userId, accountId, payload) {
  broadcastPracticeAccountEvent(userId, accountId, {
    type: 'close_position',
    accountId,
    ...payload,
  })
}
