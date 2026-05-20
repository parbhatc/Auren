import { HTTP_STATUS } from '../config/constants.js'

/**
 * Error handling middleware class
 */
class ErrorHandler {
  /**
   * Handle validation errors
   */
  handleValidationError(res, message) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message,
    })
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(res, message) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message,
    })
  }

  /**
   * Handle not found errors
   */
  handleNotFoundError(res, message = 'Resource not found') {
    return res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      message,
    })
  }

  /**
   * Handle server errors
   */
  handleServerError(res, error) {
    console.error('Server error:', error)
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
    })
  }
}

export default new ErrorHandler()

