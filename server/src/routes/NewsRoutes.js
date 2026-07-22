import express from 'express'
import NewsController from '../controllers/NewsController.js'

/**
 * BetterweightChartPro-compatible news routes (ForexFactory calendar for Levels indicator).
 */
class NewsRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  setupRoutes() {
    this.router.get('/config', NewsController.newsConfig.bind(NewsController))
    this.router.get('/calendar', NewsController.newsCalendar.bind(NewsController))
  }

  getRouter() {
    return this.router
  }
}

export default NewsRoutes
