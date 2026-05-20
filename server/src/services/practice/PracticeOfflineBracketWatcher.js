import WebSocket from 'ws'
import PracticeService from '../PracticeService.js'
import { practiceFirmSupportsOfflineBracketWatcher } from '../../utils/practicePropFirms.js'
import Database from '../../config/Database.js'
import PropsController from '../../controllers/PropsController.js'
import TradeseaIdentityService from '../tradesea/TradeseaIdentityService.js'
import { getStreamEndpoints } from '../tradesea/TradeseaAccountPolicy.js'
import { normalizeTradeseaTradeInstrument } from '../../utils/tradeseaInstrument.js'
import {
  isMicroPracticeSymbol,
  getCommissionPerContract,
} from '../../utils/practiceRules.js'
import {
  BRACKET_REPLAY_RESOLUTION,
  barMatchesSnapshot,
  entryTimeToMs,
  findBracketExitInBars,
  replayFromSecForSnapshot,
} from '../../utils/practiceBracketReplay.js'

const TRADESEA_ORIGIN = 'https://app.tradesea.ai'
const F_CANDLES = 5
const LANE = 0

function buildAuthCookieHeader(tokens) {
  const parts = []
  if (tokens?.accessToken) parts.push(`access_token=${tokens.accessToken}`)
  if (tokens?.refreshToken) parts.push(`refresh_token=${tokens.refreshToken}`)
  return parts.join('; ')
}

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

