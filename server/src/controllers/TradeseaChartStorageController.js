import TradingViewController from './TradingViewController.js'

const CHART_TYPE = 'tradesea'

function withTradeseaType(req) {
  if (!req.query.type) {
    req.query.type = CHART_TYPE
  }
}

/**
 * TradingView chart storage for practice charts (type=tradesea).
 */
class TradeseaChartStorageController {
  async handleChartStorage(req, res) {
    withTradeseaType(req)
    return TradingViewController.handleChartStorage(req, res)
  }

  async handleStudyTemplates(req, res) {
    withTradeseaType(req)
    return TradingViewController.handleStudyTemplates(req, res)
  }

  async handleDrawingTemplates(req, res) {
    withTradeseaType(req)
    return TradingViewController.handleDrawingTemplates(req, res)
  }
}

export default new TradeseaChartStorageController()
