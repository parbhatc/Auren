import { fetchRithmicDiscoveryGateways } from './RithmicDiscoveryService.js'

/** Serialize Rithmic gateway logins per user (ticker/history plants conflict if concurrent). */
const userLockChains = new Map()

export function withRithmicUserLock(userId, fn) {
  const prev = userLockChains.get(userId) ?? Promise.resolve()
  const run = prev.catch(() => {}).then(() => fn())
  userLockChains.set(userId, run)
  return run.finally(() => {
    if (userLockChains.get(userId) === run) {
      userLockChains.delete(userId)
    }
  })
}

export function credentialsForChart(credentials) {
  const user = credentials.username?.trim()
  const password = credentials.password?.trim()
  const systemName = credentials.systemName?.trim()
  if (!user || !password || !systemName) {
    throw new Error('Rithmic credentials incomplete. Reconnect in Market data settings.')
  }
  if (credentials.loginPassed === false) {
    throw new Error('Rithmic session expired. Reconnect in Market data settings.')
  }
  return {
    user,
    password,
    systemName,
    uri: credentials.gatewayUri?.trim() || undefined,
    gatewayName: credentials.gatewayName?.trim() || undefined,
  }
}

/** Resolve gateway URI before opening chart/ticker plants (avoids redundant discover per session). */
export async function resolveChartConnect(credentials) {
  const connect = credentialsForChart(credentials)
  if (connect.uri) return connect

  const gatewayName = connect.gatewayName
  if (!gatewayName) {
    throw new Error('Rithmic gateway is not configured. Reconnect in Market data settings.')
  }

  const discovery = await fetchRithmicDiscoveryGateways(connect.systemName)
  const match = discovery.gateways?.find((g) => g.name === gatewayName)
  if (!match?.uri) {
    throw new Error(`Gateway "${gatewayName}" not found for system "${connect.systemName}"`)
  }

  return { ...connect, uri: match.uri }
}