function parseSnapshot(raw) {
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

function tickMeta(symbol) {
  const micro = isMicroPracticeSymbol(symbol)
  return { tickSize: 0.25, tickValue: micro ? 0.5 : 5 }
}

function calcPnL(entry, exit, contracts, symbol) {
  const { tickSize, tickValue } = tickMeta(symbol)
  return ((exit - entry) / tickSize) * tickValue * contracts
}

function normalizeBarTimeMs(time) {
  if (!Number.isFinite(time) || time <= 0) return Date.now()
  return time < 1e12 ? time * 1000 : time
}

class UserOfflineWatcher {
  constructor(userId, options) {
    this.userId = userId
    this.practiceAccountId = options.practiceAccountId
    this.marketAccountId = options.marketAccountId
    this.connectionGroupId = options.connectionGroupId
    this.ws = null
    this.stopped = false
    this.candleSubId = null
    this.positions = new Map()
    this.streamSymbolByProduct = new Map()
  }

  async start() {
    await Database.initialize()
    await PropsController.initializeTable()

    const firm = await Database.get(
      'SELECT token, session_id FROM prop_firms WHERE user_id = ? AND type = ?',
      [this.userId, 'tradesea']
    )
    if (!firm?.token) {
      console.warn('[OfflineBracket] Tradesea not connected for user', this.userId)
      return false
    }

    const tokens = { accessToken: firm.token, refreshToken: firm.session_id || '' }
    const account = await TradeseaIdentityService.findAccountById(tokens, this.marketAccountId)
    if (!account?.userId) {
      console.warn('[OfflineBracket] market account not found', this.marketAccountId)
      return false
    }

    this.tokens = tokens
    this.account = account
    const { mdsStreamBase } = getStreamEndpoints(account)
    this.mdsStreamBase = mdsStreamBase

    const rows = await Database.query(
      'SELECT * FROM practice_positions WHERE account_id = ?',
      [this.practiceAccountId]
    )

    for (const row of rows) {
      const contracts = Number(row.contracts) || 0
      if (!contracts) continue
      if (row.stop_loss == null && row.take_profit == null) continue

      const product = String(row.symbol || '').trim().toUpperCase()
      const streamSymbol = normalizeTradeseaTradeInstrument(product)
      this.streamSymbolByProduct.set(product, streamSymbol)
      this.positions.set(row.id, {
        id: row.id,
        symbol: product,
        streamSymbol,
        contracts,
        entry: row.entry,
        type: row.type,
        stopLoss: row.stop_loss,
        takeProfit: row.take_profit,
        entryTime: row.entry_time,
        snapshot: parseSnapshot(row.bracket_snapshot),
      })
    }

    if (this.positions.size === 0) {
      console.info('[OfflineBracket] no bracket positions to watch')
      return false
    }

    await this.replayHistorySinceSnapshots()

    if (this.stopped || this.positions.size === 0) {
      console.info('[OfflineBracket] all positions closed during history replay')
      return false
    }

    return this.connectMds()
  }

  async fetchHistory1s(streamSymbol, fromSec, toSec) {
    const account = this.account
    const userId = account.userId
    const barSec = 1
    const maxChunkSec = 4999 * barSec
    const merged = []
    let cursor = fromSec

    while (cursor < toSec && !this.stopped) {
      const chunkTo = Math.min(toSec, cursor + maxChunkSec)
      const estimated = Math.ceil((chunkTo - cursor) / barSec) + 2
      const countback = Math.min(5000, Math.max(2, estimated))
      const qs = new URLSearchParams({
        'connection-user-id': userId,
        'connection-group-id': this.connectionGroupId,
        symbol: streamSymbol,
        resolution: BRACKET_REPLAY_RESOLUTION,
        from: String(cursor),
        to: String(chunkTo),
        countback: String(countback),
        currencyCode: 'USD',
      })

      const path = `/history?${qs.toString()}`
      const proxied = await TradeseaIdentityService.proxyUdfRequest(
        this.tokens,
        this.marketAccountId,
        path
      )
      let data = {}
      try {
        data = JSON.parse(proxied.body || '{}')
      } catch {
        data = {}
      }

      if (data.s === 'ok' && data.t?.length) {
        for (let i = 0; i < data.t.length; i++) {
          merged.push({
            time: normalizeBarTimeMs(data.t[i]),
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
          })
        }
        const lastSec = Math.floor(merged[merged.length - 1].time / 1000)
        cursor = lastSec > cursor ? lastSec + barSec : chunkTo + barSec
      } else {
        cursor = chunkTo + barSec
      }
    }

    const byTime = new Map()
    for (const b of merged) byTime.set(b.time, b)
    return [...byTime.values()].sort((a, b) => a.time - b.time)
  }

  async replayHistorySinceSnapshots() {
    const nowSec = Math.floor(Date.now() / 1000)

    for (const [positionId, pos] of [...this.positions.entries()]) {
      if (this.stopped) return

      const entrySec = Math.floor(entryTimeToMs(pos.entryTime) / 1000)
      let replayFromSec = replayFromSecForSnapshot(pos.snapshot, entrySec, nowSec)

      if (pos.snapshot) {
        const { tickSize } = tickMeta(pos.symbol)
        const anchorBars = await this.fetchHistory1s(
          pos.streamSymbol,
          pos.snapshot.barTimeSec,
          pos.snapshot.barTimeSec + 2
        )
        const anchor = anchorBars.find(
          (b) => Math.abs(Math.floor(b.time / 1000) - pos.snapshot.barTimeSec) <= 2
        )
        if (anchor && !barMatchesSnapshot(anchor, pos.snapshot, tickSize)) {
          replayFromSec = Math.max(entrySec, pos.snapshot.barTimeSec)
          console.info('[OfflineBracket] snapshot candle changed — replay from', {
            positionId,
            savedAt: pos.snapshot.barTimeLabel || pos.snapshot.barTimeSec,
            replayFromSec,
          })
        } else {
          console.info('[OfflineBracket] replay after saved candle + grace', {
            positionId,
            lastCandle: pos.snapshot.barTimeLabel || pos.snapshot.barTimeSec,
            ohlc: {
              o: pos.snapshot.open,
              h: pos.snapshot.high,
              l: pos.snapshot.low,
              c: pos.snapshot.close,
            },
            replayFromSec,
          })
        }
      }

      if (nowSec <= replayFromSec + 1) continue

      const bars = await this.fetchHistory1s(pos.streamSymbol, replayFromSec, nowSec)
      const replayFromMs = replayFromSec * 1000
      const filtered = bars.filter((b) => b.time >= replayFromMs)
      const isLong = String(pos.type).toLowerCase() === 'long' || pos.contracts > 0
      const exit = findBracketExitInBars(filtered, isLong, pos.stopLoss, pos.takeProfit)

      if (exit) {
        console.info('[OfflineBracket] history replay fill', {
          positionId,
          price: exit.price,
          replayFromSec,
          bars: filtered.length,
        })
        await this.closePosition(pos, exit.price, exit.time)
      }
    }
  }

  async closePosition(pos, exitPrice, exitTimeMs) {
    const positionId = pos.id
    if (!this.positions.has(positionId)) return

    const account = await PracticeService.getAccount(this.userId, this.practiceAccountId)
    if (!account || account.status !== 'active') {
      this.positions.delete(positionId)
      return
    }

    const contracts = Math.abs(pos.contracts)
    const pnl = calcPnL(pos.entry, exitPrice, pos.contracts, pos.symbol)
    const fees = contracts * getCommissionPerContract(account.rules, pos.symbol)
    const exitSec = Math.floor(entryTimeToMs(exitTimeMs) / 1000)
    const entrySec = Math.floor(entryTimeToMs(pos.entryTime) / 1000)

    await PracticeService.recordTrade(this.userId, this.practiceAccountId, {
      symbol: pos.symbol,
      direction: pos.type,
      entryPrice: pos.entry,
      exitPrice,
      contracts,
      pnl,
      fees,
      entryTime: entrySec,
      exitTime: exitSec,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
    })

    await PracticeService.deletePosition(this.userId, this.practiceAccountId, positionId)
    this.positions.delete(positionId)

    console.info('[OfflineBracket] position closed', {
      positionId,
      symbol: pos.symbol,
      exitPrice,
      pnl,
      fees,
    })
  }

  connectMds() {
    return new Promise((resolve) => {
      const upstreamUrl = `${this.mdsStreamBase.replace(/\/$/, '')}/${encodeURIComponent(this.account.userId)}/${this.connectionGroupId}`
      const cookie = buildAuthCookieHeader(this.tokens)

      console.info('[OfflineBracket] connecting MDS upstream', {
        userId: this.userId,
        practiceAccountId: this.practiceAccountId,
        symbols: [...this.streamSymbolByProduct.values()],
        url: upstreamUrl,
      })

      const ws = new WebSocket(upstreamUrl, {
        headers: {
          Origin: TRADESEA_ORIGIN,
          'User-Agent': 'Auren-OfflineBracket/1.0',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      })
      this.ws = ws

      const pending = []

      ws.on('open', () => {
        const symbols = [...new Set(this.streamSymbolByProduct.values())]
        const subFrame = {
          f: F_CANDLES,
          s: symbols,
          u: [],
          sr: [],
          ur: [BRACKET_REPLAY_RESOLUTION],
          l: LANE,
        }
        ws.send(JSON.stringify(subFrame))
        this.candleSubId = true
        console.info('[OfflineBracket] subscribed 1S candles', symbols)

        setTimeout(() => {
          for (const msg of pending) {
            try {
              ws.send(msg)
            } catch {
              /* ignore */
            }
          }
          pending.length = 0
        }, 75)

        resolve(true)
      })

      ws.on('message', (raw) => {
        if (this.stopped) return
        if (isTextPing(raw)) {
          try {
            ws.send('pong')
          } catch {
            /* ignore */
          }
          return
        }

        let msg
        try {
          msg = JSON.parse(raw.toString('utf8'))
        } catch {
          return
        }

        if (msg.f === F_CANDLES && msg.id && msg.t != null) {
          void this.onCandle(msg)
        }
      })

      ws.on('close', (code, reason) => {
        console.info('[OfflineBracket] upstream closed', {
          code,
          reason: reason?.toString() || '',
        })
        if (!this.stopped) {
          PracticeOfflineBracketWatcher.scheduleRetry(this.userId)
        }
      })

      ws.on('error', (err) => {
        console.warn('[OfflineBracket] upstream error', err.message)
      })

      ws.on('ping', () => {
        /* ignore */
      })
    })
  }

  async onCandle(msg) {
    const streamId = String(msg.id || '')
    const bar = {
      time: normalizeBarTimeMs(msg.t),
      open: msg.o,
      high: msg.h,
      low: msg.l,
      close: msg.c,
    }

    for (const [, pos] of this.positions.entries()) {
      if (pos.streamSymbol !== streamId) continue
      const isLong = String(pos.type).toLowerCase() === 'long' || pos.contracts > 0
      const exit = findBracketExitInBars([bar], isLong, pos.stopLoss, pos.takeProfit)
      if (exit) {
        console.info('[OfflineBracket] live candle fill', {
          positionId: pos.id,
          streamId,
          barTime: new Date(bar.time).toISOString(),
          price: exit.price,
        })
        await this.closePosition(pos, exit.price, bar.time)
      }
    }
  }

  stop(reason = 'stopped') {
    this.stopped = true
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, reason)
        }
      } catch {
        /* ignore */
      }
      this.ws = null
    }
    this.positions.clear()
    console.info('[OfflineBracket] stopped', { userId: this.userId, reason })
  }
}

