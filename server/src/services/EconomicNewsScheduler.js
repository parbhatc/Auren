import { EconomicNewsController } from '../controllers/EconomicNewsController.js'

/**
 * Economic News Scheduler
 * Fetches economic calendar data every 2 hours
 */
class EconomicNewsScheduler {
  constructor() {
    this.intervalId = null
    this.isRunning = false
    this.fetchInterval = 2 * 60 * 60 * 1000 // 2 hours in milliseconds
  }

  /**
   * Check if last fetch was more than 2 hours ago
   */
  async shouldFetchOnStartup() {
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      
      const controller = new EconomicNewsController()
      const data = await controller.loadNewsData(year, month)
      
      // If no data exists, fetch on startup
      if (!data || !data.lastUpdated) {
        return true
      }
      
      // Check if last update was more than 2 hours ago
      const lastUpdated = new Date(data.lastUpdated)
      const timeSinceLastUpdate = now.getTime() - lastUpdated.getTime()
      
      return timeSinceLastUpdate >= this.fetchInterval
    } catch (error) {
      console.error('[Economic News Scheduler] Error checking last fetch time:', error)
      // On error, fetch on startup to be safe
      return true
    }
  }

  /**
   * Start the scheduler
   */
  async start() {
    if (this.isRunning) {
      console.log('Economic News Scheduler is already running')
      return
    }

    console.log('Starting Economic News Scheduler (every 2 hours)')
    this.isRunning = true

    // Check if we should fetch on startup (if last fetch was more than 2 hours ago)
    const shouldFetch = await this.shouldFetchOnStartup()
    if (shouldFetch) {
      console.log('[Economic News Scheduler] Last fetch was more than 2 hours ago, fetching on startup')
      await this.fetchCurrentMonth()
    } else {
      console.log('[Economic News Scheduler] Last fetch was recent, skipping startup fetch')
    }

    // Then fetch every 2 hours
    this.intervalId = setInterval(() => {
      this.fetchCurrentMonth()
    }, this.fetchInterval)
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      this.isRunning = false
      console.log('Economic News Scheduler stopped')
    }
  }

  /**
   * Fetch current month's data
   */
  async fetchCurrentMonth() {
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      console.log(`[Economic News Scheduler] Fetching data for ${year}-${month}`)
      
      const events = await EconomicNewsController.scrapeForexFactory(year, month)
      await EconomicNewsController.saveEvents(events, year, month)
      
      console.log(`[Economic News Scheduler] Successfully fetched ${events.length} events for ${year}-${month}`)
    } catch (error) {
      console.error('[Economic News Scheduler] Error fetching data:', error)
    }
  }
}

export default EconomicNewsScheduler

