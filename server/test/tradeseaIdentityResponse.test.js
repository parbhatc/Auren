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
