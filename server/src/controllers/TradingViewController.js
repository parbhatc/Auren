import axios from 'axios'
import multer from 'multer'
import ErrorHandler from '../middleware/ErrorHandler.js'
import { HTTP_STATUS } from '../config/constants.js'
import Database from '../config/Database.js'

const upload = multer()

/**
 * TradingView Controller
 * Handles TradingView-related API requests
 */
class TradingViewController {
  /**
   * Search symbols using TradingView API
   * GET /api/tradingview/search
   */
  async searchSymbols(req, res) {
    try {
      const { text, hl = '1', exchange = '', lang = 'en', search_type = 'undefined', domain = 'production', sort_by_country = 'US', promo = 'true', broker, tradable } = req.query

      if (!text) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Text parameter is required'
        })
      }

      // Build query parameters
      const params = new URLSearchParams({
        text,
        hl,
        exchange,
        lang,
        search_type,
        domain,
        sort_by_country,
        promo
      })

      // Add broker and tradable parameters if provided
      if (broker) {
        params.append('broker', broker)
      }
      if (tradable) {
        params.append('tradable', tradable)
      }

      // Call TradingView symbol search API
      const response = await axios.get(
        `https://symbol-search.tradingview.com/symbol_search/v3/?${params.toString()}`,
        {
          headers: {
            'Origin': 'https://www.tradingview.com',
            'Referer': 'https://www.tradingview.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }
      )

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: response.data
      })
    } catch (error) {
      console.error('TradingView search error:', error)
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to search symbols'
      })
    }
  }

  /**
   * Verify token and username from query parameters
   * @param {string} clientToken - JWT token from client query param
   * @param {string} username - Username from user query param
   * @returns {Object|null} - User object if valid, null otherwise
   */
  /**
   * TV chart storage `user` may be scoped per practice account:
   * e.g. admin__practice_pa_123 (see TradeseaChart storageUser).
   */
  isAllowedChartStorageUser(decodedUsername, storageUser) {
    if (!decodedUsername || !storageUser) return false
    if (storageUser === decodedUsername) return true
    return storageUser.startsWith(`${decodedUsername}__`)
  }

  resolveChartStorageType(type, storageUser) {
    const base = type || 'tradingview'
    if (storageUser && storageUser.includes('__')) {
      return `${base}::${storageUser}`
    }
    return base
  }

  async verifyChartStorageAuth(clientToken, storageUser) {
    if (!clientToken || !storageUser) {
      return null
    }

    try {
      const TokenService = (await import('../services/TokenService.js')).default
      const decoded = TokenService.verifyAuthToken(clientToken)

      if (!decoded?.username || !this.isAllowedChartStorageUser(decoded.username, storageUser)) {
        return null
      }

      const user = await Database.findUserByUsernameOrEmail(decoded.username)
      if (!user || user.username !== decoded.username) {
        return null
      }

      return user
    } catch (error) {
      return null
    }
  }

  /**
   * Handle chart storage API requests
   * GET /api/tradingview/chart_storage/:version/charts
   * POST /api/tradingview/chart_storage/:version/charts
   * DELETE /api/tradingview/chart_storage/:version/charts
   */
  async handleChartStorage(req, res) {
    try {
      const { version } = req.params
      const { client, user: username, chart, type } = req.query
      
      // Verify authentication
      const user = await this.verifyChartStorageAuth(client, username)
      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: 'error',
          message: 'Invalid authentication'
        })
      }

      const chartType = this.resolveChartStorageType(type, username)

      const method = req.method

      if (method === 'GET') {
        if (chart) {
          // Get specific chart
          const chartData = await Database.getChartById(chart, user.id, chartType)
          if (!chartData) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
              status: 'error',
              message: 'Chart not found'
            })
          }
          // Convert string ID to number if it's numeric
          const chartId = /^\d+$/.test(chartData.id) ? parseInt(chartData.id, 10) : chartData.id
          return res.status(HTTP_STATUS.OK).json({
            status: 'ok',
            data: {
              id: chartId,
              name: chartData.name,
              timestamp: chartData.timestamp,
              content: chartData.content
            }
          })
        } else {
          // Get all charts filtered by type
          const charts = await Database.getChartsByUserId(user.id, chartType)
          // Convert string IDs to numbers if they're numeric
          const formattedCharts = charts.map(chart => ({
            ...chart,
            id: /^\d+$/.test(chart.id) ? parseInt(chart.id, 10) : chart.id,
            timestamp: chart.timestamp || Math.floor(Date.now() / 1000)
          }))
          return res.status(HTTP_STATUS.OK).json({
            status: 'ok',
            data: formattedCharts
          })
        }
      } else if (method === 'POST') {
        // Save chart
        const { name, content, symbol, resolution } = req.body
        
        if (!name) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: 'error',
            message: 'Chart name is required'
          })
        }

        // Parse content to extract symbol and resolution if not provided
        let chartSymbol = symbol
        let chartResolution = resolution
        let chartContent = content || '{}'
        
        try {
          if (chartContent) {
            // Content might be a JSON string, parse it
            const parsedContent = typeof chartContent === 'string' ? JSON.parse(chartContent) : chartContent
            
            // Try to extract symbol and resolution from nested content if needed
            if (parsedContent.content && typeof parsedContent.content === 'string') {
              const innerContent = JSON.parse(parsedContent.content)
              if (!chartSymbol && innerContent.symbol) {
                chartSymbol = innerContent.symbol
              }
              if (!chartResolution && innerContent.resolution) {
                chartResolution = innerContent.resolution
              }
            } else {
              if (!chartSymbol && parsedContent.symbol) {
                chartSymbol = parsedContent.symbol
              }
              if (!chartResolution && parsedContent.resolution) {
                chartResolution = parsedContent.resolution
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors, use provided values or defaults
        }

        const chartId = chart || null
        const chartData = {
          id: chartId,
          user_id: user.id,
          name,
          content: typeof chartContent === 'string' ? chartContent : JSON.stringify(chartContent),
          symbol: chartSymbol || null,
          resolution: chartResolution || null,
          type: chartType
        }

        const savedId = await Database.saveChart(chartData)
        // Convert string ID to number if it's numeric
        const formattedId = /^\d+$/.test(savedId) ? parseInt(savedId, 10) : savedId
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok',
          id: formattedId
        })
      } else if (method === 'DELETE') {
        // Delete chart
        if (!chart) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: 'error',
            message: 'Chart ID is required'
          })
        }

        await Database.deleteChart(chart, user.id, chartType)
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok'
        })
      } else {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
          status: 'error',
          message: 'Method not allowed'
        })
      }
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Handle study templates API requests
   * GET /api/tradingview/chart_storage/:version/study_templates
   * POST /api/tradingview/chart_storage/:version/study_templates
   * DELETE /api/tradingview/chart_storage/:version/study_templates
   */
  async handleStudyTemplates(req, res) {
    try {
      const { version } = req.params
      const { client, user: username, template } = req.query
      
      // Verify authentication
      const user = await this.verifyChartStorageAuth(client, username)
      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: 'error',
          message: 'Invalid authentication'
        })
      }

      const method = req.method

      if (method === 'GET') {
        if (template) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            status: 'error',
            message: 'Template not found'
          })
        }
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok',
          data: []
        })
      }
      if (method === 'POST') {
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok',
          id: Date.now()
        })
      }
      if (method === 'DELETE') {
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok'
        })
      }
      return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
        status: 'error',
        message: 'Method not allowed'
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Handle drawing templates API requests
   * GET /api/tradingview/chart_storage/:version/drawing_templates
   * POST /api/tradingview/chart_storage/:version/drawing_templates
   * DELETE /api/tradingview/chart_storage/:version/drawing_templates
   */
  async handleDrawingTemplates(req, res) {
    try {
      const { version } = req.params
      const { client, user: username, template } = req.query
      
      // Verify authentication
      const user = await this.verifyChartStorageAuth(client, username)
      if (!user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: 'error',
          message: 'Invalid authentication'
        })
      }

      const chartType = 'tradingview'
      const method = req.method

      if (method === 'GET') {
        if (template) {
          // Get specific template (not implemented yet)
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            status: 'error',
            message: 'Template not found'
          })
        } else {
          // Get all templates (empty for now)
          return res.status(HTTP_STATUS.OK).json({
            status: 'ok',
            data: []
          })
        }
      } else if (method === 'POST') {
        // Save template (not implemented yet)
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok',
          id: Date.now()
        })
      } else if (method === 'DELETE') {
        // Delete template (not implemented yet)
        return res.status(HTTP_STATUS.OK).json({
          status: 'ok'
        })
      } else {
        return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
          status: 'error',
          message: 'Method not allowed'
        })
      }
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Get server time
   * Returns current server time in milliseconds (Unix timestamp)
   * GET /api/tradingview/time
   */
  async getServerTime(req, res) {
    try {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        timestamp: Date.now(),
        serverTime: new Date().toISOString()
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }
}

export default new TradingViewController()

