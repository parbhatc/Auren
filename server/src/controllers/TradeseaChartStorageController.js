import TopstepXController from './TopstepXController.js'

const CHART_TYPE = 'tradesea'

function withTradeseaType(req) {
  if (!req.query.type) {
    req.query.type = CHART_TYPE
  }
}

/**
 * Reuse TopstepX TradingView chart storage handlers with type=tradesea.
 */
class TradeseaChartStorageController {
  async handleChartStorage(req, res) {
    withTradeseaType(req)
    return TopstepXController.handleChartStorage(req, res)
  }

  async handleStudyTemplates(req, res) {
    withTradeseaType(req)
    return TopstepXController.handleStudyTemplates(req, res)
  }

  async handleDrawingTemplates(req, res) {
    withTradeseaType(req)
    return TopstepXController.handleDrawingTemplates(req, res)
  }
}

export default new TradeseaChartStorageController()
