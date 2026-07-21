import express from 'express'
import AuthRoutes from './AuthRoutes.js'
import AdminRoutes from './AdminRoutes.js'
import PermissionRoutes from './PermissionRoutes.js'
import UserRoutes from './UserRoutes.js'
import PropsRoutes from './PropsRoutes.js'
import EconomicNewsRoutes from './EconomicNewsRoutes.js'
import NewsRoutes from './NewsRoutes.js'
import TradingJournalRoutes from './TradingJournalRoutes.js'
import TradingViewRoutes from './TradingViewRoutes.js'
import TradeseaRoutes from './TradeseaRoutes.js'
import PracticeRoutes from './PracticeRoutes.js'
import BacktesterRoutes from './BacktesterRoutes.js'
import DebugRoutes from './DebugRoutes.js'
import RoleController from '../controllers/RoleController.js'
import Translator from '../utils/Translator.js'
import { HTTP_STATUS } from '../config/constants.js'

/**
 * Main routes class
 * Combines all route modules
 */
class Routes {
  constructor() {
    this.router = express.Router()
    this.setupRoutes()
  }

  /**
   * Setup all routes
   */
  setupRoutes() {
    // Health check route
    this.router.get('/health', (req, res) => {
      res.status(HTTP_STATUS.OK).json({
        status: 'ok',
        message: Translator.t('server.healthCheck'),
      })
    })

    // Roles status route
    this.router.get('/roles/status', RoleController.getRolesStatus.bind(RoleController))

    // Authentication routes
    const authRoutes = new AuthRoutes()
    this.router.use('/auth', authRoutes.getRouter())

    // Admin routes
    const adminRoutes = new AdminRoutes()
    this.router.use('/admin', adminRoutes.getRouter())

    // User management routes (under admin)
    const userRoutes = new UserRoutes()
    this.router.use('/admin/users', userRoutes.getRouter())

    // Permission management routes (under admin)
    const permissionRoutes = new PermissionRoutes()
    this.router.use('/admin/permissions', permissionRoutes.getRouter())

    // Props routes
    const propsRoutes = new PropsRoutes()
    this.router.use('/props', propsRoutes.getRouter())
    // Economic News routes
    const economicNewsRoutes = new EconomicNewsRoutes()
    this.router.use('/economic-news', economicNewsRoutes.getRouter())

    // BetterweightChart news feed (ForexFactory calendar for Levels indicator)
    const newsRoutes = new NewsRoutes()
    this.router.use('/news', newsRoutes.getRouter())

    // Trading Journal routes
    const tradingJournalRoutes = new TradingJournalRoutes()
    this.router.use('/trading-journal', tradingJournalRoutes.getRouter())

    // TradingView routes
    const tradingViewRoutes = new TradingViewRoutes()
    this.router.use('/tradingview', tradingViewRoutes.getRouter())

    // Tradesea routes (OTP login, connection status)
    const tradeseaRoutes = new TradeseaRoutes()
    this.router.use('/tradesea', tradeseaRoutes.getRouter())

    // Practice sim accounts (eval/funded)
    const practiceRoutes = new PracticeRoutes()
    this.router.use('/practice', practiceRoutes.getRouter())

    // Historical backtester (CSV replay sessions)
    const backtesterRoutes = new BacktesterRoutes()
    this.router.use('/backtester', backtesterRoutes.getRouter())

    // Dev/debug: persisted chart history for indicator debugging
    const debugRoutes = new DebugRoutes()
    this.router.use('/debug', debugRoutes.getRouter())
  }

  /**
   * Get router instance
   */
  getRouter() {
    return this.router
  }
}

export default Routes
