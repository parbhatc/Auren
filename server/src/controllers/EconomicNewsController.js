import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ErrorHandler from '../middleware/ErrorHandler.js'
import { HTTP_STATUS } from '../config/constants.js'
import translator from '../utils/Translator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// News data directory: data/news/{year}/{month}.json
const NEWS_DIR = path.join(__dirname, '../../data/news')

/**
 * Economic News Controller
 * Handles economic calendar data scraping from ForexFactory
 */
class EconomicNewsController {
  /**
   * Static methods for scheduler access
   */
  static async scrapeForexFactory(year, month) {
    const instance = new EconomicNewsController()
    return instance.scrapeForexFactory(year, month)
  }

  static async saveEvents(events, year, month) {
    const instance = new EconomicNewsController()
    return instance.saveEvents(events, year, month)
  }

  /**
   * Ensure news directory exists
   */
  async ensureNewsDir(year) {
    const yearDir = path.join(NEWS_DIR, year.toString())
    try {
      await fs.promises.mkdir(yearDir, { recursive: true })
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error
      }
    }
    return yearDir
  }

  /**
   * Get file path for economic news data
   */
  getFilePath(year, month) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const monthName = monthNames[month - 1]
    return path.join(NEWS_DIR, year.toString(), `${monthName}.json`)
  }

  /**
   * Save events to JSON file
   * New format: { events: { "2025-11-01": [...], "2025-11-02": [...], ... } }
   */
  async saveEvents(events, year, month) {
    try {
      await this.ensureNewsDir(year)
      const filePath = this.getFilePath(year, month)
      
      console.log(`[News] Saving ${events.length} events for ${year}-${String(month).padStart(2, '0')}`)
      
      // Group events by date (YYYY-MM-DD format)
      const eventsByDate = {}
      let totalEvents = 0
      let skippedEvents = 0
      
      events.forEach(event => {
        let eventDate = event.date
        
        // If date is null/undefined, try to extract from other fields
        if (!eventDate) {
          if (event.timeLabel) {
            const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
            const timeLower = event.timeLabel.toLowerCase()
            for (let i = 0; i < monthNames.length; i++) {
              if (timeLower.includes(monthNames[i])) {
                const dayMatch = timeLower.match(/\b(\d{1,2})\b/)
                if (dayMatch) {
                  const day = parseInt(dayMatch[1])
                  eventDate = `${year}-${String(i + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  break
                }
              }
            }
          }
        }
        
        // If date contains HTML or is not in YYYY-MM-DD format, try to parse it
        if (eventDate && typeof eventDate === 'string' && eventDate.includes('<')) {
          eventDate = eventDate.replace(/<[^>]*>/g, '').trim()
        }
        
        // Try to parse date from various formats if not already YYYY-MM-DD
        if (eventDate && typeof eventDate === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
          if (/^\d+$/.test(eventDate)) {
            try {
              const dateObj = new Date(parseInt(eventDate))
              if (!isNaN(dateObj.getTime())) {
                eventDate = dateObj.toISOString().split('T')[0]
              }
            } catch (e) {
              // Continue
            }
          }
          
          if (eventDate.includes('T')) {
            eventDate = eventDate.split('T')[0]
          }
          
          if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
            try {
              const dateObj = new Date(eventDate)
              if (!isNaN(dateObj.getTime())) {
                eventDate = dateObj.toISOString().split('T')[0]
              }
            } catch (e) {
              // Continue
            }
          }
          
          // Try to extract date from strings like "Sun Nov 2" or "Nov 2"
          if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
            const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
            const dateLower = eventDate.toLowerCase()
            for (let i = 0; i < monthNames.length; i++) {
              if (dateLower.includes(monthNames[i])) {
                const dayMatch = dateLower.match(/\b(\d{1,2})\b/)
                if (dayMatch) {
                  const day = parseInt(dayMatch[1])
                  eventDate = `${year}-${String(i + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  break
                }
              }
            }
          }
        }
        
        // If eventDate is a Date object, convert to string
        if (eventDate instanceof Date) {
          eventDate = eventDate.toISOString().split('T')[0]
        }
        
        // Validate date format
        if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
          skippedEvents++
          console.warn(`[News] Event missing or invalid date, skipping:`, {
            id: event.id,
            event: event.event || event.name,
            originalDate: event.date,
            timeLabel: event.timeLabel,
            time: event.time
          })
          return
        }
        
        // Initialize array for this date if it doesn't exist
        if (!eventsByDate[eventDate]) {
          eventsByDate[eventDate] = []
        }
        
        // Ensure the event has the date field set
        const eventWithDate = {
          ...event,
          date: eventDate
        }
        
        eventsByDate[eventDate].push(eventWithDate)
        totalEvents++
      })
      
      const data = {
        events: eventsByDate,
        lastUpdated: new Date().toISOString()
      }
      
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
      console.log(`[News] Saved ${totalEvents} events across ${Object.keys(eventsByDate).length} days for ${year}-${String(month).padStart(2, '0')}${skippedEvents > 0 ? ` (${skippedEvents} skipped)` : ''}`)
      return data
    } catch (error) {
      console.error(`[News] Error saving news data:`, error)
      throw error
    }
  }

  /**
   * Load news data from file
   * Supports both old format { year, month, events: [...] } and new format { events: { date: [...] } }
   */
  async loadNewsData(year, month) {
    try {
      const filePath = this.getFilePath(year, month)
      
      if (!fs.existsSync(filePath)) {
        return null
      }
      
      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'))
      
      // Check if it's the new format (has events object with date keys)
      if (data.events && typeof data.events === 'object' && !Array.isArray(data.events)) {
        return data // New format
      }
      
      // Old format - convert to new format
      if (data.events && Array.isArray(data.events)) {
        console.log(`[News] Converting old format to new format for ${year}-${month}`)
        // Re-save in new format
        await this.saveEvents(data.events, year, month)
        // Reload
        return await this.loadNewsData(year, month)
      }
      
      return data
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null // File doesn't exist
      }
      throw error
    }
  }

  /**
   * Scrape economic calendar from ForexFactory
   */
  async scrapeForexFactory(year, month) {
    let browser = null
    try {
      // Format month for URL (e.g., jan1.2025)
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      const monthName = monthNames[month - 1]
      const url = `https://www.forexfactory.com/calendar?month=${monthName}1.${year}`

      console.log(`[News] Scraping ForexFactory: ${url}`)

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--disable-gpu', '--window-size=1920x1080'],
      })
      const page = await browser.newPage()
      
      // Set user agent and viewport
      await page.setViewport({ width: 1920, height: 1080 })
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36')
      
      // Set additional headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      })
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Wait for calendar data to load
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Try to extract calendar data directly from JavaScript context
      let calendarData = null
      try {
        calendarData = await page.evaluate(() => {
          if (window.calendarComponentStates && window.calendarComponentStates[1]) {
            return window.calendarComponentStates[1]
          }
          return null
        })
      } catch (error) {
        console.warn('[News] Could not extract calendar data from window object:', error.message)
      }

      // If we got the data directly, use it
      if (calendarData && calendarData.days) {
        const allEvents = []
        console.log(`[News] Processing ${calendarData.days.length} days from calendar data`)
        
        // Extract year and month from URL for fallback
        const urlMatch = url.match(/month=(\w+)(\d+)\.(\d+)/)
        let defaultYear = null
        let defaultMonthIndex = null
        if (urlMatch) {
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
          const monthName = urlMatch[1].toLowerCase()
          defaultYear = parseInt(urlMatch[3])
          defaultMonthIndex = monthNames.indexOf(monthName)
        }
        
        for (let dayIndex = 0; dayIndex < calendarData.days.length; dayIndex++) {
          const day = calendarData.days[dayIndex]
          if (day.events && Array.isArray(day.events)) {
            // Normalize date to YYYY-MM-DD format
            let normalizedDate = null
            
            // Try dateline field (Unix timestamp) - PRIMARY SOURCE
            if (!normalizedDate && day.dateline !== undefined && day.dateline !== null) {
              try {
                const timestamp = typeof day.dateline === 'number' ? day.dateline : parseInt(day.dateline)
                if (!isNaN(timestamp) && timestamp > 0) {
                  const dateObj = new Date(timestamp * 1000)
                  if (!isNaN(dateObj.getTime())) {
                    // ForexFactory displays dates in US Eastern timezone
                    const formatter = new Intl.DateTimeFormat('en-US', {
                      timeZone: 'America/New_York',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })
                    
                    const parts = formatter.formatToParts(dateObj)
                    const year = parts.find(p => p.type === 'year').value
                    const month = parts.find(p => p.type === 'month').value
                    const dayNum = parts.find(p => p.type === 'day').value
                    
                    normalizedDate = `${year}-${month}-${dayNum}`
                  }
                }
              } catch (e) {
                console.warn(`[News] Could not parse dateline: ${day.dateline}`, e.message)
              }
            }
            
            // Try day.date field
            if (!normalizedDate && day.date !== undefined && day.date !== null) {
              try {
                let dateStr = day.date
                if (typeof dateStr === 'number') {
                  const dateObj = new Date(dateStr)
                  if (!isNaN(dateObj.getTime())) {
                    normalizedDate = dateObj.toISOString().split('T')[0]
                  }
                } else if (dateStr instanceof Date) {
                  normalizedDate = dateStr.toISOString().split('T')[0]
                } else if (typeof dateStr === 'string') {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    normalizedDate = dateStr
                  } else if (dateStr.includes('T')) {
                    normalizedDate = dateStr.split('T')[0]
                  } else {
                    const dateObj = new Date(dateStr)
                    if (!isNaN(dateObj.getTime())) {
                      normalizedDate = dateObj.toISOString().split('T')[0]
                    }
                  }
                }
              } catch (e) {
                // Continue
              }
            }
            
            // Use day index as fallback
            if (!normalizedDate && defaultYear && defaultMonthIndex !== -1) {
              const estimatedDay = dayIndex + 1
              const daysInMonth = new Date(defaultYear, defaultMonthIndex + 1, 0).getDate()
              if (estimatedDay >= 1 && estimatedDay <= daysInMonth) {
                normalizedDate = `${defaultYear}-${String(defaultMonthIndex + 1).padStart(2, '0')}-${String(estimatedDay).padStart(2, '0')}`
              }
            }
            
            // Add normalized date to each event
            const dayEvents = day.events.map(event => ({
              ...event,
              date: normalizedDate
            }))
            
            if (normalizedDate) {
              allEvents.push(...dayEvents)
            }
          }
        }
        
        console.log(`[News] Extracted ${allEvents.length} events directly from JavaScript context`)
        await browser.close()
        
        // Format events
        return this.formatForexFactoryEvents(allEvents, year, month)
      }
      
      // Fallback: Get the page content for HTML parsing
      const html = await page.content()
      await browser.close()
      
      // Parse HTML (simplified - you may want to enhance this)
      return this.parseEventsFromHTML(html, year, month)
    } catch (error) {
      if (browser) {
        await browser.close()
      }
      console.error('Error scraping ForexFactory:', error)
      throw error
    }
  }

  /**
   * Format ForexFactory events to our standard format
   */
  formatForexFactoryEvents(events, year, month) {
    return events.map((event) => {
      // Map impact names to our format
      let impact = 'low'
      if (event.impactName === 'high' || event.impactName === 'red') {
        impact = 'high'
      } else if (event.impactName === 'medium' || event.impactName === 'orange') {
        impact = 'medium'
      } else if (event.impactName === 'low' || event.impactName === 'yellow') {
        impact = 'low'
      }
      
      return {
        id: `${year}-${String(month).padStart(2, '0')}-${event.id || Date.now()}-${(event.name || '').substring(0, 20)}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase(),
        date: event.date || null,
        time: event.timeLabel || event.time || 'All Day',
        timeLabel: event.timeLabel || event.time || null,
        currency: event.currency || 'N/A',
        event: event.name || event.prefixedName || 'Unknown Event',
        impact: impact,
        forecast: (event.forecast && event.forecast !== '') ? event.forecast : null,
        previous: (event.previous && event.previous !== '') ? event.previous : null,
        actual: (event.actual && event.actual !== '') ? event.actual : null
      }
    }).filter(event => event.event && event.event !== 'Unknown Event')
  }

  /**
   * Parse events from HTML table (fallback method)
   */
  parseEventsFromHTML(html, year, month) {
    // Simplified HTML parsing - you may want to enhance this
    // For now, return empty array and rely on JavaScript extraction
    console.warn('[News] HTML parsing not fully implemented, relying on JavaScript extraction')
    return []
  }

  /**
   * Get events from JSON file
   */
  async getEventsFromFile(year, month) {
    try {
      const data = await this.loadNewsData(year, month)
      
      if (!data || !data.events) {
        return []
      }
      
      // New format: events is an object with date keys
      if (typeof data.events === 'object' && !Array.isArray(data.events)) {
        // Flatten all events from all dates
        const allEvents = []
        Object.keys(data.events).forEach(date => {
          data.events[date].forEach(event => {
            allEvents.push({
              date: date, // Include the date from the key
              time: event.time || event.timeLabel || '',
              currency: event.currency || '',
              impact: (event.impact || 'low').toLowerCase(),
              event: event.event || event.name || '',
              forecast: event.forecast || undefined,
              previous: event.previous || undefined,
              actual: event.actual || undefined,
            })
          })
        })
        return allEvents
      }
      
      // Old format (shouldn't happen after migration)
      if (Array.isArray(data.events)) {
        return data.events.map(event => ({
          date: event.date || undefined,
          time: event.time || '',
          currency: event.currency || '',
          impact: (event.impact || 'low').toLowerCase(),
          event: event.event || '',
          forecast: event.forecast || undefined,
          previous: event.previous || undefined,
          actual: event.actual || undefined,
        }))
      }
      
      return []
    } catch (error) {
      console.error('Error getting events from file:', error)
      return []
    }
  }

  /**
   * Get economic events for a specific month
   */
  async getEvents(req, res) {
    try {
      const year = parseInt(req.query.year) || new Date().getFullYear()
      const month = parseInt(req.query.month) || new Date().getMonth() + 1

      // Prevent fetching future months
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1
      
      if (year > currentYear || (year === currentYear && month > currentMonth)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Cannot fetch data for future months. Only current and previous months are available.',
        })
      }

      // Try to get from file first
      let events = await this.getEventsFromFile(year, month)

      // If no events in file, scrape and save (only for current or past months)
      if (events.length === 0) {
        try {
          const scrapedEvents = await this.scrapeForexFactory(year, month)
          await this.saveEvents(scrapedEvents, year, month)
          events = await this.getEventsFromFile(year, month)
        } catch (scrapeError) {
          console.error('Error scraping events:', scrapeError)
          events = []
        }
      }

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        events,
        count: events.length,
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }

  /**
   * Force refresh events for a specific month
   */
  async refreshEvents(req, res) {
    try {
      const year = parseInt(req.query.year) || new Date().getFullYear()
      const month = parseInt(req.query.month) || new Date().getMonth() + 1

      // Prevent fetching future months
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1
      
      if (year > currentYear || (year === currentYear && month > currentMonth)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: translator.t('economicNews.cannotRefreshFutureMonths'),
        })
      }

      // Scrape and save
      const events = await this.scrapeForexFactory(year, month)
      await this.saveEvents(events, year, month)
      const savedEvents = await this.getEventsFromFile(year, month)

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        events: savedEvents,
        count: savedEvents.length,
        message: 'Events refreshed successfully',
      })
    } catch (error) {
      return ErrorHandler.handleServerError(res, error)
    }
  }
}

// Export both the instance (for routes) and the class (for static methods)
const controller = new EconomicNewsController()
export default controller
export { EconomicNewsController }
