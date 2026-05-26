import express from 'express'
import AuthMiddleware from '../middleware/AuthMiddleware.js'
import DebugCandlesController from '../controllers/DebugCandlesController.js'

class DebugRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  setupRoutes() {
    const auth = AuthMiddleware.authenticate()

    this.router.get('/candles', auth, DebugCandlesController.list.bind(DebugCandlesController))
    this.router.post('/candles/chunk', auth, DebugCandlesController.saveChunk.bind(DebugCandlesController))
    this.router.post('/candles/import', auth, DebugCandlesController.importSnapshot.bind(DebugCandlesController))
    this.router.get('/candles/:slug', auth, DebugCandlesController.get.bind(DebugCandlesController))
    this.router.delete('/candles/:slug', auth, DebugCandlesController.remove.bind(DebugCandlesController))
  }

  getRouter() {
    return this.router
  }
}

export default DebugRoutes
