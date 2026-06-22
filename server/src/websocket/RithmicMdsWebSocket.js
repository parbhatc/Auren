import { URL } from 'url'

import WebSocketBase from './WebSocketBase.js'

import TokenService from '../services/TokenService.js'

import { RithmicMdsBridge } from '../services/rithmic/RithmicMdsBridge.js'
import { logLiveDataConnected, logLiveDataDisconnected } from '../services/liveData/liveDataLog.js'

const LIVE_DATA_PROVIDER = 'Rithmic'



/** One live Rithmic ticker session per user — duplicate browser sockets fight the same plant. */

const activeByUserId = new Map()



/**

 * Rithmic market-data WebSocket for practice charts.

 *

 * Client: ws://host/rithmic-mds-ws?accountId=&token=

 * Messages: { type: 'subscribe', symbol: 'CME:NQ', resolution: '1' } | { type: 'ping' }

 */

class RithmicMdsWebSocket extends WebSocketBase {

  constructor() {

    super({

      serverName: 'RithmicMds',

      path: '/rithmic-mds-ws',

      enableHeartbeat: false,

    })

  }



  async handleConnection(clientWs, req) {

    const url = new URL(req.url, `http://${req.headers.host}`)

    const token = url.searchParams.get('token')

    const accountId = url.searchParams.get('accountId')



    if (!token || !accountId) {

      clientWs.close(1008, 'accountId and token are required')

      return

    }



    const decoded = TokenService.verifyAuthToken(token)

    if (!decoded?.userId) {

      clientWs.close(1008, 'Invalid token')

      return

    }



    const userId = decoded.userId

    const previous = activeByUserId.get(userId)

    if (previous) {

      try {

        await previous.bridge.close()

      } catch {

        /* ignore */

      }

      if (previous.clientWs.readyState === previous.clientWs.OPEN) {

        previous.clientWs.close(1000, 'replaced by new connection')

      }

      activeByUserId.delete(userId)

    }



    const bridge = new RithmicMdsBridge(clientWs, userId)

    activeByUserId.set(userId, { bridge, clientWs })



    const queued = []

    let accepting = false



    const shutdown = async () => {

      if (activeByUserId.get(userId)?.bridge === bridge) {

        activeByUserId.delete(userId)

      }

      await bridge.close()

    }



    clientWs.on('message', (raw) => {

      if (!accepting) {

        queued.push(raw)

        return

      }

      void bridge.handleMessage(raw)

    })



    clientWs.on('close', () => {
      logLiveDataDisconnected(`${LIVE_DATA_PROVIDER} WS`)
      void shutdown()
    })

    clientWs.on('error', () => {
      logLiveDataDisconnected(`${LIVE_DATA_PROVIDER} WS`)
      void shutdown()
    })



    accepting = true

    for (const raw of queued) {

      void bridge.handleMessage(raw)

    }



    logLiveDataConnected(`${LIVE_DATA_PROVIDER} WS`)

  }

}



export default new RithmicMdsWebSocket()

