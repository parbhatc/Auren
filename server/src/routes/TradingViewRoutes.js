import express from 'express'
import multer from 'multer'
import AuthMiddleware from '../middleware/AuthMiddleware.js'
import TradingViewController from '../controllers/TradingViewController.js'

const upload = multer()

/**
 * TradingView routes class
 * Defines all TradingView-related routes
 */
class TradingViewRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  /**
   * Setup all TradingView routes
   */
  setupRoutes() {
    // Get server time (authenticated users)
    this.router.get(
      '/time',
      AuthMiddleware.authenticate(),
      TradingViewController.getServerTime.bind(TradingViewController)
    )

    // Search symbols (authenticated users)
    this.router.get(
      '/search',
      AuthMiddleware.authenticate(),
      TradingViewController.searchSymbols.bind(TradingViewController)
    )

    // TradingView Chart Storage API
    // Charts endpoints
    this.router.get(
      '/chart_storage/:version/charts',
      TradingViewController.handleChartStorage.bind(TradingViewController)
    )
    this.router.post(
      '/chart_storage/:version/charts',
      upload.none(),
      TradingViewController.handleChartStorage.bind(TradingViewController)
    )
    this.router.delete(
      '/chart_storage/:version/charts',
      TradingViewController.handleChartStorage.bind(TradingViewController)
    )

    // Study Templates endpoints
    this.router.get(
      '/chart_storage/:version/study_templates',
      TradingViewController.handleStudyTemplates.bind(TradingViewController)
    )
    this.router.post(
      '/chart_storage/:version/study_templates',
      upload.none(),
      TradingViewController.handleStudyTemplates.bind(TradingViewController)
    )
    this.router.delete(
      '/chart_storage/:version/study_templates',
      TradingViewController.handleStudyTemplates.bind(TradingViewController)
    )

    // Drawing Templates endpoints
    this.router.get(
      '/chart_storage/:version/drawing_templates',
      TradingViewController.handleDrawingTemplates.bind(TradingViewController)
    )
    this.router.post(
      '/chart_storage/:version/drawing_templates',
      upload.none(),
      TradingViewController.handleDrawingTemplates.bind(TradingViewController)
    )
    this.router.delete(
      '/chart_storage/:version/drawing_templates',
      TradingViewController.handleDrawingTemplates.bind(TradingViewController)
    )
  }

  /**
   * Get Express router instance
   */
  getRouter() {
    return this.router
  }
}

export default TradingViewRoutes

