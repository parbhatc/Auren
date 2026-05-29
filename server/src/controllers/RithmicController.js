import { HTTP_STATUS } from '../config/constants.js'
import {
  RITHMIC_DISCOVERY_GATEWAYS_META,
  RITHMIC_DISCOVERY_SYSTEMS_META,
  fetchRithmicDiscoveryGateways,
  fetchRithmicDiscoverySystems,
} from '../services/rithmic/RithmicDiscoveryService.js'
import { fetchRithmicAccounts } from '../services/rithmic/RithmicAccountsService.js'
import { testRithmicLogin } from '../services/rithmic/RithmicLoginService.js'
import { fetchRithmicChartHistory } from '../services/rithmic/RithmicChartService.js'
import {
  getRithmicSymbols,
  searchRithmicSymbols,
} from '../services/rithmic/RithmicSymbolsService.js'

const MARKET_DATA_NOT_CONNECTED_HINT =
  'Connect Rithmic in Market data settings (username, password, system, gateway).'

class RithmicController {
  /**
   * GET /api/rithmic/discovery/systems
   */
  async getDiscoverySystems(req, res) {
    try {
      const data = await fetchRithmicDiscoverySystems()

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        ...data,
        meta: RITHMIC_DISCOVERY_SYSTEMS_META,
      })
    } catch (error) {
      return res.status(HTTP_STATUS.BAD_GATEWAY).json({
        success: false,
        message: error instanceof Error ? error.message : 'Rithmic discovery failed',
        meta: RITHMIC_DISCOVERY_SYSTEMS_META,
      })
    }
  }

  /**
   * GET /api/rithmic/discovery/gateways?system=...
   */
  async getDiscoveryGateways(req, res) {
    try {
      const system =
        typeof req.query.system === 'string'
          ? req.query.system
          : Array.isArray(req.query.system)
            ? req.query.system[0]
            : ''

      const data = await fetchRithmicDiscoveryGateways(system)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        ...data,
        meta: RITHMIC_DISCOVERY_GATEWAYS_META,
      })
    } catch (error) {
      return res.status(HTTP_STATUS.BAD_GATEWAY).json({
        success: false,
        message: error instanceof Error ? error.message : 'Rithmic gateway discovery failed',
        meta: RITHMIC_DISCOVERY_GATEWAYS_META,
      })
    }
  }

  /**
   * POST /api/rithmic/login
   * Body: { username, password, system, gateway?, gatewayUri? }
   */
  /**
   * GET /api/rithmic/accounts
   * Order-plant login + RequestAccountRmsInfo → account list for practice hub.
   */
  async getAccounts(req, res) {
    try {
      const debug =
        req.query.debug === '1' ||
        req.query.debug === 'true' ||
        req.query.debug === true

      const result = await fetchRithmicAccounts(req.user.id, { debug })

      if (!result.connected) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          connected: false,
          accounts: [],
          sessionExpired: Boolean(result.sessionExpired),
          message: result.message || MARKET_DATA_NOT_CONNECTED_HINT,
          ...(result.debug ? { debug: result.debug, debugSummary: result.debugSummary } : {}),
        })
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        connected: true,
        accounts: result.accounts,
        defaultAccountId: result.defaultAccountId ?? null,
        ...(result.debug ? { debug: result.debug } : {}),
      })
    } catch (error) {
      return res.status(HTTP_STATUS.BAD_GATEWAY).json({
        success: false,
        connected: false,
        accounts: [],
        message: error instanceof Error ? error.message : 'Failed to load Rithmic accounts',
      })
    }
  }

  /**
   * GET /api/rithmic/symbols — full futures catalog (rithmic_symbols.json).
   */
  async getSymbols(req, res) {
    try {
      return res.status(HTTP_STATUS.OK).json(getRithmicSymbols())
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load Rithmic symbols',
      })
    }
  }

  /**
   * GET /api/rithmic/search?query=NQ&exchange=&type=&limit=30
   */
  async searchSymbols(req, res) {
    try {
      const query = typeof req.query.query === 'string' ? req.query.query : ''
      const exchange = typeof req.query.exchange === 'string' ? req.query.exchange : ''
      const type = typeof req.query.type === 'string' ? req.query.type : ''
      const limit = req.query.limit != null ? Number(req.query.limit) : 30

      return res.status(HTTP_STATUS.OK).json(
        searchRithmicSymbols({ query, exchange, type, limit })
      )
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error instanceof Error ? error.message : 'Rithmic symbol search failed',
      })
    }
  }

  /**
   * GET /api/rithmic/history?symbol=NQ&exchange=CME&resolution=1&from=&to=&countback=
   */
  async getHistory(req, res) {
    try {
      const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : 'NQ'
      const exchange = typeof req.query.exchange === 'string' ? req.query.exchange : 'CME'
      const resolution = req.query.resolution ?? 1
      const from = req.query.from != null ? Number(req.query.from) : undefined
      const to = req.query.to != null ? Number(req.query.to) : undefined
      const countback = req.query.countback != null ? Number(req.query.countback) : undefined

      const data = await fetchRithmicChartHistory(req.user.id, {
        symbol,
        exchange,
        resolution,
        from,
        to,
        countback,
      })

      return res.status(HTTP_STATUS.OK).json({ success: true, ...data })
    } catch (error) {
      return res.status(HTTP_STATUS.BAD_GATEWAY).json({
        success: false,
        s: 'error',
        message: error instanceof Error ? error.message : 'Rithmic history failed',
      })
    }
  }

  async login(req, res) {
    try {
      const { username, password, system, gateway, gatewayUri } = req.body ?? {}

      const result = await testRithmicLogin({
        username,
        password,
        systemName: system,
        gatewayName: gateway,
        gatewayUri,
      })

      const status = result.passed ? HTTP_STATUS.OK : HTTP_STATUS.UNAUTHORIZED

      return res.status(status).json({
        success: result.passed,
        passed: result.passed,
        ...result,
      })
    } catch (error) {
      return res.status(HTTP_STATUS.BAD_GATEWAY).json({
        success: false,
        passed: false,
        message: error instanceof Error ? error.message : 'Rithmic login failed',
      })
    }
  }
}

export default new RithmicController()
