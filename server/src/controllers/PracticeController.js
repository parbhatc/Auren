import PracticeService from '../services/PracticeService.js'
import PracticeOfflineBracketWatcher from '../services/practice/PracticeOfflineBracketWatcher.js'
import ErrorHandler from '../middleware/ErrorHandler.js'
import { HTTP_STATUS } from '../config/constants.js'

class PracticeController {
  async getMarketData(req, res) {
    try {
      const data = await PracticeService.getMarketData(req.user.id)
      res.status(HTTP_STATUS.OK).json({ success: true, settings: data })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async saveMarketData(req, res) {
    try {
      const data = await PracticeService.saveMarketData(req.user.id, req.body)
      res.status(HTTP_STATUS.OK).json({ success: true, settings: data })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async listAccounts(req, res) {
    try {
      const accounts = await PracticeService.listAccounts(req.user.id)
      res.status(HTTP_STATUS.OK).json({ success: true, accounts })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async getAccount(req, res) {
    try {
      const account = await PracticeService.getAccount(req.user.id, req.params.id)
      if (!account) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Account not found' })
      }
      res.status(HTTP_STATUS.OK).json({ success: true, account })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async createAccount(req, res) {
    try {
      const { mode, size, rules } = req.body
      if (!mode || !size) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'mode and size required' })
      }
      const account = await PracticeService.createAccount(req.user.id, { mode, size, rules })
      res.status(HTTP_STATUS.CREATED).json({ success: true, account })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async updateAccount(req, res) {
    try {
      const account = await PracticeService.updateAccount(req.user.id, req.params.id, req.body)
      if (!account) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Account not found' })
      }
      res.status(HTTP_STATUS.OK).json({ success: true, account })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async resetAccount(req, res) {
    try {
      const account = await PracticeService.resetAccount(req.user.id, req.params.id)
      if (!account) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Account not found' })
      }
      res.status(HTTP_STATUS.OK).json({ success: true, account })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async deleteAccount(req, res) {
    try {
      const ok = await PracticeService.deleteAccount(req.user.id, req.params.id)
      if (!ok) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Account not found' })
      }
      res.status(HTTP_STATUS.OK).json({ success: true })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async deleteAllAccounts(req, res) {
    try {
      await PracticeService.deleteAllAccounts(req.user.id)
      res.status(HTTP_STATUS.OK).json({ success: true })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async getPositions(req, res) {
    try {
      const positions = await PracticeService.getPositions(req.user.id, req.params.id)
      res.status(HTTP_STATUS.OK).json({ success: true, positions })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async upsertPosition(req, res) {
    try {
      const position = await PracticeService.upsertPosition(req.user.id, req.params.id, req.body)
      const account = await PracticeService.getAccount(req.user.id, req.params.id)
      res.status(HTTP_STATUS.OK).json({ success: true, position, account })
    } catch (error) {
      if (error.statusCode === 400) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: error.message })
      }
      ErrorHandler.handleServerError(res, error)
    }
  }

  async deletePosition(req, res) {
    try {
      await PracticeService.deletePosition(req.user.id, req.params.id, req.params.positionId)
      res.status(HTTP_STATUS.OK).json({ success: true })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async saveBracketSnapshot(req, res) {
    try {
      const snapshot = req.body?.snapshot ?? req.body
      const result = await PracticeService.saveBracketSnapshot(
        req.user.id,
        req.params.id,
        req.params.positionId,
        snapshot
      )
      if (!result) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Account not found' })
      }
      res.status(HTTP_STATUS.OK).json({ success: true, ...result })
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: error.message })
      }
      ErrorHandler.handleServerError(res, error)
    }
  }

  async clearPositions(req, res) {
    try {
      await PracticeService.clearPositions(req.user.id, req.params.id)
      res.status(HTTP_STATUS.OK).json({ success: true })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async getLockout(req, res) {
    try {
      const status = await PracticeService.getLockoutStatus(req.user.id, req.params.id)
      if (!status) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Account not found' })
      }
      res.status(HTTP_STATUS.OK).json({ success: true, lockout: status })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async setLockout(req, res) {
    try {
      const minutes = Number(req.body?.minutes) || 15
      const account = await PracticeService.setManualLockout(req.user.id, req.params.id, { minutes })
      if (!account) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Account not found' })
      }
      const lockout = await PracticeService.getLockoutStatus(req.user.id, req.params.id)
      res.status(HTTP_STATUS.OK).json({ success: true, account, lockout })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async clearLockout(req, res) {
    try {
      const account = await PracticeService.clearLockout(req.user.id, req.params.id)
      if (!account) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Account not found' })
      }
      const lockout = await PracticeService.getLockoutStatus(req.user.id, req.params.id)
      res.status(HTTP_STATUS.OK).json({ success: true, account, lockout })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async recordTrade(req, res) {
    try {
      const result = await PracticeService.recordTrade(req.user.id, req.params.id, req.body)
      const account = await PracticeService.getAccount(req.user.id, req.params.id)
      res.status(HTTP_STATUS.OK).json({ success: true, trade: result, account })
    } catch (error) {
      if (error.statusCode === 400) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: error.message })
      }
      ErrorHandler.handleServerError(res, error)
    }
  }

  async startOfflineBracketWatcher(req, res) {
    try {
      const result = await PracticeOfflineBracketWatcher.start(req.user.id, req.body)
      res.status(HTTP_STATUS.OK).json({ success: true, ...result })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async stopOfflineBracketWatcher(req, res) {
    try {
      const result = await PracticeOfflineBracketWatcher.stop(
        req.user.id,
        req.body?.reason || 'client_connected'
      )
      res.status(HTTP_STATUS.OK).json({ success: true, ...result })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }

  async getStats(req, res) {
    try {
      const stats = await PracticeService.getStats(req.user.id, req.params.id)
      if (!stats) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Account not found' })
      }
      res.status(HTTP_STATUS.OK).json({ success: true, stats })
    } catch (error) {
      ErrorHandler.handleServerError(res, error)
    }
  }
}

export default new PracticeController()
