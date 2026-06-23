import WebSocket from 'ws'
import { URL } from 'url'
import WebSocketBase from './WebSocketBase.js'
import TokenService from '../services/TokenService.js'
import PracticeService from '../services/PracticeService.js'
import {
  subscribePracticeAccountFeed,
  broadcastAccountSnapshot,
} from '../services/practice/PracticeAccountHub.js'

/**
 * Practice sim account WS — positions + balance only (no live prices).
 * Types: account_snapshot | open_position | modify_position | close_position
 *
 * Client: ws://host/practice-account-ws?accountId=&token=
 */
class PracticeAccountWebSocket extends WebSocketBase {
  constructor() {
    super({
      serverName: 'PracticeAccount',
      path: '/practice-account-ws',
      enableHeartbeat: true,
    })
  }

  async handleConnection(clientWs, req) {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const accountId = url.searchParams.get('accountId')
    const token = url.searchParams.get('token')

    if (!accountId || !token) {
      clientWs.close(1008, 'accountId and token are required')
      return
    }

    const decoded = TokenService.verifyAuthToken(token)
    if (!decoded?.userId) {
      clientWs.close(1008, 'Invalid token')
      return
    }

    const account = await PracticeService.getAccount(decoded.userId, accountId)
    if (!account) {
      clientWs.close(1008, 'Account not found')
      return
    }

    const unsubscribe = subscribePracticeAccountFeed(decoded.userId, accountId, clientWs)

    const positions = await PracticeService.getPositions(decoded.userId, accountId)
    broadcastAccountSnapshot(clientWs, accountId, account, positions)

    clientWs.on('message', (raw) => {
      void this.handleClientMessage(clientWs, decoded.userId, accountId, raw)
    })

    clientWs.on('close', () => unsubscribe())
    clientWs.on('error', () => unsubscribe())
  }

  async handleClientMessage(clientWs, userId, accountId, raw) {
    let msg
    try {
      msg = JSON.parse(String(raw))
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object') return

    try {
      switch (msg.type) {
        case 'open_position':
          await PracticeService.openPosition(userId, accountId, msg.position)
          return
        case 'modify_position':
          await PracticeService.modifyPosition(userId, accountId, msg.position)
          return
        case 'close_position':
          await PracticeService.closePosition(userId, accountId, msg.positionId, {
            exitPrice: msg.exitPrice,
            exitTime: msg.exitTime,
            fees: msg.fees,
            forcedExit: msg.forcedExit,
          })
          return
        default:
          return
      }
    } catch (err) {
      clientWs.close(1008, err?.message || 'Position update failed')
    }
  }
}

export default new PracticeAccountWebSocket()
