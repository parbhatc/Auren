import { launchChrome } from 'chrome-pro-x/src/launch-chrome.js'
import { ChromeApi } from 'chrome-pro-x/src/chrome-api.js'
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
const FOREX_FACTORY_WEEKLY_JSON_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
const LIVE_CACHE_TTL_MS = 10 * 60 * 1000
const monthLoads = new Map()
const monthFailures = new Map()

/**
 * Economic News Controller
 * Handles economic calendar data scraping from ForexFactory
 */
class EconomicNewsController {
  isCurrentMonth(year, month) {
    const now = new Date()
    return year === now.getFullYear() && month === now.getMonth() + 1
  }

  mergeEvents(existing, incoming) {
    const byKey = new Map()
    for (const event of [...existing, ...incoming]) {
      const key = [event.date, event.timeLabel || event.time, event.currency, event.event].join('|').toLowerCase()
      byKey.set(key, { ...(byKey.get(key) || {}), ...event })
    }
    return [...byKey.values()]
  }

  async refreshCurrentWeek(year, month) {
    const existing = await this.getEventsFromFile(year, month)
    let weekly
    try {
      weekly = await this.fetchForexFactoryWeeklyJson(year, month)
    } catch (error) {
      if (existing.length) {
        console.warn(`[News] Live ForexFactory refresh failed; using ${existing.length} cached events:`, error.message)
        return existing
      }
      throw error
    }
    if (!weekly.length) {
      if (existing.length) return existing
      throw new Error('ForexFactory weekly export returned no calendar data. Please retry shortly.')
    }
    const merged = this.mergeEvents(existing, weekly)
    await this.saveEvents(merged, year, month)
    return this.getEventsFromFile(year, month)
  }

  async refreshCurrentMonth(year, month) {
    try {
      const events = await this.scrapeForexFactory(year, month)
      if (!events.length) throw new Error('ChromeProX returned no monthly calendar data')
      events.coverage = 'month'
      await this.saveEvents(events, year, month)
      return this.getEventsFromFile(year, month)
    } catch (error) {
      console.warn('[News] ChromeProX monthly refresh failed; falling back to the official weekly export:', error.message)
      return this.refreshCurrentWeek(year, month)
    }
  }

