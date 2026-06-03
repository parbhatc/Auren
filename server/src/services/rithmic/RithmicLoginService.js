import { init, connect } from 'rithmic-api'
import { RequestLogin, InfraType } from 'rithmic-api'
import { fetchRithmicDiscoveryGateways } from './RithmicDiscoveryService.js'

const WEB_APP = {
  template_version: '2.0',
  app_name: 'Rithmic Trader Pro - Web',
  app_version: '2.8.0.0',
}

function normalizeRpCode(rp_code) {
  return Array.isArray(rp_code) ? String(rp_code[0] ?? '') : String(rp_code ?? '')
}

import { formatRithmicFailureMessage } from './rithmicErrors.js'

async function resolveGatewayUri({ systemName, gatewayName, gatewayUri }) {
  if (gatewayUri?.trim()) {
    return gatewayUri.trim()
  }
  if (!systemName?.trim() || !gatewayName?.trim()) {
    throw new Error('gatewayUri or system + gateway are required')
  }
  const discovery = await fetchRithmicDiscoveryGateways(systemName.trim())
  const match = discovery.gateways?.find((g) => g.name === gatewayName.trim())
  if (!match?.uri) {
    throw new Error(`Gateway "${gatewayName}" not found for system "${systemName}"`)
  }
  return match.uri
}

/**
 * WS login test: RequestLogin (template 10) on the selected regional gateway.
 */
export async function testRithmicLogin({
  username,
  password,
  systemName,
  gatewayName,
  gatewayUri,
}) {
  const user = String(username || '').trim()
  const pass = String(password || '')
  const system = String(systemName || '').trim()

  if (!user || !pass) {
    throw new Error('username and password are required')
  }
  if (!system) {
    throw new Error('system is required')
  }

  const uri = await resolveGatewayUri({ systemName: system, gatewayName, gatewayUri })

  await init()

  const client = await connect({
    uri,
    label: 'WS login',
    log: process.env.RITHMIC_DISCOVERY_LOG === '1',
  })

  try {
    const response = await client.exchange(
      new RequestLogin({
        user,
        password: pass,
        system_name: system,
        infra_type: InfraType.ORDER_PLANT,
        user_msg: ['new'],
        ...WEB_APP,
      })
    )

    const rpCode = normalizeRpCode(response.rp_code)
    const passed = Boolean(response.ok)

    return {
      passed,
      rp_code: rpCode,
      message: passed
        ? 'Login successful'
        : formatRithmicFailureMessage(response.rp_code) ||
          `Login failed (rp_code=${rpCode || 'unknown'})`,
      system_name: system,
      gateway_uri: uri,
      gateway_name: gatewayName?.trim() || null,
      fcm_id: response.fcm_id || null,
      ib_id: response.ib_id || null,
      unique_user_id: response.unique_user_id || null,
      infra_type: InfraType.ORDER_PLANT,
    }
  } finally {
    client.close()
  }
}
