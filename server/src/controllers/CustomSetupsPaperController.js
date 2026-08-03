import CustomSetupsPaperService from '../services/CustomSetupsPaperService.js'

class CustomSetupsPaperController {
  getSnapshot(req, res) {
    const limit = Number(req.query.limit)
    const offset = Number(req.query.offset)
    res.json({ success: true, data: CustomSetupsPaperService.snapshot(limit, offset) })
  }
}

export default new CustomSetupsPaperController()
