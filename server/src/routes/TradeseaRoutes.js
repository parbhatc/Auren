import express from 'express'
import multer from 'multer'
import TradeseaController from '../controllers/TradeseaController.js'
import TradeseaChartStorageController from '../controllers/TradeseaChartStorageController.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'

const upload = multer()

class TradeseaRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  setupRoutes() {
    this.router.post(
      '/otp/send',
      AuthMiddleware.authenticate(),
      TradeseaController.sendOtp.bind(TradeseaController)
    )

    this.router.post(
      '/otp/verify',
      AuthMiddleware.authenticate(),
      TradeseaController.verifyOtp.bind(TradeseaController)
    )

    this.router.get(
      '/connection',
      AuthMiddleware.authenticate(),
      TradeseaController.getConnectionStatus.bind(TradeseaController)
    )

    this.router.post(
      '/session/refresh',
      AuthMiddleware.authenticate(),
      TradeseaController.refreshSession.bind(TradeseaController)
    )

    this.router.get(
      '/accounts',
      AuthMiddleware.authenticate(),
      TradeseaController.getAccounts.bind(TradeseaController)
    )

    this.router.get(
      '/stream-config',
      AuthMiddleware.authenticate(),
      TradeseaController.getStreamConfig.bind(TradeseaController)
    )

    this.router.get(
      '/executions',
      AuthMiddleware.authenticate(),
      TradeseaController.getExecutions.bind(TradeseaController)
    )

    this.router.post(
      '/orders',
      AuthMiddleware.authenticate(),
      TradeseaController.placeOrder.bind(TradeseaController)
    )

    this.router.post(
      '/positions/close',
      AuthMiddleware.authenticate(),
      TradeseaController.closePosition.bind(TradeseaController)
    )

    this.router.post(
      '/positions/reverse',
      AuthMiddleware.authenticate(),
      TradeseaController.reversePosition.bind(TradeseaController)
    )

    this.router.post(
      '/positions/modify',
      AuthMiddleware.authenticate(),
      TradeseaController.modifyPosition.bind(TradeseaController)
    )

    this.router.post(
      '/orders/cancel',
      AuthMiddleware.authenticate(),
      TradeseaController.cancelOrder.bind(TradeseaController)
    )

    this.router.post(
      '/orders/cancel-all',
      AuthMiddleware.authenticate(),
      TradeseaController.cancelAllOrders.bind(TradeseaController)
    )

    this.router.post(
      '/accounts/flatten-all',
      AuthMiddleware.authenticate(),
      TradeseaController.flattenAll.bind(TradeseaController)
    )

    this.router.post(
      '/tradelens/dashboard',
      AuthMiddleware.authenticate(),
      TradeseaController.getTradelensDashboard.bind(TradeseaController)
    )

    this.router.post(
      '/tradelens/calendar',
      AuthMiddleware.authenticate(),
      TradeseaController.getTradelensCalendar.bind(TradeseaController)
    )

    this.router.post(
      '/tradelens/trades',
      AuthMiddleware.authenticate(),
      TradeseaController.getTradelensTrades.bind(TradeseaController)
    )

    this.router.get(
      '/tradelens/trades/:accountId/current-trade-day',
      AuthMiddleware.authenticate(),
      TradeseaController.getTradelensCurrentTradeDay.bind(TradeseaController)
    )

    this.router.get(
      '/proxy/udf/:path(*)',
      AuthMiddleware.authenticate(),
      TradeseaController.proxyUdf.bind(TradeseaController)
    )

    this.router.get(
      '/proxy/instruments/:path(*)',
      AuthMiddleware.authenticate(),
      TradeseaController.proxyInstruments.bind(TradeseaController)
    )

    this.router.get(
      '/chart_storage/:version/charts',
      TradeseaChartStorageController.handleChartStorage.bind(TradeseaChartStorageController)
    )
    this.router.post(
      '/chart_storage/:version/charts',
      upload.none(),
      TradeseaChartStorageController.handleChartStorage.bind(TradeseaChartStorageController)
    )
    this.router.delete(
      '/chart_storage/:version/charts',
      TradeseaChartStorageController.handleChartStorage.bind(TradeseaChartStorageController)
    )

    this.router.get(
      '/chart_storage/:version/study_templates',
      TradeseaChartStorageController.handleStudyTemplates.bind(TradeseaChartStorageController)
    )
    this.router.post(
      '/chart_storage/:version/study_templates',
      upload.none(),
      TradeseaChartStorageController.handleStudyTemplates.bind(TradeseaChartStorageController)
    )
    this.router.delete(
      '/chart_storage/:version/study_templates',
      TradeseaChartStorageController.handleStudyTemplates.bind(TradeseaChartStorageController)
    )

    this.router.get(
      '/chart_storage/:version/drawing_templates',
      TradeseaChartStorageController.handleDrawingTemplates.bind(TradeseaChartStorageController)
    )
    this.router.post(
      '/chart_storage/:version/drawing_templates',
      upload.none(),
      TradeseaChartStorageController.handleDrawingTemplates.bind(TradeseaChartStorageController)
    )
    this.router.delete(
      '/chart_storage/:version/drawing_templates',
      TradeseaChartStorageController.handleDrawingTemplates.bind(TradeseaChartStorageController)
    )
  }

  getRouter() {
    return this.router
  }
}

export default TradeseaRoutes
