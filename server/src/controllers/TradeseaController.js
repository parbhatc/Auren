import crypto from 'crypto'
import TradeseaIdentityService from '../services/tradesea/TradeseaIdentityService.js'
import PropsController from './PropsController.js'
import Database from '../config/Database.js'
import ErrorHandler from '../middleware/ErrorHandler.js'
import { HTTP_STATUS } from '../config/constants.js'

function respondTradeWrite(res, proxied, fallbackError = 'Request failed') {
  const ok =
    proxied.statusCode >= 200 &&
    proxied.statusCode < 300 &&
    (proxied.body?.s === 'ok' || proxied.body?.status === 'success')

  return res.status(ok ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST).json({
    success: ok,
    ...proxied.body,
    requestId: proxied.requestId || undefined,
    error: ok ? undefined : proxied.body?.errmsg || proxied.body?.message || fallbackError,
  })
}

const MARKET_DATA_NOT_CONNECTED = 'Market data is not connected.'
const MARKET_DATA_NOT_CONNECTED_HINT =
  'Market data is not connected. Connect in Settings → Market data.'
const MARKET_DATA_SESSION_EXPIRED =
  'Market data session expired. Reconnect in Settings → Market data.'

class TradeseaController {
  async persistTradeseaTokens(userId, accessToken, refreshToken) {
    const firm = await Database.get(
      'SELECT id FROM prop_firms WHERE user_id = ? AND type = ?',
      [userId, 'tradesea']
    )
    if (!firm) return false
    await Database.run(
      'UPDATE prop_firms SET token = ?, session_id = ?, expiration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [accessToken, refreshToken || null, null, firm.id]
    )
    return true
  }

  async resolveTradeseaSession(userId, { autoRefresh = true, forceRefresh = false } = {}) {
    await PropsController.initializeTable()
    const firm = await Database.get(
      'SELECT token, session_id FROM prop_firms WHERE user_id = ? AND type = ?',
      [userId, 'tradesea']
    )

    if (!firm?.token) {
      return {
        connected: false,
        configured: false,
        error: MARKET_DATA_NOT_CONNECTED_HINT,
        status: HTTP_STATUS.UNAUTHORIZED,
      }
    }

    let tokens = {
      accessToken: firm.token,
      refreshToken: firm.session_id || '',
    }

    const tryRefresh = async () => {
      if (!tokens.refreshToken) {
        throw new Error('No refresh token stored.')
      }
      const refreshed = await TradeseaIdentityService.refreshAccessToken(tokens.refreshToken)
      tokens = refreshed
      await this.persistTradeseaTokens(userId, tokens.accessToken, tokens.refreshToken)
    }

    if (forceRefresh) {
      try {
        await tryRefresh()
      } catch (error) {
        return {
          connected: false,
          configured: true,
          sessionExpired: true,
          error: error.message || MARKET_DATA_SESSION_EXPIRED,
          status: HTTP_STATUS.UNAUTHORIZED,
        }
      }
    }

    let connection = await TradeseaIdentityService.verifyConnection(tokens)

    if (!connection.connected && autoRefresh && tokens.refreshToken && !forceRefresh) {
      try {
        await tryRefresh()
        connection = await TradeseaIdentityService.verifyConnection(tokens)
      } catch {
        /* fall through to expired */
      }
    }

    if (!connection.connected) {
      return {
        connected: false,
        configured: true,
        sessionExpired: Boolean(tokens.refreshToken) || connection.reason === 'unauthorized',
        error: MARKET_DATA_SESSION_EXPIRED,
        status: HTTP_STATUS.UNAUTHORIZED,
      }
    }

    return {
      connected: true,
      configured: true,
      tokens,
      email: connection.email,
      name: connection.name,
    }
  }

