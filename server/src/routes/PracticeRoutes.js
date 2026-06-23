import express from 'express'
import PracticeController from '../controllers/PracticeController.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'

class PracticeRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  setupRoutes() {
    this.router.get(
      '/market-data',
      AuthMiddleware.authenticate(),
      PracticeController.getMarketData.bind(PracticeController)
    )
    this.router.put(
      '/market-data',
      AuthMiddleware.authenticate(),
      PracticeController.saveMarketData.bind(PracticeController)
    )

    this.router.get(
      '/accounts',
      AuthMiddleware.authenticate(),
      PracticeController.listAccounts.bind(PracticeController)
    )
    this.router.post(
      '/accounts',
      AuthMiddleware.authenticate(),
      PracticeController.createAccount.bind(PracticeController)
    )
    this.router.delete(
      '/accounts',
      AuthMiddleware.authenticate(),
      PracticeController.deleteAllAccounts.bind(PracticeController)
    )
    this.router.get(
      '/accounts/:id',
      AuthMiddleware.authenticate(),
      PracticeController.getAccount.bind(PracticeController)
    )
    this.router.patch(
      '/accounts/:id',
      AuthMiddleware.authenticate(),
      PracticeController.updateAccount.bind(PracticeController)
    )
    this.router.post(
      '/accounts/:id/reset',
      AuthMiddleware.authenticate(),
      PracticeController.resetAccount.bind(PracticeController)
    )
    this.router.delete(
      '/accounts/:id',
      AuthMiddleware.authenticate(),
      PracticeController.deleteAccount.bind(PracticeController)
    )

    this.router.get(
      '/accounts/:id/positions',
      AuthMiddleware.authenticate(),
      PracticeController.getPositions.bind(PracticeController)
    )
    this.router.put(
      '/accounts/:id/positions',
      AuthMiddleware.authenticate(),
      PracticeController.upsertPosition.bind(PracticeController)
    )
    this.router.delete(
      '/accounts/:id/positions',
      AuthMiddleware.authenticate(),
      PracticeController.clearPositions.bind(PracticeController)
    )
    this.router.delete(
      '/accounts/:id/positions/:positionId',
      AuthMiddleware.authenticate(),
      PracticeController.deletePosition.bind(PracticeController)
    )

    this.router.post(
      '/accounts/:id/trades',
      AuthMiddleware.authenticate(),
      PracticeController.recordTrade.bind(PracticeController)
    )
    this.router.get(
      '/accounts/:id/stats',
      AuthMiddleware.authenticate(),
      PracticeController.getStats.bind(PracticeController)
    )
    this.router.get(
      '/accounts/:id/lockout',
      AuthMiddleware.authenticate(),
      PracticeController.getLockout.bind(PracticeController)
    )
    this.router.post(
      '/accounts/:id/lockout',
      AuthMiddleware.authenticate(),
      PracticeController.setLockout.bind(PracticeController)
    )
    this.router.delete(
      '/accounts/:id/lockout',
      AuthMiddleware.authenticate(),
      PracticeController.clearLockout.bind(PracticeController)
    )

  }

  getRouter() {
    return this.router
  }
}

export default PracticeRoutes
