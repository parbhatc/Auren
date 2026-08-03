import express from 'express'
import AuthMiddleware from '../middleware/AuthMiddleware.js'
import CustomSetupsPaperController from '../controllers/CustomSetupsPaperController.js'

export default class CustomSetupsPaperRoutes {
  constructor() {
    this.router = express.Router()
    this.router.get(
      '/',
      AuthMiddleware.authenticate(),
      CustomSetupsPaperController.getSnapshot.bind(CustomSetupsPaperController)
    )
  }

  getRouter() {
    return this.router
  }
}
