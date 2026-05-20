import cors from 'cors'

/**
 * CORS middleware configuration class
 */
class CorsMiddleware {
  constructor() {
    this.corsOptions = {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }
  }

  /**
   * Get CORS middleware
   */
  getMiddleware() {
    return cors(this.corsOptions)
  }
}

export default new CorsMiddleware()

