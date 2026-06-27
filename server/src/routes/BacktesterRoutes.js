import express from 'express'
import multer from 'multer'
import BacktesterController from '../controllers/BacktesterController.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'
import PermissionMiddleware from '../middleware/PermissionMiddleware.js'

const upload = multer()

/**
 * Backtester routes class
 * Defines all backtester-related routes
 */
class BacktesterRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  /**
   * Setup all backtester routes
   */
  setupRoutes() {
    // Get available symbols (authenticated users)
    this.router.get(
      '/symbols',
      AuthMiddleware.authenticate(),
      BacktesterController.getAvailableSymbols.bind(BacktesterController)
    )

    // Get backtester symbol data (authenticated users)
    this.router.get(
      '/symbol-data',
      AuthMiddleware.authenticate(),
      BacktesterController.getSymbolData.bind(BacktesterController)
    )

    // Get tokens from config (authenticated users)
    this.router.get(
      '/tokens',
      AuthMiddleware.authenticate(),
      BacktesterController.getTokens.bind(BacktesterController)
    )

    // Get server time (authenticated users)
    this.router.get(
      '/time',
      AuthMiddleware.authenticate(),
      BacktesterController.getServerTime.bind(BacktesterController)
    )

    // Search symbols for TradingView chart (authenticated users)
    this.router.get(
      '/search',
      AuthMiddleware.authenticate(),
      BacktesterController.searchSymbols.bind(BacktesterController)
    )

    // Get all backtester sessions (authenticated users)
    this.router.get(
      '/sessions',
      AuthMiddleware.authenticate(),
      BacktesterController.getSessions.bind(BacktesterController)
    )

    // Create backtester session (authenticated users)
    this.router.post(
      '/sessions',
      AuthMiddleware.authenticate(),
      BacktesterController.saveSession.bind(BacktesterController)
    )

    // Update backtester session (authenticated users)
    this.router.put(
      '/sessions/:id',
      AuthMiddleware.authenticate(),
      BacktesterController.updateSession.bind(BacktesterController)
    )

    // Delete backtester session (authenticated users)
    this.router.delete(
      '/sessions/:id',
      AuthMiddleware.authenticate(),
      BacktesterController.deleteSession.bind(BacktesterController)
    )

    // Testing Strategies endpoints removed — replay no longer uses strategy/journal system

    // Update session balance (authenticated users)
    this.router.put(
      '/sessions/:id/balance',
      AuthMiddleware.authenticate(),
      BacktesterController.updateSessionBalance.bind(BacktesterController)
    )

    // Get session stats (authenticated users)
    this.router.get(
      '/sessions/:id/stats',
      AuthMiddleware.authenticate(),
      BacktesterController.getSessionStats.bind(BacktesterController)
    )

    // Get backtester trades (authenticated users)
    this.router.get(
      '/trades',
      AuthMiddleware.authenticate(),
      BacktesterController.getTrades.bind(BacktesterController)
    )

    // Get a single backtester trade by ID (authenticated users)
    this.router.get(
      '/trades/:id',
      AuthMiddleware.authenticate(),
      BacktesterController.getTrade.bind(BacktesterController)
    )

    // Save backtester trade (authenticated users)
    this.router.post(
      '/trades',
      AuthMiddleware.authenticate(),
      BacktesterController.saveTrade.bind(BacktesterController)
    )

    // Delete backtester trade (authenticated users)
    this.router.delete(
      '/trades/:id',
      AuthMiddleware.authenticate(),
      BacktesterController.deleteTrade.bind(BacktesterController)
    )

    // TradingView Chart Storage API
    // Charts endpoints
    this.router.get(
      '/chart_storage/:version/charts',
      BacktesterController.handleChartStorage.bind(BacktesterController)
    )
    this.router.post(
      '/chart_storage/:version/charts',
      upload.none(),
      BacktesterController.handleChartStorage.bind(BacktesterController)
    )
    this.router.delete(
      '/chart_storage/:version/charts',
      BacktesterController.handleChartStorage.bind(BacktesterController)
    )

    // Study Templates endpoints
    this.router.get(
      '/chart_storage/:version/study_templates',
      BacktesterController.handleStudyTemplates.bind(BacktesterController)
    )
    this.router.post(
      '/chart_storage/:version/study_templates',
      upload.none(),
      BacktesterController.handleStudyTemplates.bind(BacktesterController)
    )
    this.router.delete(
      '/chart_storage/:version/study_templates',
      BacktesterController.handleStudyTemplates.bind(BacktesterController)
    )

    // Drawing Templates endpoints
    this.router.get(
      '/chart_storage/:version/drawing_templates',
      BacktesterController.handleDrawingTemplates.bind(BacktesterController)
    )
    this.router.post(
      '/chart_storage/:version/drawing_templates',
      upload.none(),
      BacktesterController.handleDrawingTemplates.bind(BacktesterController)
    )
    this.router.delete(
      '/chart_storage/:version/drawing_templates',
      BacktesterController.handleDrawingTemplates.bind(BacktesterController)
    )

    // Chart Snapshot endpoint (for TradingView screenshot functionality)
    this.router.post(
      '/chart_snapshot',
      upload.any(), // Accept any file uploads for snapshot
      BacktesterController.handleChartSnapshot.bind(BacktesterController)
    )

    // Symbol Config Management (Admin only)
    this.router.get(
      '/config/symbols',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      BacktesterController.getSymbolsConfig.bind(BacktesterController)
    )
    this.router.get(
      '/config/csv-files',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      BacktesterController.getCSVFilesByType.bind(BacktesterController)
    )
    this.router.post(
      '/config/symbols',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      BacktesterController.saveSymbolConfig.bind(BacktesterController)
    )
    this.router.delete(
      '/config/symbols/:symbol',
      AuthMiddleware.authenticate(),
      PermissionMiddleware.requireAdmin(),
      BacktesterController.deleteSymbolConfig.bind(BacktesterController)
    )
  }

  /**
   * Get router instance
   */
  getRouter() {
    return this.router
  }
}

export default BacktesterRoutes

