import api, { getAuthHeaders } from './api'

export type RithmicDiscoverySystemsMeta = {
  gateway_uri: string
  request: { message: string; template_id: number }
  response: { message: string; template_id: number }
}

export type RithmicDiscoverySystemsResponse = {
  success: boolean
  message?: string
  rp_code?: string
  system_name?: string[]
  has_aggregated_quotes?: boolean[]
  meta?: RithmicDiscoverySystemsMeta
}

export type RithmicGateway = {
  name: string
  uri: string | null
}

export type RithmicLoginParams = {
  username: string
  password: string
  system: string
  gateway?: string
  gatewayUri?: string | null
}

export type RithmicLoginResponse = {
  success: boolean
  passed: boolean
  message?: string
  rp_code?: string
  system_name?: string
  gateway_uri?: string
  gateway_name?: string | null
  fcm_id?: string | null
  ib_id?: string | null
  unique_user_id?: string | null
  infra_type?: number
}

export type RithmicAccount = {
  id: string
  label: string
  accountName?: string
  accountCurrency?: string
  fcmId?: string
  ibId?: string
}

export type RithmicSymbolRow = {
  description: string
  exchange: string
  symbol: string
  ticker: string
  type: string
  exchange_logo?: string
  logo_urls?: string
  pipSize: number
  pipValue: number
  minTick: number
  precision: number
}

/** TradingView-style history payload from GET /api/rithmic/history */
export type RithmicHistoryResponse = {
  success: boolean
  s: 'ok' | 'no_data' | 'error'
  t?: number[]
  o?: number[]
  h?: number[]
  l?: number[]
  c?: number[]
  v?: number[]
  message?: string
}

export type RithmicHistoryParams = {
  symbol?: string
  exchange?: string
  /** Bar size: minutes as number (1, 5, 60) or "1D" / "1W" */
  resolution?: string | number
  /** Range start, Unix seconds */
  from?: number
  /** Range end, Unix seconds */
  to?: number
  /** Bar count when `from` is omitted */
  countback?: number
  /** Include the open-bucket (forming) bar in replay — true on chart first load. */
  include_forming?: boolean
}

export type RithmicAccountsPacketTrace = {
  direction: 'sent' | 'recv'
  message: string
  template_id: number | null
  body: Record<string, unknown>
}

export type RithmicAccountsResponse = {
  success: boolean
  connected?: boolean
  accounts?: RithmicAccount[]
  defaultAccountId?: string | null
  message?: string
  sessionExpired?: boolean
  debug?: RithmicAccountsPacketTrace[]
  debugSummary?: Record<string, unknown>
}

export type RithmicDiscoveryGatewaysResponse = {
  success: boolean
  message?: string
  rp_code?: string
  system_name?: string
  gateway_name?: string[]
  gateway_uri?: string[]
  gateways?: RithmicGateway[]
  meta?: RithmicDiscoverySystemsMeta
}

let systemsDiscoveryCache: RithmicDiscoverySystemsResponse | null = null
let systemsDiscoveryInflight: Promise<RithmicDiscoverySystemsResponse> | null = null
const gatewaysDiscoveryCache = new Map<string, RithmicDiscoveryGatewaysResponse>()
const gatewaysDiscoveryInflight = new Map<string, Promise<RithmicDiscoveryGatewaysResponse>>()

export function clearRithmicDiscoveryClientCache() {
  systemsDiscoveryCache = null
  systemsDiscoveryInflight = null
  gatewaysDiscoveryCache.clear()
  gatewaysDiscoveryInflight.clear()
}

export const rithmicAPI = {
  getDiscoverySystems: async (): Promise<RithmicDiscoverySystemsResponse> => {
    if (systemsDiscoveryCache?.success) {
      return systemsDiscoveryCache
    }
    if (systemsDiscoveryInflight) {
      return systemsDiscoveryInflight
    }

    systemsDiscoveryInflight = api
      .get<RithmicDiscoverySystemsResponse>('/rithmic/discovery/systems', {
        headers: getAuthHeaders(),
      })
      .then((response) => {
        if (response.data.success) {
          systemsDiscoveryCache = response.data
        }
        return response.data
      })
      .finally(() => {
        systemsDiscoveryInflight = null
      })

    return systemsDiscoveryInflight
  },

  getDiscoveryGateways: async (system: string): Promise<RithmicDiscoveryGatewaysResponse> => {
    const key = system.trim()
    const cached = gatewaysDiscoveryCache.get(key)
    if (cached?.success) {
      return cached
    }

    const inflight = gatewaysDiscoveryInflight.get(key)
    if (inflight) {
      return inflight
    }

    const request = api
      .get<RithmicDiscoveryGatewaysResponse>('/rithmic/discovery/gateways', {
        headers: getAuthHeaders(),
        params: { system: key },
      })
      .then((response) => {
        if (response.data.success) {
          gatewaysDiscoveryCache.set(key, response.data)
        }
        return response.data
      })
      .finally(() => {
        gatewaysDiscoveryInflight.delete(key)
      })

    gatewaysDiscoveryInflight.set(key, request)
    return request
  },

  /** GET /api/rithmic/symbols — full catalog from rithmic_symbols.json */
  getSymbols: async (): Promise<RithmicSymbolRow[]> => {
    const response = await api.get<RithmicSymbolRow[]>('/rithmic/symbols', {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  /** GET /api/rithmic/search?query=&exchange=&type=&limit= */
  searchSymbols: async (params: {
    query?: string
    exchange?: string
    type?: string
    limit?: number
  }): Promise<RithmicSymbolRow[]> => {
    const response = await api.get<RithmicSymbolRow[]>('/rithmic/search', {
      headers: getAuthHeaders(),
      params,
    })
    return response.data
  },

  /**
   * GET /api/rithmic/history — OHLC bars via Rithmic history plant.
   * Requires Rithmic connected in Market data settings.
   */
  getHistory: async (params: RithmicHistoryParams): Promise<RithmicHistoryResponse> => {
    const response = await api.get<RithmicHistoryResponse>('/rithmic/history', {
      headers: getAuthHeaders(),
      params,
    })
    return response.data
  },

  /** GET /api/rithmic/accounts — order plant login + AccountRmsInfo list. */
  getAccounts: async (options?: { debug?: boolean }): Promise<RithmicAccountsResponse> => {
    const response = await api.get<RithmicAccountsResponse>('/rithmic/accounts', {
      headers: getAuthHeaders(),
      params: options?.debug ? { debug: '1' } : undefined,
    })
    if (options?.debug && response.data.debug) {
      console.groupCollapsed('[rithmic] /accounts API debug (expand in Network → Response)')
      console.log('summary:', response.data.debugSummary ?? null)
      console.log('packets:', response.data.debug)
      console.groupEnd()
    }
    return response.data
  },

  /** POST /api/rithmic/login — WS RequestLogin (template 10) on selected gateway. */
  login: async (params: RithmicLoginParams): Promise<RithmicLoginResponse> => {
    const { formatRithmicLoginMessage } = await import('../propfirms/rithmic/formatLoginMessage')
    const response = await api.post<RithmicLoginResponse>('/rithmic/login', params, {
      headers: getAuthHeaders(),
      // Failed credential checks return 401 with a structured body — not a transport error.
      validateStatus: (status) => (status >= 200 && status < 300) || status === 401,
    })
    const data = response.data
    if (data.message) {
      data.message = formatRithmicLoginMessage(data.message)
    }
    return data
  },
}
