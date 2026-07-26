import https from 'https'
import crypto from 'crypto'
import zlib from 'zlib'
import {
  getStreamEndpoints,
  isSupportedTradeseaAccount,
  pickDefaultAccountId,
  usesDelayedMarketData,
} from './TradeseaAccountPolicy.js'
import { normalizeTradeseaTradeInstrument } from '../../utils/tradeseaInstrument.js'

const TRADESEA_APP_ORIGIN = 'https://app.tradesea.ai'
const IDENTITY_ORIGIN = 'https://prod-identity.tradesea.ai'
const DISCOVERY_ORIGIN = 'https://prod-discovery.tradesea.ai'

const IDENTITY_HOST = 'prod-identity.tradesea.ai'
const UM_PREFIX = '/um'
const ACCOUNTS_CACHE_TTL_MS = 10_000

const TRADESEA_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

export function decodeTradeseaResponse(buffer, contentEncoding = '') {
  const encoding = String(contentEncoding || '')
    .split(',')[0]
    .trim()
    .toLowerCase()

  let decoded = buffer
  if (encoding === 'gzip' || encoding === 'x-gzip') {
    decoded = zlib.gunzipSync(buffer)
  } else if (encoding === 'deflate') {
    decoded = zlib.inflateSync(buffer)
  } else if (encoding === 'br') {
    decoded = zlib.brotliDecompressSync(buffer)
  }

  // JSON.parse rejects a UTF-8 BOM even though some gateways add one.
  return decoded.toString('utf8').replace(/^\uFEFF/, '').trim()
}

function invalidResponseError(res) {
  const statusCode = res.statusCode || 0
  const contentType = String(res.headers?.['content-type'] || '').split(';')[0]
  const requestId =
    res.headers?.['x-request-id'] || res.headers?.['request-id'] || res.headers?.['x-amz-cf-id']
  const details = [
    statusCode ? `HTTP ${statusCode}` : null,
    contentType || null,
    requestId ? `request ${requestId}` : null,
  ].filter(Boolean)

  return new Error(
    details.length
      ? `Invalid response from Tradesea (${details.join(', ')})`
      : 'Invalid response from Tradesea'
  )
}

function apiRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const req = https.request(
      {
        hostname: IDENTITY_HOST,
        path: `${UM_PREFIX}${endpoint}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Origin: 'https://app.tradesea.ai',
          Referer: 'https://app.tradesea.ai/',
          'User-Agent': TRADESEA_USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Cookie: 'access_token=; refresh_token=',
          'X-Request-ID': crypto.randomUUID(),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          try {
            const raw = decodeTradeseaResponse(
              Buffer.concat(chunks),
              res.headers?.['content-encoding']
            )
            resolve({
              statusCode: res.statusCode || 0,
              body: raw ? JSON.parse(raw) : {},
            })
          } catch {
            reject(invalidResponseError(res))
          }
        })
        res.on('aborted', () => reject(new Error('Tradesea closed the response early')))
        res.on('error', () => reject(new Error('Could not read the Tradesea response')))
      }
    )
    req.on('error', () => reject(new Error('Could not reach Tradesea')))
    req.setTimeout(15_000, () => {
      req.destroy()
      reject(new Error('Tradesea request timed out'))
    })
    if (payload) req.write(payload)
    req.end()
  })
}

function apiErrorMessage(json, fallback) {
  return json?.data?.message || json?.message || json?.error || fallback
}

function buildAuthCookieHeader(tokens) {
  const parts = []
  if (tokens?.accessToken) parts.push(`access_token=${tokens.accessToken}`)
  if (tokens?.refreshToken) parts.push(`refresh_token=${tokens.refreshToken}`)
  return parts.join('; ')
}

/** TradeLens expects yyyy-MM-dd (see TradeSea compass An()). */
function normalizeTradelensDate(value) {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function isArchivedTradeseaAccount(account) {
  if (!account) return false
  if (account.isArchived === true || account.archived === true) return true
  const status = String(account.status || account.accountStatus || '').toLowerCase()
  return status === 'archived' || status.includes('archive')
}

class TradeseaIdentityService {
  constructor() {
    this.rawAccountsCache = new Map()
  }

  async generateOtp(email, resend = false) {
    const { statusCode, body } = await apiRequest('POST', '/v1/login/generate-otp', {
      email,
      resend: Boolean(resend),
    })
    if (statusCode >= 400 || body.status !== 'success') {
      throw new Error(apiErrorMessage(body, 'Failed to send OTP'))
    }
  }

  async verifyOtp(email, otp, deviceId) {
    const { statusCode, body } = await apiRequest('POST', '/v1/login/verify-otp', {
      email,
      otp: String(otp).trim(),
      deviceId,
    })
    if (statusCode >= 400 || body.status !== 'success') {
      throw new Error(apiErrorMessage(body, 'Invalid or expired OTP'))
    }
    const data = body.data
    if (data?.isWaitlisted) {
      throw new Error('This account is on the waitlist.')
    }
    if (!data?.accessToken) {
      throw new Error('Login succeeded but no access token was returned.')
    }
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || '',
      email: data.email || email,
      firstName: data.firstName || null,
    }
  }

  extractTokensFromAuthBody(body) {
    const data = body?.data || body?.d || body
    const accessToken = data?.accessToken || data?.access_token
    const refreshToken = data?.refreshToken || data?.refresh_token || ''
    if (!accessToken) return null
    return {
      accessToken,
      refreshToken: refreshToken || '',
      clientCode: data?.clientCode || data?.client_code || null,
      accessTokenValidityInMillis:
        data?.accessTokenValidityInMillis ?? data?.access_token_validity_in_millis ?? null,
      refreshTokenValidityInMillis:
        data?.refreshTokenValidityInMillis ?? data?.refresh_token_validity_in_millis ?? null,
    }
  }

  async refreshAccessToken(refreshToken) {
    const token = String(refreshToken || '').trim()
    if (!token) {
      throw new Error('Market data session expired. Reconnect in Settings → Market data.')
    }

    const cookieRefreshed = await this.refreshAccessTokenWithCookie(token)
    if (cookieRefreshed) return cookieRefreshed

    const endpoints = [
      '/v1/login/refresh',
      '/v1/login/refresh-token',
      '/v1/auth/refresh',
      '/v1/token/refresh',
    ]

    for (const endpoint of endpoints) {
      try {
        const { statusCode, body } = await apiRequest('POST', endpoint, { refreshToken: token })
        const ok =
          statusCode >= 200 &&
          statusCode < 300 &&
          (body?.status === 'success' || body?.s === 'success' || body?.s === 'ok')
        if (!ok) continue
        const parsed = this.extractTokensFromAuthBody(body)
        if (parsed) return parsed
      } catch {
        /* try next endpoint */
      }
    }

    throw new Error('Market data session expired. Reconnect in Settings → Market data.')
  }

  parseTokensFromSetCookie(headers) {
    const raw = headers?.['set-cookie']
    if (!raw) return null
    const parts = Array.isArray(raw) ? raw : [raw]
    let accessToken = ''
    let refreshToken = ''
    for (const line of parts) {
      const mAccess = String(line).match(/access_token=([^;]+)/)
      const mRefresh = String(line).match(/refresh_token=([^;]+)/)
      if (mAccess) accessToken = decodeURIComponent(mAccess[1])
      if (mRefresh) refreshToken = decodeURIComponent(mRefresh[1])
    }
    if (!accessToken) return null
    return { accessToken, refreshToken: refreshToken || '' }
  }

  refreshAccessTokenWithCookie(refreshToken) {
    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: IDENTITY_HOST,
          path: `${UM_PREFIX}/v1/login/refresh`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json, text/plain, */*',
            'Content-Length': '0',
            Cookie: `refresh_token=${refreshToken}`,
            Origin: 'https://app.tradesea.ai',
            Referer: 'https://app.tradesea.ai/',
            'X-Request-ID': crypto.randomUUID(),
            'User-Agent': TRADESEA_USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          timeout: 15_000,
        },
        (res) => {
          const chunks = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return resolve(null)
            }
            try {
              const raw = decodeTradeseaResponse(
                Buffer.concat(chunks),
                res.headers?.['content-encoding']
              )
              const body = raw ? JSON.parse(raw) : {}
              const fromBody = this.extractTokensFromAuthBody(body)
              if (fromBody) return resolve(fromBody)
            } catch {
              /* body may be empty */
            }
            const fromCookies = this.parseTokensFromSetCookie(res.headers)
            resolve(fromCookies)
          })
        }
      )
      req.on('timeout', () => {
        req.destroy()
        resolve(null)
      })
      req.on('error', () => resolve(null))
      req.end()
    })
  }

  async verifyConnection(tokens) {
    if (!tokens?.accessToken) {
      return { configured: false, connected: false, reason: 'no_tokens' }
    }

    try {
      // This is the same authenticated endpoint currently used by app.tradesea.ai.
      // Using it as the session probe avoids false expiry results from the legacy
      // /um/v1/customer endpoint.
      const response = await this.proxyDiscoveryRequest(
        tokens,
        'GET',
        '/tradelens/v1/accounts/all'
      )
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return {
          configured: true,
          connected: false,
          reason: 'unauthorized',
          status: response.statusCode,
        }
      }
      return {
        configured: true,
        connected: true,
        email: null,
        name: null,
      }
    } catch {
      return { configured: true, connected: false, reason: 'network' }
    }
  }

  parseAccountsBody(raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      const ok =
        parsed?.s === 'success' ||
        parsed?.s === 'ok' ||
        parsed?.status === 'success'
      if (!ok) return []
      if (Array.isArray(parsed.d)) return parsed.d
      if (Array.isArray(parsed.d?.accounts)) return parsed.d.accounts
      if (Array.isArray(parsed.data)) return parsed.data
      if (Array.isArray(parsed.data?.accounts)) return parsed.data.accounts
      if (Array.isArray(parsed.accounts)) return parsed.accounts
      return []
    } catch {
      return []
    }
  }

  normalizeAccount(account) {
    if (!account || typeof account !== 'object') return account
    return {
      ...account,
      propFirm: account.propFirm || account.broker || account.fcmId,
      propFirmDisplayName:
        account.propFirmDisplayName || account.brokerDisplayName || account.broker,
      name: account.name || account.accountName || account.externalAccountId,
      accountType: account.accountType || account.type,
    }
  }

  isNexusDevAccount(account) {
    if (!account) return true
    return (
      account.id === 'nexus-dev-account-1' ||
      account.propFirm === 'Nexus' ||
      account.propFirm === 'nexus_prop_firm'
    )
  }

  formatAccountLabel(account) {
    const firm = account.propFirmDisplayName || account.propFirm || 'Unknown'
    const name = account.name || account.externalAccountId || account.id || 'Account'
    return `${firm} | ${name}`
  }

  mapAccount(a) {
    return {
      id: a.id,
      label: this.formatAccountLabel(a),
      propFirm: a.propFirm,
      propFirmDisplayName: a.propFirmDisplayName,
      name: a.name,
      accountType: a.accountType,
      userId: a.userId,
      externalAccountId: a.externalAccountId,
      externalUserId: a.externalUserId,
      isArchived: isArchivedTradeseaAccount(a),
    }
  }

  async fetchRawAccounts(tokens) {
    if (!tokens?.accessToken) {
      return []
    }

    const cacheKey = crypto
      .createHash('sha256')
      .update(String(tokens.accessToken))
      .digest('hex')
    const now = Date.now()
    const cached = this.rawAccountsCache.get(cacheKey)
    if (cached && cached.expires > now) {
      return cached.promise
    }

    for (const [key, entry] of this.rawAccountsCache) {
      if (entry.expires <= now) this.rawAccountsCache.delete(key)
    }
    if (this.rawAccountsCache.size >= 20) {
      this.rawAccountsCache.delete(this.rawAccountsCache.keys().next().value)
    }

    const promise = this.proxyIdentityRequest(
      tokens,
      'GET',
      '/eum/v1/accountsWithDetails'
    ).then((response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(apiErrorMessage(response.body, 'Could not load Tradesea accounts'))
      }
      return this.parseAccountsBody(response.body)
        .map((account) => this.normalizeAccount(account))
        .filter((account) => !this.isNexusDevAccount(account))
    })
    const entry = { expires: now + ACCOUNTS_CACHE_TTL_MS, promise }
    this.rawAccountsCache.set(cacheKey, entry)
    try {
      return await promise
    } catch (error) {
      if (this.rawAccountsCache.get(cacheKey) === entry) {
        this.rawAccountsCache.delete(cacheKey)
      }
      throw error
    }
  }

  async fetchAccounts(tokens) {
    const raw = await this.fetchRawAccounts(tokens)
    return raw.filter(isSupportedTradeseaAccount).map((a) => this.mapAccount(a))
  }

  async findAccountById(tokens, accountId) {
    if (!accountId) return null
    const raw = await this.fetchRawAccounts(tokens)
    const account = raw.find((a) => a.id === accountId)
    if (!account || !isSupportedTradeseaAccount(account)) return null
    return account
  }

  getStreamConfig(account) {
    if (!account?.userId) {
      throw new Error('Account is missing userId (MDS / UDF connection-user-id)')
    }
    if (!account?.id) {
      throw new Error('Account is missing id (trades / unified user data)')
    }
    const endpoints = getStreamEndpoints(account)
    return {
      accountId: account.id,
      mode: endpoints.mode,
      delayed: endpoints.delayed,
      /** MDS wss path + UDF `connection-user-id` */
      userId: account.userId,
      /** Trades unified wss `/users/{id}/ws/unified` */
      tradesUserId: account.id,
      accountType: account.accountType,
      propFirm: account.propFirm,
      mdsStreamBase: endpoints.mdsStreamBase,
      udfOrigin: endpoints.udfOrigin,
      tradesReadOrigin: endpoints.tradesReadOrigin,
      tradesWriteOrigin: endpoints.tradesWriteOrigin,
    }
  }

  pickDefaultAccountId(accounts) {
    return pickDefaultAccountId(accounts)
  }

  proxyUpstreamGet(tokens, accountId, origin, targetPath, extraHeaders = {}) {
    return this.findAccountById(tokens, accountId).then((account) => {
      if (!account) {
        throw new Error('Account not found')
      }
      const suffix = targetPath.startsWith('/') ? targetPath : `/${targetPath}`
      const parsed = new URL(`${origin}${suffix}`)
      const cookie = buildAuthCookieHeader(tokens)
      const connectionUserId = parsed.searchParams.get('connection-user-id')
      const connectionGroupId = parsed.searchParams.get('connection-group-id')

      return new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: parsed.hostname,
            path: `${parsed.pathname}${parsed.search}`,
            method: 'GET',
            headers: {
              cookie,
              origin: TRADESEA_APP_ORIGIN,
              referer: `${TRADESEA_APP_ORIGIN}/`,
              accept: '*/*',
              'user-agent': TRADESEA_USER_AGENT,
              'accept-language': 'en-US,en;q=0.9',
              ...(connectionUserId ? { 'connection-user-id': connectionUserId } : {}),
              ...(connectionGroupId ? { 'connection-group-id': connectionGroupId } : {}),
              ...extraHeaders,
            },
            timeout: 15_000,
          },
          (res) => {
            const chunks = []
            res.on('data', (c) => chunks.push(c))
            res.on('end', () => {
              try {
                resolve({
                  statusCode: res.statusCode || 500,
                  body: decodeTradeseaResponse(
                    Buffer.concat(chunks),
                    res.headers?.['content-encoding']
                  ),
                  headers: res.headers,
                })
              } catch {
                reject(invalidResponseError(res))
              }
            })
          }
        )
        req.on('timeout', () => {
          req.destroy()
          reject(new Error('Upstream request timed out'))
        })
        req.on('error', reject)
        req.end()
      })
    })
  }

  proxyUdfRequest(tokens, accountId, targetPath) {
    return this.findAccountById(tokens, accountId).then((account) => {
      if (!account) {
        throw new Error('Account not found')
      }
      const { udfOrigin } = getStreamEndpoints(account)
      const path = String(targetPath || '')
      const extraHeaders = path.startsWith('/search')
        ? { accept: 'application/json, text/plain, */*' }
        : {}
      return this.proxyUpstreamGet(tokens, accountId, udfOrigin, targetPath, extraHeaders)
    })
  }

  proxyInstrumentsRequest(tokens, accountId, targetPath) {
    return this.findAccountById(tokens, accountId).then((account) => {
      if (!account) {
        throw new Error('Account not found')
      }
      const { instrumentsOrigin } = getStreamEndpoints(account)
      return this.proxyUpstreamGet(tokens, accountId, instrumentsOrigin, targetPath, {
        accept: 'application/json',
      })
    })
  }

  async fetchExecutions(tokens, accountId, query = {}) {
    const account = await this.findAccountById(tokens, accountId)
    if (!account) {
      throw new Error('Account not found or not supported')
    }

    let instrument = normalizeTradeseaTradeInstrument(String(query.instrument || '').trim())
    if (!usesDelayedMarketData(account)) {
      instrument = instrument.replace(/^([A-Za-z]+)-Delayed:/i, '$1:')
    }
    if (!instrument) {
      throw new Error('instrument is required')
    }

    const { tradesReadOrigin } = getStreamEndpoints(account)
    if (!tradesReadOrigin) {
      throw new Error('Trades read API is not available for this account')
    }

    const locale = String(query.locale || 'en-US')
    const maxRaw = Number(query.maxCount)
    const maxCount = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.min(500, maxRaw) : 100

    const qs = new URLSearchParams({
      locale,
      instrument,
      maxCount: String(maxCount),
    })
    const targetPath = `/accounts/${encodeURIComponent(accountId)}/executions?${qs.toString()}`

    const proxied = await this.proxyUpstreamGet(tokens, accountId, tradesReadOrigin, targetPath)
    let body = {}
    try {
      body = proxied.body ? JSON.parse(proxied.body) : {}
    } catch {
      body = { s: 'error', errmsg: proxied.body || 'Invalid JSON' }
    }

    return {
      statusCode: proxied.statusCode,
      body,
    }
  }

  async postTradeWriteForm(tokens, accountId, path, formEntries, options = {}) {
    const account = options.account ?? (await this.findAccountById(tokens, accountId))
    if (!account) {
      throw new Error('Account not found or not supported')
    }

    const { tradesWriteOrigin } = getStreamEndpoints(account)
    if (!tradesWriteOrigin) {
      throw new Error('Trades write API is not available for this account')
    }

    const locale = String(options.locale || 'en-US')
    const suffix = path.startsWith('/') ? path : `/${path}`
    let url = `${tradesWriteOrigin.replace(/\/$/, '')}${suffix}?locale=${encodeURIComponent(locale)}`
    if (options.requestId) {
      url += `&requestId=${encodeURIComponent(options.requestId)}`
    }

    const form = new FormData()
    for (const [key, value] of Object.entries(formEntries)) {
      if (value == null || value === '') continue
      form.append(key, String(value))
    }

    const cookie = buildAuthCookieHeader(tokens)
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          cookie,
          origin: TRADESEA_APP_ORIGIN,
          referer: `${TRADESEA_APP_ORIGIN}/`,
          accept: 'application/json, text/plain, */*',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        },
        body: form,
      })
    } catch (err) {
      console.warn('[Tradesea] trade write request failed:', err?.message || err, {
        origin: tradesWriteOrigin,
        path: suffix,
      })
      return {
        statusCode: 502,
        body: { s: 'error', errmsg: err?.message || 'Could not reach Tradesea trade API' },
        requestId: options.requestId || null,
      }
    }

    const raw = await res.text()
    let body = {}
    try {
      body = raw ? JSON.parse(raw) : {}
    } catch {
      body = { s: 'error', errmsg: raw || `Invalid response (${res.status})` }
    }

    return {
      statusCode: res.status,
      body,
      requestId: options.requestId || null,
    }
  }

  async placeOrder(tokens, accountId, order) {
    const account = await this.findAccountById(tokens, accountId)
    if (!account) throw new Error('Account not found or not supported')

    let instrument = normalizeTradeseaTradeInstrument(String(order?.instrument || '').trim())
    if (!usesDelayedMarketData(account)) {
      instrument = instrument.replace(/^([A-Za-z]+)-Delayed:/i, '$1:')
    }
    const qty = Number(order?.qty)
    const side = String(order?.side || '').trim().toLowerCase()
    const type = String(order?.type || 'market').trim().toLowerCase()

    if (!instrument) throw new Error('instrument is required')
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('qty must be greater than 0')
    if (side !== 'buy' && side !== 'sell') throw new Error('side must be buy or sell')

    const requestId = crypto.randomUUID()
    const fields = {
      instrument,
      qty: String(qty),
      side,
      type,
      durationType: String(order?.durationType || 'day').toLowerCase(),
    }

    if (order?.currentAsk != null && Number.isFinite(Number(order.currentAsk))) {
      fields.currentAsk = String(order.currentAsk)
    }
    if (order?.currentBid != null && Number.isFinite(Number(order.currentBid))) {
      fields.currentBid = String(order.currentBid)
    }
    if (order?.limitPrice != null && Number.isFinite(Number(order.limitPrice))) {
      fields.limitPrice = String(order.limitPrice)
    }
    if (order?.stopPrice != null && Number.isFinite(Number(order.stopPrice))) {
      fields.stopPrice = String(order.stopPrice)
    }
    if (order?.stopLoss != null && Number.isFinite(Number(order.stopLoss))) {
      fields.stopLoss = String(order.stopLoss)
    }
    if (order?.takeProfit != null && Number.isFinite(Number(order.takeProfit))) {
      fields.takeProfit = String(order.takeProfit)
    }

    const proxied = await this.postTradeWriteForm(
      tokens,
      account.id,
      `/accounts/${account.id}/orders`,
      fields,
      { locale: order?.locale, requestId, account }
    )

    return proxied
  }

  async closePosition(tokens, accountId, payload) {
    const positionId = String(payload?.positionId || '').trim()
    if (!positionId) throw new Error('positionId is required')

    const fields = {
      account_id: accountId,
      position_id: positionId,
    }
    const amount = Number(payload?.amount)
    if (Number.isFinite(amount) && amount > 0) {
      fields.amount = String(amount)
    }

    return this.postTradeWriteForm(tokens, accountId, '/positions/close', fields, {
      locale: payload?.locale,
    })
  }

  async reversePosition(tokens, accountId, payload) {
    const positionId = String(payload?.positionId || '').trim()
    if (!positionId) throw new Error('positionId is required')

    return this.postTradeWriteForm(
      tokens,
      accountId,
      '/positions/reverse',
      {
        account_id: accountId,
        position_id: positionId,
      },
      { locale: payload?.locale }
    )
  }

  async cancelAllOrders(tokens, accountId, payload = {}) {
    return this.postTradeWriteForm(
      tokens,
      accountId,
      '/orders/cancelAll',
      { account_id: accountId },
      { locale: payload?.locale }
    )
  }

  async flattenAll(tokens, accountId, payload = {}) {
    return this.postTradeWriteForm(
      tokens,
      accountId,
      '/accounts/flattenAll',
      { account_id: accountId },
      { locale: payload?.locale }
    )
  }

  async modifyPosition(tokens, accountId, payload) {
    const positionId = String(payload?.positionId || '').trim()
    if (!positionId) throw new Error('positionId is required')

    const fields = {
      account_id: accountId,
      position_id: positionId,
    }

    if (payload?.stopLoss != null && Number.isFinite(Number(payload.stopLoss))) {
      fields.stopLoss = String(payload.stopLoss)
    }
    if (payload?.takeProfit != null && Number.isFinite(Number(payload.takeProfit))) {
      fields.takeProfit = String(payload.takeProfit)
    }
    if (payload?.trailingStopPips != null && Number.isFinite(Number(payload.trailingStopPips))) {
      fields.trailingStopPips = String(payload.trailingStopPips)
    }

    return this.postTradeWriteForm(tokens, accountId, '/positions/modify', fields, {
      locale: payload?.locale,
    })
  }

  async cancelOrder(tokens, accountId, payload) {
    const orderId = String(payload?.orderId || '').trim()
    if (!orderId) throw new Error('orderId is required')

    return this.postTradeWriteForm(
      tokens,
      accountId,
      '/orders/cancel',
      {
        account_id: accountId,
        order_id: orderId,
      },
      { locale: payload?.locale }
    )
  }

  async proxyDiscoveryRequest(tokens, method, path, body = null) {
    if (!tokens?.accessToken) {
      throw new Error('Market data is not connected.')
    }

    const suffix = path.startsWith('/') ? path : `/${path}`
    const url = `${DISCOVERY_ORIGIN}${suffix}`
    const cookie = buildAuthCookieHeader(tokens)

    const res = await fetch(url, {
      method,
      headers: {
        cookie,
        origin: TRADESEA_APP_ORIGIN,
        referer: `${TRADESEA_APP_ORIGIN}/`,
        accept: 'application/json',
        'user-agent': TRADESEA_USER_AGENT,
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    })

    const raw = await res.text()
    let parsed = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      parsed = { s: 'error', errmsg: raw || `Invalid response (${res.status})` }
    }

    return {
      statusCode: res.status,
      body: parsed,
    }
  }

  async proxyIdentityRequest(tokens, method, path, body = null) {
    if (!tokens?.accessToken) {
      throw new Error('Market data is not connected.')
    }

    const suffix = path.startsWith('/') ? path : `/${path}`
    const cookie = buildAuthCookieHeader(tokens)
    const res = await fetch(`${IDENTITY_ORIGIN}${suffix}`, {
      method,
      headers: {
        cookie,
        origin: TRADESEA_APP_ORIGIN,
        referer: `${TRADESEA_APP_ORIGIN}/`,
        accept: 'application/json, text/plain, */*',
        'user-agent': TRADESEA_USER_AGENT,
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    })

    const raw = await res.text()
    let parsed = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      parsed = { status: 'error', message: raw || `Invalid response (${res.status})` }
    }

    return { statusCode: res.status, body: parsed }
  }

  async fetchTradelensV2(tokens, accountId, endpoint, options = {}) {
    const account = await this.findAccountById(tokens, accountId)
    if (!account) {
      throw new Error('Account not found or not supported')
    }

    const archived = isArchivedTradeseaAccount(account)
    const payload = {
      accountIds: archived ? [] : [accountId],
      archivedAccountIds: archived
        ? [accountId]
        : Array.isArray(options.archivedAccountIds)
          ? options.archivedAccountIds
          : [],
      timezoneOffset:
        options.timezoneOffset != null && Number.isFinite(Number(options.timezoneOffset))
          ? Number(options.timezoneOffset)
          : new Date().getTimezoneOffset(),
    }

    const from = normalizeTradelensDate(options.from)
    const to = normalizeTradelensDate(options.to)
    if (from && to) {
      payload.from = from
      payload.to = to
    }

    if (Array.isArray(options.tags) && options.tags.length) payload.tags = options.tags
    if (Array.isArray(options.instruments) && options.instruments.length) {
      payload.instruments = options.instruments
    }

    const ep = String(endpoint || '').replace(/^\//, '')
    return this.proxyDiscoveryRequest(tokens, 'POST', `/tradelens/v2/${ep}`, payload)
  }

  fetchTradelensDashboard(tokens, accountId, options = {}) {
    return this.fetchTradelensV2(tokens, accountId, 'dashboard', options)
  }

  fetchTradelensCalendar(tokens, accountId, options = {}) {
    return this.fetchTradelensV2(tokens, accountId, 'calendar', options)
  }

  fetchTradelensTrades(tokens, accountId, options = {}) {
    return this.fetchTradelensV2(tokens, accountId, 'trades', options)
  }

  fetchTradelensCurrentTradeDay(tokens, accountId) {
    return this.proxyDiscoveryRequest(
      tokens,
      'GET',
      `/tradelens/v1/trades/${encodeURIComponent(accountId)}/currentTradeDay`
    )
  }

}

export default new TradeseaIdentityService()