  async getTradeseaTokensForUser(userId) {
    const session = await this.resolveTradeseaSession(userId, { autoRefresh: true })
    if (!session.connected) {
      return { error: session.error || MARKET_DATA_SESSION_EXPIRED, status: session.status }
    }
    return { tokens: session.tokens }
  }
  async sendOtp(req, res) {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase()
      const resend = Boolean(req.body?.resend)
      let deviceId = String(req.body?.deviceId || '').trim()

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          ok: false,
          error: 'Please enter a valid email address.',
        })
      }

      if (!deviceId) {
        deviceId = crypto.randomUUID()
      }

      await TradeseaIdentityService.generateOtp(email, resend)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        ok: true,
        deviceId,
      })
    } catch (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        ok: false,
        error: error.message || 'Failed to send OTP',
      })
    }
  }

  async verifyOtp(req, res) {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase()
      const otp = String(req.body?.otp || '').trim()
      const deviceId = String(req.body?.deviceId || '').trim()

      if (!email || !otp) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          ok: false,
          error: 'Email and OTP are required.',
        })
      }

      if (!deviceId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          ok: false,
          error: 'Device ID is required. Please send OTP again.',
        })
      }

      const result = await TradeseaIdentityService.verifyOtp(email, otp, deviceId)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        ok: true,
        ...result,
      })
    } catch (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        ok: false,
        error: error.message || 'Verification failed',
      })
    }
  }

  async getConnectionStatus(req, res) {
    try {
      const userId = req.user.id
      const session = await this.resolveTradeseaSession(userId, { autoRefresh: true })

      if (!session.configured) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          configured: false,
          connected: false,
          reason: 'no_tokens',
        })
      }

      if (!session.connected) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          configured: true,
          connected: false,
          reason: 'unauthorized',
          sessionExpired: session.sessionExpired,
          message: session.error,
        })
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        configured: true,
        connected: true,
        email: session.email,
        name: session.name,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async refreshSession(req, res) {
    try {
      const session = await this.resolveTradeseaSession(req.user.id, {
        autoRefresh: false,
        forceRefresh: true,
      })

      if (!session.connected) {
        return res.status(HTTP_STATUS.OK).json({
          success: false,
          connected: false,
          sessionExpired: session.sessionExpired,
          message: session.error || MARKET_DATA_SESSION_EXPIRED,
        })
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        connected: true,
        message: 'Tradesea session refreshed.',
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async getAccounts(req, res) {
    try {
      const session = await this.resolveTradeseaSession(req.user.id, { autoRefresh: true })

      if (!session.configured) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          connected: false,
          accounts: [],
          message: MARKET_DATA_NOT_CONNECTED_HINT,
        })
      }

      if (!session.connected) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          connected: false,
          accounts: [],
          sessionExpired: session.sessionExpired,
          message: session.error || MARKET_DATA_SESSION_EXPIRED,
        })
      }

      const accounts = await TradeseaIdentityService.fetchAccounts(session.tokens)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        connected: true,
        accounts,
        defaultAccountId: TradeseaIdentityService.pickDefaultAccountId(accounts),
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async getStreamConfig(req, res) {
    try {
      await PropsController.initializeTable()
      const userId = req.user.id
      const accountId = String(req.query.accountId || '').trim()

      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId is required',
        })
      }

      const firm = await Database.get(
        'SELECT token, session_id FROM prop_firms WHERE user_id = ? AND type = ?',
        [userId, 'tradesea']
      )

      if (!firm?.token) {
        return res.status(HTTP_STATUS.OK).json({
          success: false,
          connected: false,
          message: MARKET_DATA_NOT_CONNECTED,
        })
      }

      const tokens = {
        accessToken: firm.token,
        refreshToken: firm.session_id || '',
      }

      const account = await TradeseaIdentityService.findAccountById(tokens, accountId)
      if (!account) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: 'Account not found or not supported (sandbox-2 and Lucid only).',
        })
      }

      const config = TradeseaIdentityService.getStreamConfig(account)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        connected: true,
        ...config,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async getExecutions(req, res) {
    try {
      await PropsController.initializeTable()
      const userId = req.user.id
      const accountId = String(req.query.accountId || '').trim()
      const instrument = String(req.query.instrument || '').trim()

      if (!accountId || !instrument) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId and instrument are required',
        })
      }

      const firm = await Database.get(
        'SELECT token, session_id FROM prop_firms WHERE user_id = ? AND type = ?',
        [userId, 'tradesea']
      )

      if (!firm?.token) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: MARKET_DATA_NOT_CONNECTED,
        })
      }

      const tokens = {
        accessToken: firm.token,
        refreshToken: firm.session_id || '',
      }

      const proxied = await TradeseaIdentityService.fetchExecutions(tokens, accountId, {
        instrument,
        locale: req.query.locale,
        maxCount: req.query.maxCount,
      })

      const ok =
        proxied.statusCode >= 200 &&
        proxied.statusCode < 300 &&
        proxied.body?.s === 'ok'

      res.set('Cache-Control', 'no-store')
      return res.status(ok ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST).json({
        success: ok,
        ...proxied.body,
        error: ok ? undefined : proxied.body?.errmsg || proxied.body?.message || 'Failed to load executions',
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async placeOrder(req, res) {
    try {
      await PropsController.initializeTable()
      const userId = req.user.id
      const accountId = String(req.body?.accountId || '').trim()

      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId is required',
        })
      }

      const firm = await Database.get(
        'SELECT token, session_id FROM prop_firms WHERE user_id = ? AND type = ?',
        [userId, 'tradesea']
      )

      if (!firm?.token) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: MARKET_DATA_NOT_CONNECTED,
        })
      }

      const tokens = {
        accessToken: firm.token,
        refreshToken: firm.session_id || '',
      }

      const proxied = await TradeseaIdentityService.placeOrder(tokens, accountId, req.body)
      return respondTradeWrite(res, proxied, 'Order failed')
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async closePosition(req, res) {
    try {
      const accountId = String(req.body?.accountId || '').trim()
      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'accountId is required' })
      }
      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }
      const proxied = await TradeseaIdentityService.closePosition(auth.tokens, accountId, req.body)
      return respondTradeWrite(res, proxied, 'Failed to close position')
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async reversePosition(req, res) {
    try {
      const accountId = String(req.body?.accountId || '').trim()
      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'accountId is required' })
      }
      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }
      const proxied = await TradeseaIdentityService.reversePosition(auth.tokens, accountId, req.body)
      return respondTradeWrite(res, proxied, 'Failed to reverse position')
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async cancelAllOrders(req, res) {
    try {
      const accountId = String(req.body?.accountId || '').trim()
      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'accountId is required' })
      }
      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }
      const proxied = await TradeseaIdentityService.cancelAllOrders(auth.tokens, accountId, req.body)
      return respondTradeWrite(res, proxied, 'Failed to cancel orders')
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async modifyPosition(req, res) {
    try {
      const accountId = String(req.body?.accountId || '').trim()
      const positionId = String(req.body?.positionId || '').trim()
      if (!accountId || !positionId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId and positionId are required',
        })
      }
      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }
      const proxied = await TradeseaIdentityService.modifyPosition(auth.tokens, accountId, req.body)
      return respondTradeWrite(res, proxied, 'Failed to modify position brackets')
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async cancelOrder(req, res) {
    try {
      const accountId = String(req.body?.accountId || '').trim()
      const orderId = String(req.body?.orderId || '').trim()
      if (!accountId || !orderId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId and orderId are required',
        })
      }
      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }
      const proxied = await TradeseaIdentityService.cancelOrder(auth.tokens, accountId, req.body)
      return respondTradeWrite(res, proxied, 'Failed to cancel order')
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async flattenAll(req, res) {
    try {
      const accountId = String(req.body?.accountId || '').trim()
      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'accountId is required' })
      }
      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }
      const proxied = await TradeseaIdentityService.flattenAll(auth.tokens, accountId, req.body)
      return respondTradeWrite(res, proxied, 'Failed to flatten account')
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async proxyInstruments(req, res) {
    try {
      const accountId = String(req.query.accountId || '').trim()
      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId is required',
        })
      }

      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }

      const subPath = req.params.path || ''
      const queryParts = []
      for (const [key, value] of Object.entries(req.query)) {
        if (key === 'accountId') continue
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      }
      const query = queryParts.length ? `?${queryParts.join('&')}` : ''
      const targetPath = `/${subPath}${query}`

      const proxied = await TradeseaIdentityService.proxyInstrumentsRequest(
        auth.tokens,
        accountId,
        targetPath
      )

      const contentType = proxied.headers['content-type'] || 'application/json'
      res.status(proxied.statusCode).set('Content-Type', contentType)
      return res.send(proxied.body)
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async getTradelensDashboard(req, res) {
    try {
      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }

      const accountId = String(req.body?.accountId || '').trim()
      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId is required',
        })
      }

      const proxied = await TradeseaIdentityService.fetchTradelensDashboard(
        auth.tokens,
        accountId,
        {
          from: req.body?.from,
          to: req.body?.to,
          timezoneOffset: req.body?.timezoneOffset,
          tags: req.body?.tags,
          instruments: req.body?.instruments,
          archivedAccountIds: req.body?.archivedAccountIds,
        }
      )

      const ok =
        proxied.statusCode >= 200 &&
        proxied.statusCode < 300 &&
        proxied.body?.s === 'success'

      res.set('Cache-Control', 'no-store')
      return res.status(HTTP_STATUS.OK).json({
        success: ok,
        ...proxied.body,
        upstreamStatus: proxied.statusCode,
        error: ok
          ? undefined
          : proxied.body?.message || proxied.body?.errmsg || 'Dashboard request failed',
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async getTradelensCalendar(req, res) {
    try {
      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }

      const accountId = String(req.body?.accountId || '').trim()
      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId is required',
        })
      }

      const from = String(req.body?.from || '').trim()
      const to = String(req.body?.to || '').trim()
      if (!from || !to) {
        return res.status(HTTP_STATUS.OK).json({
          success: false,
          s: 'error',
          error: 'from and to dates are required for calendar',
        })
      }

      const proxied = await TradeseaIdentityService.fetchTradelensCalendar(
        auth.tokens,
        accountId,
        {
          from,
          to,
          timezoneOffset: req.body?.timezoneOffset,
          tags: req.body?.tags,
          instruments: req.body?.instruments,
          archivedAccountIds: req.body?.archivedAccountIds,
        }
      )

      const ok =
        proxied.statusCode >= 200 &&
        proxied.statusCode < 300 &&
        proxied.body?.s === 'success'

      res.set('Cache-Control', 'no-store')
      return res.status(HTTP_STATUS.OK).json({
        success: ok,
        ...proxied.body,
        upstreamStatus: proxied.statusCode,
        error: ok
          ? undefined
          : proxied.body?.message || proxied.body?.errmsg || 'Calendar request failed',
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async getTradelensTrades(req, res) {
    try {
      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }

      const accountId = String(req.body?.accountId || '').trim()
      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId is required',
        })
      }

      const from = String(req.body?.from || '').trim()
      const to = String(req.body?.to || '').trim()
      if (!from || !to) {
        return res.status(HTTP_STATUS.OK).json({
          success: false,
          s: 'error',
          error: 'from and to dates are required for ranged trades',
        })
      }

      const proxied = await TradeseaIdentityService.fetchTradelensTrades(auth.tokens, accountId, {
        from: req.body?.from,
        to: req.body?.to,
        timezoneOffset: req.body?.timezoneOffset,
        tags: req.body?.tags,
        instruments: req.body?.instruments,
        archivedAccountIds: req.body?.archivedAccountIds,
      })

      const ok =
        proxied.statusCode >= 200 &&
        proxied.statusCode < 300 &&
        proxied.body?.s === 'success'

      res.set('Cache-Control', 'no-store')
      return res.status(HTTP_STATUS.OK).json({
        success: ok,
        ...proxied.body,
        upstreamStatus: proxied.statusCode,
        error: ok
          ? undefined
          : proxied.body?.message ||
            proxied.body?.errmsg ||
            proxied.body?.d ||
            'Trades request failed',
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async getTradelensCurrentTradeDay(req, res) {
    try {
      const auth = await this.getTradeseaTokensForUser(req.user.id)
      if (auth.error) {
        return res.status(auth.status).json({ success: false, error: auth.error })
      }

      const accountId = String(req.params.accountId || '').trim()
      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId is required',
        })
      }

      const proxied = await TradeseaIdentityService.fetchTradelensCurrentTradeDay(
        auth.tokens,
        accountId
      )

      const ok =
        proxied.statusCode >= 200 &&
        proxied.statusCode < 300 &&
        proxied.body?.s === 'success'

      res.set('Cache-Control', 'no-store')
      return res.status(HTTP_STATUS.OK).json({
        success: ok,
        ...proxied.body,
        upstreamStatus: proxied.statusCode,
        error: ok
          ? undefined
          : proxied.body?.message || proxied.body?.errmsg || 'Current trade day request failed',
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  async proxyUdf(req, res) {
    try {
      await PropsController.initializeTable()
      const userId = req.user.id
      const accountId = String(req.query.accountId || '').trim()

      if (!accountId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'accountId is required',
        })
      }

      const firm = await Database.get(
        'SELECT token, session_id FROM prop_firms WHERE user_id = ? AND type = ?',
        [userId, 'tradesea']
      )

      if (!firm?.token) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: MARKET_DATA_NOT_CONNECTED,
        })
      }

      const tokens = {
        accessToken: firm.token,
        refreshToken: firm.session_id || '',
      }

      const subPath = req.params.path || ''
      const queryParts = []
      for (const [key, value] of Object.entries(req.query)) {
        if (key === 'accountId') continue
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      }
      const query = queryParts.length ? `?${queryParts.join('&')}` : ''
      const targetPath = `/${subPath}${query}`

      const proxied = await TradeseaIdentityService.proxyUdfRequest(
        tokens,
        accountId,
        targetPath
      )

      const contentType = proxied.headers['content-type'] || 'application/json'
      res.status(proxied.statusCode).set('Content-Type', contentType)
      return res.send(proxied.body)
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

}

export default new TradeseaController()
