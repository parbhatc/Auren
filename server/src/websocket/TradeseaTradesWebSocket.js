import WebSocket from 'ws'
import { URL } from 'url'
import WebSocketBase from './WebSocketBase.js'
import TokenService from '../services/TokenService.js'
import Database from '../config/Database.js'
import PropsController from '../controllers/PropsController.js'
import TradeseaIdentityService from '../services/tradesea/TradeseaIdentityService.js'
import {
  buildTradesUnifiedWsUrl,
  isSupportedTradeseaAccount,
} from '../services/tradesea/TradeseaAccountPolicy.js'
import { buildWsPongReply, isWsPing, isWsPong } from './mds/MdsProtocol.js'

const TRADESEA_ORIGIN = 'https://app.tradesea.ai'

function buildAuthCookieHeader(tokens) {
  const parts = []
  if (tokens?.accessToken) parts.push(`access_token=${tokens.accessToken}`)
  if (tokens?.refreshToken) parts.push(`refresh_token=${tokens.refreshToken}`)
  return parts.join('; ')
}

function safeSend(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return
  try {
    ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

/**
 * Proxies Tradesea user-data unified WebSocket (sandbox RD → delprod, live → prod).
 * Upstream: wss://…/v1/users/{account.id}/ws/unified
 *
 * Client: ws://host/tradesea-trades-ws?accountId=<tradesea-account-id>&token=<nexus-jwt>
 */
class TradeseaTradesWebSocket extends WebSocketBase {
  constructor() {
    super({
      serverName: 'TradeseaTrades',
      path: '/tradesea-trades-ws',
      enableHeartbeat: false,
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

    const rawAccounts = await TradeseaIdentityService.fetchRawAccounts(tokens)
    const account = rawAccounts.find((a) => a.id === accountId)

    if (!account || !isSupportedTradeseaAccount(account)) {
      clientWs.close(1008, 'Tradesea account not found')
      return
    }

    const upstreamUrl = buildTradesUnifiedWsUrl(account)
    if (!upstreamUrl) {
      clientWs.close(1008, 'Trades stream not available for this account')
      return
    }
    const cookie = buildAuthCookieHeader(tokens)

    let upstream
    try {
      upstream = new WebSocket(upstreamUrl, {
        headers: {
          Origin: TRADESEA_ORIGIN,
          'User-Agent': 'NexusSyncPro/1.0',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      })
    } catch (err) {
      console.warn('[TradeseaTrades] upstream open failed:', err.message)
      clientWs.close(1011, 'upstream open failed')
      return
    }

    const pending = []

    upstream.on('open', () => {
      for (const msg of pending) {
        try {
          upstream.send(msg)
        } catch {
          /* ignore */
        }
      }
      pending.length = 0
    })

    upstream.on('message', (raw, isBinary) => {
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
          clientWs.send(raw, { binary: isBinary })
        } catch {
          /* ignore */
        }
      }
    })

    upstream.on('close', (code, reason) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.close(code || 1000, reason?.toString() || 'upstream closed')
        } catch {
          /* ignore */
        }
      }
    })

    upstream.on('error', (err) => {
      console.warn('[TradeseaTrades] upstream error:', err.message)
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

    clientWs.on('message', (raw, isBinary) => {
      if (isWsPing(raw)) {
        safeSend(clientWs, buildWsPongReply(raw))
        if (upstream.readyState === WebSocket.OPEN) {
          try {
            upstream.send(raw, { binary: isBinary })
          } catch {
            /* ignore */
          }
        } else if (!isBinary) {
          pending.push(raw)
        }
        return
      }

      if (upstream.readyState === WebSocket.OPEN) {
        try {
          upstream.send(raw, { binary: isBinary })
        } catch {
          /* ignore */
        }
      } else if (!isBinary) {
        pending.push(raw)
      }
    })

    clientWs.on('close', () => {
      try {
        upstream.close()
      } catch {
        /* ignore */
      }
    })

    clientWs.on('error', () => {
      try {
        upstream.close()
      } catch {
        /* ignore */
      }
    })
  }
}

export default new TradeseaTradesWebSocket()
