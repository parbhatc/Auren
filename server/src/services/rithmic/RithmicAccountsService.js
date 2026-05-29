import {
  init,
  connect,
  RequestLogin,
  RequestLogout,
  RequestAccountList,
  RequestAccountRmsInfo,
  ResponseAccountRmsInfo,
  InfraType,
} from 'rithmic-api'
import {
  clearRithmicLoginPassed,
  getRithmicCredentials,
  saveRithmicCredentials,
} from './RithmicCredentialsStore.js'
import { formatRithmicFailureMessage } from './rithmicErrors.js'
import {
  buildPacketTraceEntry,
  isRithmicAccountsDebugResponseEnabled,
  isRithmicPacketLogEnabled,
  printRithmicAccountsSession,
} from './rithmicPacketDebug.js'

const WEB_APP = {
  template_version: '2.0',
  app_name: 'Rithmic Trader Pro - Web',
  app_version: '2.8.0.0',
}

/** Wire ids for ResponseAccountRmsInfo (100031 primary, 305 alternate). */
const ACCOUNT_RMS_TEMPLATE_IDS = new Set([100031, 305])

function isAccountRmsPacket(msg) {
  return (
    msg instanceof ResponseAccountRmsInfo ||
    ACCOUNT_RMS_TEMPLATE_IDS.has(Number(msg?.template_id))
  )
}

function extractAccountsFromMessages(messages, fcm_id, ib_id) {
  return dedupeAccounts(
    messages
      .filter(isAccountRmsPacket)
      .map((msg) => ({
        id: String(msg.account_id || '').trim(),
        label: formatAccountLabel(msg),
        accountName: msg.account_name || '',
        accountCurrency: msg.account_currency || '',
        fcmId: msg.fcm_id || fcm_id,
        ibId: msg.ib_id || ib_id,
      }))
      .filter((a) => a.id)
  )
}

async function drainWithTrace(client, pushPacket, options) {
  const packets = await client.drain(options)
  for (const packet of packets) {
    pushPacket(packet, 'recv')
  }
  return packets
}

function formatAccountLabel(msg) {
  const id = String(msg.account_id || '').trim()
  const name = String(msg.account_name || '').trim()
  if (id && name && name !== id) return `${name} | ${id}`
  return id || name || ''
}

function dedupeAccounts(accounts) {
  const byId = new Map()
  for (const account of accounts) {
    if (account.id) byId.set(account.id, account)
  }
  return [...byId.values()]
}

function resolveGatewayUri(credentials) {
  const uri = credentials.gatewayUri?.trim()
  if (uri) return uri
  throw new Error(
    'Rithmic gateway URI is not saved. Log in again under Market data settings to store it.'
  )
}

/** One WS session per user at a time (avoids duplicate login from parallel hub requests). */
const accountsInflightByUser = new Map()

/**
 * Single WS session: RequestLogin → RequestAccountList → RequestAccountRmsInfo.
 */
export async function fetchRithmicAccounts(userId, options = {}) {
  const inflight = accountsInflightByUser.get(userId)
  if (inflight) return inflight

  const run = fetchRithmicAccountsSession(userId, options).finally(() => {
    accountsInflightByUser.delete(userId)
  })
  accountsInflightByUser.set(userId, run)
  return run
}

