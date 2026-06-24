import WebSocket from 'ws'
import { URL } from 'url'
import WebSocketBase from './WebSocketBase.js'
import TokenService from '../services/TokenService.js'
import Database from '../config/Database.js'
import PropsController from '../controllers/PropsController.js'
import TradeseaIdentityService from '../services/tradesea/TradeseaIdentityService.js'
import { getStreamEndpoints } from '../services/tradesea/TradeseaAccountPolicy.js'
import {
  translateClientToUpstream,
  translateUpstreamToClient,
  buildWsPongReply,
  isWsPing,
  isWsPong,
} from './mds/MdsProtocol.js'

const TRADESEA_ORIGIN = 'https://app.tradesea.ai'

function safeSend(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return
  try {
    ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

function buildAuthCookieHeader(tokens) {
  const parts = []
  if (tokens?.accessToken) parts.push(`access_token=${tokens.accessToken}`)
  if (tokens?.refreshToken) parts.push(`refresh_token=${tokens.refreshToken}`)
  return parts.join('; ')
}

/**
 * Proxies Tradesea market-data MDS WebSocket (sandbox delayed or prod).
 * Client speaks the MDS protocol; backend translates to/from Tradesea f:1..7 frames.
 *
 * Client: ws://host/tradesea-mds-ws?accountId=&token=&connectionGroupId=
 */
class TradeseaMdsWebSocket extends WebSocketBase {
  constructor() {
    super({
      serverName: 'TradeseaMds',
      path: '/tradesea-mds-ws',
      enableHeartbeat: false,
    })
  }

  async handleConnection(clientWs, req) {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const accountId = url.searchParams.get('accountId')
    const token = url.searchParams.get('token')
    const connectionGroupId = url.searchParams.get('connectionGroupId')

    if (!accountId || !token || !connectionGroupId) {
      clientWs.close(1008, 'accountId, token, and connectionGroupId are required')
      return
    }

    const decoded = TokenService.verifyAuthToken(token)
    if (!decoded?.userId) {
      clientWs.close(1008, 'Invalid token')
      return
    }

    await PropsController.initializeTable()
    const firm = await Database.get(
      'SELECT token, session_id FROM prop_firms WHERE user_id = ? AND type = ?',
      [decoded.userId, 'tradesea']
    )

    if (!firm?.token) {
      clientWs.close(1008, 'Tradesea not connected')
      return
    }

    const tokens = {
      accessToken: firm.token,
      refreshToken: firm.session_id || '',
    }

    const account = await TradeseaIdentityService.findAccountById(tokens, accountId)
    if (!account?.userId) {
      clientWs.close(1008, 'Account not found')
      return
    }

    const { mdsStreamBase } = getStreamEndpoints(account)
    const upstreamUrl = `${mdsStreamBase.replace(/\/$/, '')}/${encodeURIComponent(account.userId)}/${connectionGroupId}`
    const cookie = buildAuthCookieHeader(tokens)

    let upstream
    let clientClosed = false
    try {
      upstream = new WebSocket(upstreamUrl, {
        headers: {
          Origin: TRADESEA_ORIGIN,
          'User-Agent': 'NexusSyncPro/1.0',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      })
    } catch (err) {
      console.warn('[TradeseaMds] upstream open failed:', err.message)
      clientWs.close(1011, 'upstream open failed')
      return
    }

    const pending = []

    upstream.on('open', () => {
      console.log('[TradeseaMds] upstream connected for account', accountId)
      const flushPending = () => {
        for (const msg of pending) {
          try {
            upstream.send(msg)
          } catch {
            /* ignore */
          }
        }
        pending.length = 0
      }
      // Let upstream session settle before subscribe burst (matches Tradesea worker timing).
      setTimeout(flushPending, 75)
    })

    upstream.on('message', (raw, isBinary) => {
      if (clientClosed) return
      if (isWsPing(raw)) {
        safeSend(upstream, buildWsPongReply(raw))
        return
      }

      const text = isBinary ? '' : raw.toString('utf8').trim()
      if (isWsPong(text)) {
        if (clientWs.readyState === WebSocket.OPEN) {
          safeSend(clientWs, buildWsPongReply(raw))
        }
        return
      }

      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          const out = translateUpstreamToClient(raw, isBinary)
          if (out != null) clientWs.send(out, { binary: isBinary && typeof out !== 'string' })
        } catch {
          /* ignore */
        }
      }
    })

    upstream.on('close', (code, reason) => {
      if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
        try {
          clientWs.close(code || 1000, reason?.toString() || 'upstream closed')
        } catch {
          /* ignore */
        }
      }
    })

    upstream.on('error', (err) => {
      console.warn('[TradeseaMds] upstream error:', err.message)
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, 'upstream error')
      }
    })

    clientWs.on('ping', (data) => {
      try {
        clientWs.pong(data)
      } catch {
        /* ignore */
      }
    })

    const closeUpstream = () => {
      clientClosed = true
      pending.length = 0
      try {
        if (
          upstream.readyState === WebSocket.OPEN ||
          upstream.readyState === WebSocket.CONNECTING
        ) {
          upstream.close(1000, 'client closed')
        }
      } catch {
        /* ignore */
      }
    }

    clientWs.on('message', (raw, isBinary) => {
      if (clientClosed) return
      if (isWsPing(raw)) {
        safeSend(clientWs, buildWsPongReply(raw))
        return
      }

      if (upstream.readyState === WebSocket.OPEN) {
        try {
          const out = translateClientToUpstream(raw, isBinary)
          if (out != null) upstream.send(out, { binary: isBinary && typeof out !== 'string' })
        } catch {
          /* ignore */
        }
      } else if (!isBinary) {
        const out = translateClientToUpstream(raw, isBinary)
        if (out != null) pending.push(typeof out === 'string' ? out : out)
      }
    })

    clientWs.on('close', closeUpstream)

    clientWs.on('error', closeUpstream)
  }
}

export default new TradeseaMdsWebSocket()
