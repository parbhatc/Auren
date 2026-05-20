import WebSocket from 'ws'
import { URL } from 'url'
import WebSocketBase from './WebSocketBase.js'
import TokenService from '../services/TokenService.js'
import Database from '../config/Database.js'
import PropsController from '../controllers/PropsController.js'
import TradeseaIdentityService from '../services/tradesea/TradeseaIdentityService.js'
import PracticeOfflineBracketWatcher from '../services/practice/PracticeOfflineBracketWatcher.js'
import PracticeService from '../services/PracticeService.js'
import { practiceFirmHasExclusiveMdsSlot } from '../utils/practicePropFirms.js'
import { getStreamEndpoints } from '../services/tradesea/TradeseaAccountPolicy.js'

const TRADESEA_ORIGIN = 'https://app.tradesea.ai'

function isTextPing(raw) {
  const text = raw.toString('utf8').trim()
  if (text === 'ping') return true
  if (!text.startsWith('{')) return false
  try {
    const json = JSON.parse(text)
    const type = String(json.type || json.event || '').toLowerCase()
    return type === 'ping'
  } catch {
    return false
  }
}

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
 * Upstream: wss://api-mds-stream-delayed.tradesea.ai/v1/wss/{account.userId}/{fingerprint}
 * (Not the same id as trades unified WS — that uses account.id.)
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

    const md = await PracticeService.getMarketData(decoded.userId)
    if (practiceFirmHasExclusiveMdsSlot(md?.propFirmId)) {
      await PracticeOfflineBracketWatcher.stop(decoded.userId, 'client_connected')
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
      if (isTextPing(raw)) {
        safeSend(upstream, 'pong')
        return
      }

      const text = isBinary ? '' : raw.toString('utf8').trim()
      if (text === 'pong') {
        if (clientWs.readyState === WebSocket.OPEN) {
          safeSend(clientWs, 'pong')
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
      if (isTextPing(raw)) {
        safeSend(clientWs, 'pong')
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

    clientWs.on('close', closeUpstream)

    clientWs.on('error', closeUpstream)
  }
}

export default new TradeseaMdsWebSocket()
