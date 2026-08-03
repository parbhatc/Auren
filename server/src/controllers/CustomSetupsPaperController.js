import CustomSetupsPaperService from '../services/CustomSetupsPaperService.js'

class CustomSetupsPaperController {
  getSnapshot(req, res) {
    const limit = Number(req.query.limit)
    res.json({ success: true, data: CustomSetupsPaperService.snapshot(limit) })
  }
}

export default new CustomSetupsPaperController()
