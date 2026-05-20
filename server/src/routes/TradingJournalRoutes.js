import express from 'express'
import TradingJournalController from '../controllers/TradingJournalController.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'

/**
 * Trading Journal routes class
 * Defines all trading journal-related routes
 */
class TradingJournalRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  /**
   * Setup all trading journal routes
   */
  setupRoutes() {
    // ========== TRADES ==========
    this.router.post(
      '/trades',
      AuthMiddleware.authenticate(),
      TradingJournalController.createTrade.bind(TradingJournalController)
    )

    this.router.get(
      '/trades',
      AuthMiddleware.authenticate(),
      TradingJournalController.getTrades.bind(TradingJournalController)
    )

    this.router.get(
      '/trades/:id',
      AuthMiddleware.authenticate(),
      TradingJournalController.getTrade.bind(TradingJournalController)
    )

    this.router.put(
      '/trades/:id',
      AuthMiddleware.authenticate(),
      TradingJournalController.updateTrade.bind(TradingJournalController)
    )

    this.router.delete(
      '/trades/:id',
      AuthMiddleware.authenticate(),
      TradingJournalController.deleteTrade.bind(TradingJournalController)
    )

    // ========== STRATEGIES ==========
    this.router.post(
      '/strategies',
      AuthMiddleware.authenticate(),
      TradingJournalController.createStrategy.bind(TradingJournalController)
    )

    this.router.get(
      '/strategies',
      AuthMiddleware.authenticate(),
      TradingJournalController.getStrategies.bind(TradingJournalController)
    )

    this.router.get(
      '/strategies/:id',
      AuthMiddleware.authenticate(),
      TradingJournalController.getStrategy.bind(TradingJournalController)
    )

    this.router.put(
      '/strategies/:id',
      AuthMiddleware.authenticate(),
      TradingJournalController.updateStrategy.bind(TradingJournalController)
    )

    this.router.delete(
      '/strategies/:id',
      AuthMiddleware.authenticate(),
      TradingJournalController.deleteStrategy.bind(TradingJournalController)
    )

    // ========== RULES ==========
    this.router.get(
      '/rules',
      AuthMiddleware.authenticate(),
      TradingJournalController.getOrCreateRules.bind(TradingJournalController)
    )

    this.router.put(
      '/rules',
      AuthMiddleware.authenticate(),
      TradingJournalController.updateRules.bind(TradingJournalController)
    )

    // ========== ANALYTICS ==========
    this.router.get(
      '/analytics',
      AuthMiddleware.authenticate(),
      TradingJournalController.getAnalytics.bind(TradingJournalController)
    )

    // ========== DAILY REVIEWS ==========
    this.router.post(
      '/daily-reviews',
      AuthMiddleware.authenticate(),
      TradingJournalController.createDailyReview.bind(TradingJournalController)
    )

    this.router.get(
      '/daily-reviews/:date',
      AuthMiddleware.authenticate(),
      TradingJournalController.getDailyReview.bind(TradingJournalController)
    )

    this.router.put(
      '/daily-reviews/:id',
      AuthMiddleware.authenticate(),
      TradingJournalController.updateDailyReview.bind(TradingJournalController)
    )

    // ========== WEEKLY REVIEWS ==========
    this.router.get(
      '/weekly-reviews',
      AuthMiddleware.authenticate(),
      TradingJournalController.getWeeklyReviews.bind(TradingJournalController)
    )

    this.router.get(
      '/weekly-reviews/:weekStart',
      AuthMiddleware.authenticate(),
      TradingJournalController.getWeeklyReview.bind(TradingJournalController)
    )

    this.router.post(
      '/weekly-reviews/generate',
      AuthMiddleware.authenticate(),
      TradingJournalController.generateWeeklyReview.bind(TradingJournalController)
    )
  }

  /**
   * Get Express router
   */
  getRouter() {
    return this.router
  }
}

export default TradingJournalRoutes

