import cors from 'cors'

/**
 * CORS middleware configuration class
 */
class CorsMiddleware {
  constructor() {
    const raw = process.env.CORS_ORIGIN || '*'
    const origins =
      raw === '*'
        ? '*'
        : raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
    this.corsOptions = {
      origin: origins === '*' || origins.length === 1 ? origins[0] ?? '*' : origins,
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

