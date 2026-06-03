import express from 'express'
import RithmicController from '../controllers/RithmicController.js'
import AuthMiddleware from '../middleware/AuthMiddleware.js'

class RithmicRoutes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  setupRoutes() {
    this.router.get(
      '/discovery/systems',
      AuthMiddleware.authenticate(),
      RithmicController.getDiscoverySystems.bind(RithmicController)
    )

    this.router.get(
      '/discovery/gateways',
      AuthMiddleware.authenticate(),
      RithmicController.getDiscoveryGateways.bind(RithmicController)
    )

    this.router.post(
      '/login',
      AuthMiddleware.authenticate(),
      RithmicController.login.bind(RithmicController)
    )

    this.router.get(
      '/accounts',
      AuthMiddleware.authenticate(),
      RithmicController.getAccounts.bind(RithmicController)
    )

    this.router.get(
      '/symbols',
      AuthMiddleware.authenticate(),
      RithmicController.getSymbols.bind(RithmicController)
    )

    this.router.get(
      '/search',
      AuthMiddleware.authenticate(),
      RithmicController.searchSymbols.bind(RithmicController)
    )

    this.router.get(
      '/history',
      AuthMiddleware.authenticate(),
      RithmicController.getHistory.bind(RithmicController)
    )
  }

  getRouter() {
    return this.router
  }
}

export default RithmicRoutes