  /** A weekly export is never proof that the requested replay month is loaded. */
  async ensureMonth(year, month) {
    const key = `${year}-${month}`
    const saved = await this.loadNewsData(year, month)
    const cacheAge = saved?.lastUpdated ? Date.now() - new Date(saved.lastUpdated).getTime() : Infinity
    if (this.isCurrentMonth(year, month) && cacheAge >= 0 && cacheAge < LIVE_CACHE_TTL_MS) {
      return this.getEventsFromFile(year, month)
    }
    // Current-month values can change throughout the week, even if an older
    // full-month cache exists, so always refresh the official live export.
    if (!this.isCurrentMonth(year, month) && saved?.coverage === 'month') {
      return this.getEventsFromFile(year, month)
    }
    if (monthLoads.has(key)) return monthLoads.get(key)
    const failure = monthFailures.get(key)
    if (failure && Date.now() - failure.time < 60000) throw failure.error
    const task = (async () => {
      try {
        // ChromeProX reads every weekly page for the live month. The official
        // weekly export remains only as a fallback if browser loading fails.
        if (this.isCurrentMonth(year, month)) {
          const events = await this.refreshCurrentMonth(year, month)
          monthFailures.delete(key)
          return events
        }
        const events = await this.scrapeForexFactory(year, month)
        if (!events.length) throw new Error('Monthly news download returned no calendar data. Please retry shortly.')
        events.coverage = 'month'
        await this.saveEvents(events, year, month)
        monthFailures.delete(key)
        return this.getEventsFromFile(year, month)
      } catch (error) {
        monthFailures.set(key, { time: Date.now(), error })
        throw error
      } finally {
        monthLoads.delete(key)
      }
    })()
    monthLoads.set(key, task)
    return task
  }
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
   * Normalize ForexFactory's official weekly JSON export into Auren's cache
   * format. The export timestamps include an Eastern offset, but formatting in
   * America/New_York also keeps this correct across DST boundaries.
   */
  formatForexFactoryJsonEvents(events, year, month) {
    if (!Array.isArray(events)) return []

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    return events.flatMap((event, index) => {
      const timestamp = new Date(event?.date)
      if (Number.isNaN(timestamp.getTime())) return []

      const parts = dateFormatter.formatToParts(timestamp)
      const eventYear = Number(parts.find((part) => part.type === 'year')?.value)
      const eventMonth = Number(parts.find((part) => part.type === 'month')?.value)
      const eventDay = parts.find((part) => part.type === 'day')?.value
      if (eventYear !== year || eventMonth !== month || !eventDay) return []

      const date = `${eventYear}-${String(eventMonth).padStart(2, '0')}-${eventDay}`
      const title = String(event.title || event.event || '').trim()
      if (!title) return []

      const currency = String(event.country || event.currency || 'N/A').trim().toUpperCase()
      const timeLabel = timeFormatter.format(timestamp).replace(/\s+/g, '').toLowerCase()
      const impactRaw = String(event.impact || 'low').trim().toLowerCase()
      const impact = ['high', 'medium', 'low', 'holiday'].includes(impactRaw) ? impactRaw : 'low'
      const idSeed = `${date}-${timeLabel}-${currency}-${title}-${index}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      return [{
        id: `ff-${idSeed}`,
        date,
        time: timeLabel,
        timeLabel,
        currency,
        event: title,
        impact,
        forecast: event.forecast || null,
        previous: event.previous || null,
        actual: event.actual || null,
      }]
    })
  }

  /**
   * Fetch ForexFactory's official JSON export. This endpoint is more reliable
   * than scraping the protected calendar page and supplies the current week,
   * which is the data the live chart needs.
   */
  async fetchForexFactoryWeeklyJson(year, month) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(FOREX_FACTORY_WEEKLY_JSON_URL, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Auren Economic Calendar/1.0',
        },
      })
      if (!response.ok) {
        throw new Error(`ForexFactory JSON export returned HTTP ${response.status}`)
      }
      const payload = await response.json()
      if (!Array.isArray(payload)) {
        throw new Error('ForexFactory JSON export returned an invalid payload')
      }
      return this.formatForexFactoryJsonEvents(payload, year, month)
    } finally {
      clearTimeout(timeout)
    }
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
        coverage: events.coverage === 'month' ? 'month' : 'partial',
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

  async extractForexFactoryPageEvents(page, year, month) {
    return page.evaluate(({ requestedYear, requestedMonth }) => {
      const monthIndexes = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
      }
      const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
      const events = []
      let currentDate = null
      let currentTime = null

      for (const row of document.querySelectorAll('tr.calendar__row')) {
        if (row.classList.contains('calendar__row--day-breaker')) {
          const match = clean(row.textContent).match(/\b([A-Za-z]{3})\s+(\d{1,2})\b/)
          const eventMonth = match ? monthIndexes[match[1].toLowerCase()] : null
          currentDate = eventMonth
            ? `${requestedYear}-${String(eventMonth).padStart(2, '0')}-${String(Number(match[2])).padStart(2, '0')}`
            : null
          currentTime = null
          continue
        }

        const title = clean(row.querySelector('.calendar__event-title')?.textContent)
        if (!title || !currentDate) continue
        const displayedTime = clean(row.querySelector('.calendar__time')?.textContent)
        if (displayedTime) currentTime = displayedTime
        const impactText = clean(row.querySelector('.calendar__impact [title]')?.getAttribute('title')).toLowerCase()
        let impactName = 'low'
        if (impactText.includes('high')) impactName = 'high'
        else if (impactText.includes('medium')) impactName = 'medium'
        else if (impactText.includes('non-economic') || /holiday/i.test(title)) impactName = 'holiday'

        events.push({
          id: row.getAttribute('data-event-id'),
          date: currentDate,
          timeLabel: currentTime || 'All Day',
          currency: clean(row.querySelector('.calendar__currency')?.textContent),
          name: title,
          impactName,
          actual: clean(row.querySelector('.calendar__actual')?.textContent),
          forecast: clean(row.querySelector('.calendar__forecast')?.textContent),
          previous: clean(row.querySelector('.calendar__previous')?.textContent),
        })
      }

      const prefix = `${requestedYear}-${String(requestedMonth).padStart(2, '0')}-`
      return events.filter((event) => event.date.startsWith(prefix))
    }, { requestedYear: year, requestedMonth: month })
  }

  /**
   * Scrape economic calendar from ForexFactory
   */
  async scrapeForexFactory(year, month) {
    let browser = null
    try {
      // ForexFactory lazy-loads its month view. Visit every weekly route for
      // speed, then fill any missing dates from direct day routes.
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      const firstDay = new Date(Date.UTC(year, month - 1, 1))
      const lastDay = new Date(Date.UTC(year, month, 0))
      const firstWeek = new Date(firstDay)
      firstWeek.setUTCDate(firstWeek.getUTCDate() - firstWeek.getUTCDay())
      const weekStarts = []
      for (const date = new Date(firstWeek); date <= lastDay; date.setUTCDate(date.getUTCDate() + 7)) {
        weekStarts.push(new Date(date))
      }

      console.log(`[News] Scraping ForexFactory with ChromeProX: ${year}-${String(month).padStart(2, '0')} (${weekStarts.length} weeks)`)

      browser = await launchChrome({ headless: true })
      const page = await browser.newPage()
      const chrome = await ChromeApi.connect(page)
      
      // Pin the browser to US Eastern so ForexFactory renders event times in ET
      // regardless of the host machine's timezone (VPS clocks vary) — the client
      // converts ET to the viewer's timezone at display time.
      await page.emulateTimezone('America/New_York')
      // ForexFactory also honors an explicit timezone cookie — set it so guest
      // sessions don't fall back to IP-based detection.
      await page.setCookie({
        name: 'fftimezone',
        value: 'America%2FNew_York',
        domain: '.forexfactory.com',
        path: '/',
      })

      const domEvents = []
      for (const weekStart of weekStarts) {
        const weekName = monthNames[weekStart.getUTCMonth()]
        const weekKey = `${weekName}${weekStart.getUTCDate()}.${weekStart.getUTCFullYear()}`
        const url = `https://www.forexfactory.com/calendar?week=${weekKey}`
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
        await page.waitForSelector('tr.calendar__row', { timeout: 15000 })

        // ForexFactory initially renders only the first portion of a week.
        // One ChromeProX "More" interaction reveals the remaining days.
        const initialEventCount = await page.$$eval('.calendar__event-title', (elements) => elements.length)
        try {
          await chrome.click({ selector: 'a', text: 'More', placement: 'center', timeout: 5000 })
          await page.waitForFunction(
            (count) => document.querySelectorAll('.calendar__event-title').length > count,
            { timeout: 5000 },
            initialEventCount
          )
        } catch (error) {
          console.warn(`[News] ChromeProX could not expand ${weekKey}; using the loaded rows:`, error.message)
        }

        const weekEvents = await this.extractForexFactoryPageEvents(page, year, month)
        domEvents.push(...weekEvents)
      }

      // Weekly pages are lazily rendered and can omit entire days. Fill only
      // those gaps from the direct day routes instead of making 30 requests.
      const loadedDates = new Set(domEvents.map((event) => event.date))
      for (let day = 1; day <= lastDay.getUTCDate(); day++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        if (loadedDates.has(date)) continue
        const dayKey = `${monthNames[month - 1]}${day}.${year}`
        const url = `https://www.forexfactory.com/calendar?day=${dayKey}`
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
        await page.waitForSelector('tr.calendar__row', { timeout: 15000 })
        const dayEvents = await this.extractForexFactoryPageEvents(page, year, month)
          .then((events) => events.filter((event) => event.date === date))
        domEvents.push(...dayEvents)
      }

      await browser.close()
      browser = null

      const unique = [...new Map(domEvents.map((event) => [event.id || `${event.date}|${event.timeLabel}|${event.currency}|${event.name}`, event])).values()]
      if (!unique.length) throw new Error('ChromeProX found no Forex Factory calendar events')
      console.log(`[News] Extracted ${unique.length} monthly events with ChromeProX`)
      const events = this.formatForexFactoryEvents(unique, year, month)
      events.coverage = 'month'
      return events
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
      } else if (event.impactName === 'holiday') {
        impact = 'holiday'
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
    throw new Error('Monthly news calendar could not be downloaded from Forex Factory (calendar unavailable or access blocked).')
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
              id: event.id || undefined,
              date: date, // Include the date from the key
              time: event.time || event.timeLabel || '',
              timeLabel: event.timeLabel || event.time || '',
              currency: event.currency || '',
              impact: (event.impact || 'low').toLowerCase(),
              event: event.event || event.name || '',
              forecast: event.forecast || undefined,
              previous: event.previous || undefined,
              actual: event.actual || undefined,
              url: event.url || undefined,
            })
          })
        })
        return allEvents
      }
      
      // Old format (shouldn't happen after migration)
      if (Array.isArray(data.events)) {
        return data.events.map(event => ({
          id: event.id || undefined,
          date: event.date || undefined,
          time: event.time || '',
          timeLabel: event.timeLabel || event.time || '',
          currency: event.currency || '',
          impact: (event.impact || 'low').toLowerCase(),
          event: event.event || '',
          forecast: event.forecast || undefined,
          previous: event.previous || undefined,
          actual: event.actual || undefined,
          url: event.url || undefined,
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

      let events = []
      try {
        events = await this.ensureMonth(year, month)
      } catch (scrapeError) {
        console.error('Error loading events:', scrapeError)
        // Preserve already-cached events when ForexFactory is temporarily down.
        events = await this.getEventsFromFile(year, month)
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

      let savedEvents
      if (this.isCurrentMonth(year, month)) {
        savedEvents = await this.refreshCurrentMonth(year, month)
      } else {
        const events = await this.scrapeForexFactory(year, month)
        events.coverage = 'month'
        await this.saveEvents(events, year, month)
        savedEvents = await this.getEventsFromFile(year, month)
      }

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