async function fetchRithmicAccountsSession(userId, options = {}) {
  const includeDebug = isRithmicAccountsDebugResponseEnabled(options.debug)
  const shouldTrace = includeDebug || isRithmicPacketLogEnabled()
  const packetTrace = shouldTrace ? [] : null

  const pushPacket = (packet, direction) => {
    const entry = buildPacketTraceEntry(packet, direction)
    if (packetTrace) packetTrace.push(entry)
    return entry
  }
  const credentials = await getRithmicCredentials(userId)
  if (!credentials?.username?.trim() || !credentials?.password) {
    return {
      connected: false,
      accounts: [],
      message: 'Rithmic credentials are not configured.',
    }
  }
  if (credentials.loginPassed !== true) {
    return {
      connected: false,
      accounts: [],
      message: 'Rithmic login required. Connect in Market data settings.',
    }
  }

  const user = credentials.username.trim()
  const pass = credentials.password
  const system = credentials.systemName?.trim()
  if (!system) {
    return {
      connected: false,
      accounts: [],
      message: 'Rithmic system is not configured.',
    }
  }

  let uri
  try {
    uri = resolveGatewayUri(credentials)
  } catch (error) {
    return {
      connected: false,
      accounts: [],
      message: error instanceof Error ? error.message : 'Could not resolve Rithmic gateway.',
    }
  }

  await init()

  const client = await connect({
    uri,
    label: 'rithmic-accounts',
    log: false,
  })

  let sessionOutcome = 'unknown'

  try {
    const loginRequest = new RequestLogin({
      user,
      password: pass,
      system_name: system,
      infra_type: InfraType.ORDER_PLANT,
      user_msg: ['new'],
      ...WEB_APP,
    })
    pushPacket(loginRequest, 'sent')

    const loginResponse = await client.exchange(loginRequest)
    pushPacket(loginResponse, 'recv')

    if (!loginResponse.ok) {
      sessionOutcome = 'login_failed'
      const message =
        formatRithmicFailureMessage(loginResponse.rp_code) || 'Rithmic login failed'
      await clearRithmicLoginPassed(userId)
      try {
        client.send(new RequestLogout())
        await client.drain({ idleMs: 200, max: 5 })
      } catch {
        /* ignore logout errors */
      }
      return {
        connected: false,
        accounts: [],
        sessionExpired: true,
        message,
        ...(includeDebug ? { debug: packetTrace } : {}),
      }
    }

    const fcm_id = loginResponse.fcm_id || credentials.fcmId || ''
    const ib_id = loginResponse.ib_id || credentials.ibId || ''
    const unique_user_id = loginResponse.unique_user_id || credentials.uniqueUserId || ''

    if (!fcm_id || !ib_id) {
      sessionOutcome = 'login_metadata_incomplete'
      return {
        connected: false,
        accounts: [],
        message: 'Rithmic login succeeded but session metadata was incomplete.',
        ...(includeDebug ? { debug: packetTrace } : {}),
      }
    }

    await saveRithmicCredentials(userId, {
      ...credentials,
      fcmId: fcm_id,
      ibId: ib_id,
      uniqueUserId: unique_user_id || credentials.uniqueUserId,
      loginPassed: true,
    })

    const accountListReq = new RequestAccountList({ fcm_id, ib_id })
    pushPacket(accountListReq, 'sent')
    client.send(accountListReq)

    const accountRmsReq = new RequestAccountRmsInfo({ fcm_id, ib_id })
    pushPacket(accountRmsReq, 'sent')
    client.send(accountRmsReq)

    let messages = await drainWithTrace(client, pushPacket, { idleMs: 2800, max: 40 })
    let accounts = extractAccountsFromMessages(messages, fcm_id, ib_id)

    if (!accounts.length) {
      const more = await drainWithTrace(client, pushPacket, { idleMs: 1500, max: 20 })
      messages = [...messages, ...more]
      accounts = extractAccountsFromMessages(messages, fcm_id, ib_id)
    }

    try {
      const logout = new RequestLogout()
      pushPacket(logout, 'sent')
      client.send(logout)
      await drainWithTrace(client, pushPacket, { idleMs: 500, max: 12 })
    } catch {
      /* ignore */
    }

    if (!accounts.length) {
      const rmsCount = messages.filter(isAccountRmsPacket).length
      const rmsWithId = messages.filter(
        (m) => isAccountRmsPacket(m) && String(m.account_id || '').trim()
      ).length
      sessionOutcome = `no_accounts (rms=${rmsCount}, rms_with_id=${rmsWithId}, drain=${messages.length})`
      return {
        connected: false,
        accounts: [],
        message: 'No Rithmic accounts returned. Check your LucidTrading permissions.',
        ...(includeDebug
          ? {
              debug: packetTrace,
              debugSummary: {
                drainPacketCount: messages.length,
                accountRmsInfoCount: rmsCount,
                fcm_id,
                ib_id,
                unique_user_id,
              },
            }
          : {}),
      }
    }

    sessionOutcome = `ok (${accounts.length} account(s))`
    return {
      connected: true,
      accounts,
      defaultAccountId: accounts[0]?.id ?? null,
      ...(includeDebug ? { debug: packetTrace } : {}),
    }
  } catch (error) {
    sessionOutcome = `error: ${error instanceof Error ? error.message : String(error)}`
    throw error
  } finally {
    printRithmicAccountsSession({
      uri,
      trace: packetTrace ?? [],
      outcome: sessionOutcome,
    })
    client.close()
  }
}
