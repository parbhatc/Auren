import { init, connect } from 'rithmic-api'
import { rithmicConnectOptions, rithmicEnvFlag } from './rithmicDebug.js'
import { RequestRithmicSystemInfo, RequestRithmicSystemGatewayInfo } from 'rithmic-api'

export const RITHMIC_MOBILE_GATEWAY_URI = 'wss://rprotocol-mobile.rithmic.com:443'

const SYSTEMS_REQUEST_TEMPLATE_ID = 16
const SYSTEMS_RESPONSE_TEMPLATE_ID = 17
const GATEWAYS_REQUEST_TEMPLATE_ID = 20
const GATEWAYS_RESPONSE_TEMPLATE_ID = 21

function clientOptions(label) {
  const opts = { uri: RITHMIC_MOBILE_GATEWAY_URI }
  if (rithmicEnvFlag('RITHMIC_DISCOVERY_LOG')) opts.log = true
  return rithmicConnectOptions(label, opts)
}

function normalizeRpCode(rp_code) {
  return Array.isArray(rp_code) ? String(rp_code[0] ?? '') : String(rp_code ?? '')
}

/** In-memory cache — avoids reopening mobile WS for repeated discovery. */
let systemsDiscoveryCache = null
const gatewaysDiscoveryCache = new Map()
const gatewaysInflightBySystem = new Map()

/**
 * Mobile discovery: RequestRithmicSystemInfo (16) → ResponseRithmicSystemInfo (17).
 */
export async function fetchRithmicDiscoverySystems() {
  if (systemsDiscoveryCache) {
    return systemsDiscoveryCache
  }

  await init()

  const client = await connect(clientOptions('WS discovery:systems'))
  try {
    const response = await client.exchange(new RequestRithmicSystemInfo())
    const rpCode = normalizeRpCode(response.rp_code)

    if (rpCode !== '0') {
      throw new Error(`Rithmic discovery failed (rp_code=${rpCode || 'unknown'})`)
    }

    const system_name = response.system_name ?? []
    const has_aggregated_quotes = response.has_aggregated_quotes ?? []

    if (!system_name.length) {
      throw new Error('System list response was empty')
    }

    systemsDiscoveryCache = { rp_code: rpCode, system_name, has_aggregated_quotes }
    return systemsDiscoveryCache
  } finally {
    client.close()
  }
}

/**
 * Mobile discovery: RequestRithmicSystemGatewayInfo (20) → ResponseRithmicSystemGatewayInfo (21).
 * @param {string} systemName
 */
export async function fetchRithmicDiscoveryGateways(systemName) {
  const name = String(systemName || '').trim()
  if (!name) {
    throw new Error('system query parameter is required')
  }

  const cached = gatewaysDiscoveryCache.get(name)
  if (cached) {
    return cached
  }

  const inflight = gatewaysInflightBySystem.get(name)
  if (inflight) {
    return inflight
  }

  const promise = (async () => {
    await init()

    const client = await connect(clientOptions('WS discovery:gateways'))
    try {
      const response = await client.exchange(new RequestRithmicSystemGatewayInfo({ system_name: name }))
      const rpCode = normalizeRpCode(response.rp_code)

      if (rpCode !== '0') {
        throw new Error(`Rithmic gateway discovery failed (rp_code=${rpCode || 'unknown'})`)
      }

      const gateway_name = response.gateway_name ?? []
      const gateway_uri = response.gateway_uri ?? []
      const gateways = response.getGateways?.() ?? gateway_name.map((gatewayName, i) => ({
        name: gatewayName,
        uri: gateway_uri[i] ?? null,
      }))

      if (!gateways.length) {
        throw new Error('Gateway list response was empty')
      }

      const result = {
        rp_code: rpCode,
        system_name: response.system_name || name,
        gateway_name,
        gateway_uri,
        gateways,
      }
      gatewaysDiscoveryCache.set(name, result)
      return result
    } finally {
      client.close()
    }
  })()

  gatewaysInflightBySystem.set(name, promise)

  try {
    return await promise
  } finally {
    gatewaysInflightBySystem.delete(name)
  }
}

export function clearRithmicDiscoveryCache() {
  systemsDiscoveryCache = null
  gatewaysDiscoveryCache.clear()
  gatewaysInflightBySystem.clear()
}

export const RITHMIC_DISCOVERY_SYSTEMS_META = {
  gateway_uri: RITHMIC_MOBILE_GATEWAY_URI,
  request: {
    message: 'RequestRithmicSystemInfo',
    template_id: SYSTEMS_REQUEST_TEMPLATE_ID,
  },
  response: {
    message: 'ResponseRithmicSystemInfo',
    template_id: SYSTEMS_RESPONSE_TEMPLATE_ID,
  },
}

export const RITHMIC_DISCOVERY_GATEWAYS_META = {
  gateway_uri: RITHMIC_MOBILE_GATEWAY_URI,
  request: {
    message: 'RequestRithmicSystemGatewayInfo',
    template_id: GATEWAYS_REQUEST_TEMPLATE_ID,
  },
  response: {
    message: 'ResponseRithmicSystemGatewayInfo',
    template_id: GATEWAYS_RESPONSE_TEMPLATE_ID,
  },
}