class PracticeOfflineBracketWatcher {
  constructor() {
    /** @type {Map<string, UserOfflineWatcher>} */
    this.watchers = new Map()
    this.retryTimers = new Map()
  }

  static scheduleRetry(userId) {
    if (instance.retryTimers.has(userId)) return
    const timer = setTimeout(() => {
      instance.retryTimers.delete(userId)
      void instance.tryResume(userId)
    }, 5000)
    instance.retryTimers.set(userId, timer)
  }

  async tryResume(userId) {
    const w = this.watchers.get(userId)
    if (!w || w.stopped) return
    const md = await PracticeService.getMarketData(userId)
    if (!practiceFirmSupportsOfflineBracketWatcher(md?.propFirmId)) return
    if (!md?.offlineModePositions) return
    console.info('[OfflineBracket] retrying upstream after drop')
    await w.connectMds()
  }

  isActive(userId) {
    return this.watchers.has(userId)
  }

  async start(userId, body) {
    const md = await PracticeService.getMarketData(userId)
    if (!practiceFirmSupportsOfflineBracketWatcher(md?.propFirmId)) {
      return { started: false, reason: 'firm_no_offline_watcher' }
    }
    if (!md?.offlineModePositions) {
      return { started: false, reason: 'offline_mode_disabled' }
    }

    const practiceAccountId = String(body?.practiceAccountId || '').trim()
    const connectionGroupId = String(body?.connectionGroupId || '').trim()
    const marketAccountId = String(body?.marketAccountId || md.accountId || '').trim()

    if (!practiceAccountId || !connectionGroupId || !marketAccountId) {
      return { started: false, reason: 'missing_params' }
    }

    await this.stop(userId, 'restart')

    const watcher = new UserOfflineWatcher(userId, {
      practiceAccountId,
      connectionGroupId,
      marketAccountId,
    })

    const ok = await watcher.start()
    if (ok && watcher.positions.size > 0) {
      this.watchers.set(userId, watcher)
      return {
        started: true,
        watching: watcher.positions.size,
      }
    }
    watcher.stop('not_started')
    return {
      started: false,
      reason: ok ? 'no_positions' : 'connect_failed',
      watching: 0,
    }
  }

  async stop(userId, reason = 'client_connected') {
    const timer = this.retryTimers.get(userId)
    if (timer) {
      clearTimeout(timer)
      this.retryTimers.delete(userId)
    }
    const w = this.watchers.get(userId)
    if (w) {
      w.stop(reason)
      this.watchers.delete(userId)
    }
    return { stopped: true, reason }
  }
}

const instance = new PracticeOfflineBracketWatcher()
export default instance
