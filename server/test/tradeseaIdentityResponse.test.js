import test from 'node:test'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'

import TradeseaIdentityService, {
  decodeTradeseaResponse,
} from '../src/services/tradesea/TradeseaIdentityService.js'

const successJson = '{"status":"success"}'

test('decodes an ordinary Tradesea JSON response', () => {
  assert.equal(decodeTradeseaResponse(Buffer.from(successJson)), successJson)
})

test('strips a UTF-8 BOM from a Tradesea JSON response', () => {
  assert.equal(decodeTradeseaResponse(Buffer.from(`\uFEFF${successJson}`)), successJson)
})

test('decodes gzip-compressed Tradesea responses', () => {
  assert.equal(decodeTradeseaResponse(zlib.gzipSync(successJson), 'gzip'), successJson)
})

test('decodes deflate-compressed Tradesea responses', () => {
  assert.equal(decodeTradeseaResponse(zlib.deflateSync(successJson), 'deflate'), successJson)
})

test('decodes Brotli-compressed Tradesea responses', () => {
  assert.equal(decodeTradeseaResponse(zlib.brotliCompressSync(successJson), 'br'), successJson)
})

test('parses the current Tradesea refresh response contract', () => {
  const body = {
    status: 'success',
    data: {
      clientCode: 'NOQBS29746',
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      accessTokenValidityInMillis: 28_785_000,
      refreshTokenValidityInMillis: 604_785_000,
    },
  }

  assert.deepEqual(TradeseaIdentityService.extractTokensFromAuthBody(body), {
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    clientCode: 'NOQBS29746',
    accessTokenValidityInMillis: 28_785_000,
    refreshTokenValidityInMillis: 604_785_000,
  })
})

test('parses refreshed tokens from Tradesea Set-Cookie headers', () => {
  const headers = {
    'set-cookie': [
      'access_token=new-access-token; Path=/; HttpOnly; Secure; SameSite=None',
      'refresh_token=new-refresh-token; Path=/; HttpOnly; Secure; SameSite=None',
    ],
  }

  assert.deepEqual(TradeseaIdentityService.parseTokensFromSetCookie(headers), {
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
  })
})

test('parses and normalizes the current Tradesea discovery accounts shape', () => {
  const body = {
    s: 'success',
    d: {
      accounts: [
        {
          id: 'lucid-account',
          broker: 'LucidTrading',
          brokerDisplayName: 'Lucid Trading',
          accountName: 'LFE025-TEST',
          type: 'live',
          userId: 'lucid-user',
        },
        {
          id: 'sandbox-account',
          broker: 'sandbox',
          brokerDisplayName: 'Sandbox',
          accountName: 'Demo Account',
          type: 'live',
          userId: 'sandbox-user',
        },
      ],
    },
  }

  const accounts = TradeseaIdentityService.parseAccountsBody(body).map((account) =>
    TradeseaIdentityService.normalizeAccount(account)
  )

  assert.deepEqual(
    accounts.map(({ id, propFirm, propFirmDisplayName, name, accountType }) => ({
      id,
      propFirm,
      propFirmDisplayName,
      name,
      accountType,
    })),
    [
      {
        id: 'lucid-account',
        propFirm: 'LucidTrading',
        propFirmDisplayName: 'Lucid Trading',
        name: 'LFE025-TEST',
        accountType: 'live',
      },
      {
        id: 'sandbox-account',
        propFirm: 'sandbox',
        propFirmDisplayName: 'Sandbox',
        name: 'Demo Account',
        accountType: 'live',
      },
    ]
  )
})

test('parses the identity accountsWithDetails response shape', () => {
  const body = {
    status: 'success',
    data: [
      {
        id: 'account-id',
        broker: 'LucidTrading',
        brokerDisplayName: 'Lucid Trading',
        accountName: 'LFE025-TEST',
        type: 'live',
        userId: 'stream-user-id',
      },
    ],
  }

  const accounts = TradeseaIdentityService.parseAccountsBody(body).map((account) =>
    TradeseaIdentityService.normalizeAccount(account)
  )

  assert.equal(accounts.length, 1)
  assert.equal(accounts[0].id, 'account-id')
  assert.equal(accounts[0].propFirm, 'LucidTrading')
  assert.equal(accounts[0].name, 'LFE025-TEST')
  assert.equal(accounts[0].userId, 'stream-user-id')
})

test('coalesces account discovery during a burst of history proxy requests', async () => {
  const originalProxyIdentityRequest = TradeseaIdentityService.proxyIdentityRequest
  TradeseaIdentityService.rawAccountsCache.clear()
  let calls = 0
  TradeseaIdentityService.proxyIdentityRequest = async () => {
    calls += 1
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: [
          {
            id: 'account-id',
            broker: 'LucidTrading',
            accountName: 'LFE025-TEST',
            type: 'live',
            userId: 'stream-user-id',
          },
        ],
      },
    }
  }

  try {
    const tokens = { accessToken: 'burst-token', refreshToken: '' }
    const [first, second] = await Promise.all([
      TradeseaIdentityService.fetchRawAccounts(tokens),
      TradeseaIdentityService.fetchRawAccounts(tokens),
    ])
    assert.equal(calls, 1)
    assert.equal(first[0]?.id, 'account-id')
    assert.deepEqual(second, first)
  } finally {
    TradeseaIdentityService.proxyIdentityRequest = originalProxyIdentityRequest
    TradeseaIdentityService.rawAccountsCache.clear()
  }
})
