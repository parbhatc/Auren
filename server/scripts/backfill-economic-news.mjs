import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { launchChrome } from 'chrome-pro-x/src/launch-chrome.js'
import news from '../src/controllers/EconomicNewsController.js'

const timezone = 'America/New_York'
const easternDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
})
const easternTime = new Intl.DateTimeFormat('en-US', {
  timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true,
})
const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const impacts = new Set(['low', 'medium', 'high', 'holiday'])
const currentMonth = easternDate.format().slice(0, 7)
const [first = '2010-01', last = currentMonth] = process.argv.slice(2)
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/
if (!monthPattern.test(first) || !monthPattern.test(last) || first > last || last > currentMonth) {
  throw new Error('Usage: node server/scripts/backfill-economic-news.mjs [YYYY-MM] [YYYY-MM]')
}

async function readMonth(page, year, month) {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const query = new URLSearchParams({
    month: `${monthNames[month - 1]}.${year}`,
    currencies: '1,2,3,4,5,6,7,8,9',
    event_types: '1,2,3,4,5,7,8,9,10,11',
    impacts: '3,2,1,0',
    permalink: '1',
  })
  const response = await page.goto(`https://www.forexfactory.com/calendar?${query}`, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  })
  if (!response?.ok()) throw new Error(`Forex Factory returned HTTP ${response?.status()}`)

  // The initial table only renders a few days, but the page state contains the full month.
  const payload = await page.evaluate(() => ({
    timezone: window.FF?.timezone_name,
    days: window.calendarComponentStates?.[1]?.days,
  }))
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (payload.timezone !== timezone || payload.days?.length !== dayCount) {
    throw new Error(`Incomplete calendar or unexpected timezone for ${monthKey}`)
  }

  const events = []
  const ids = new Set()
  for (const [index, day] of payload.days.entries()) {
    const date = `${monthKey}-${String(index + 1).padStart(2, '0')}`
    if (easternDate.format(day.dateline * 1000) !== date || !Array.isArray(day.events)) {
      throw new Error(`Calendar day is missing or out of order at ${date}`)
    }
    for (const event of day.events) {
      if (!Number.isSafeInteger(event.id) || ids.has(event.id) || !event.name?.trim()
        || !event.currency || !impacts.has(event.impactName)) {
        throw new Error(`Invalid or duplicate calendar event on ${date}: ${event.id}`)
      }
      ids.add(event.id)
      const timeLabel = event.timeLabel?.trim() || (
        event.timeMasked || !event.dateline
          ? 'All Day'
          : easternTime.format(event.dateline * 1000).replace(/\s/g, '').toLowerCase()
      )
      events.push({ ...event, date, timeLabel })
    }
  }
  if (!events.length) throw new Error(`No events for ${monthKey}`)
  return news.formatForexFactoryEvents(events, year, month)
}

async function saveMonth(file, events) {
  const eventsByDate = {}
  for (const event of events) (eventsByDate[event.date] ??= []).push(event)
  const data = {
    events: eventsByDate,
    coverage: 'month',
    lastUpdated: new Date().toISOString(),
  }
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(data, null, 2), { flag: 'wx' })
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true })
  }
}

const months = []
for (const date = new Date(`${first}-01T00:00:00Z`); date.toISOString().slice(0, 7) <= last; date.setUTCMonth(date.getUTCMonth() + 1)) {
  months.push({ key: date.toISOString().slice(0, 7), year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 })
}

const browser = await launchChrome({ headless: true })
try {
  const page = await browser.newPage()
  await page.emulateTimezone(timezone)
  await page.setCookie({
    name: 'fftimezone', value: encodeURIComponent(timezone), domain: '.forexfactory.com', path: '/',
  })
  await page.setRequestInterception(true)
  page.on('request', request => {
    const { hostname } = new URL(request.url())
    const sameSite = hostname === 'forexfactory.com' || hostname.endsWith('.forexfactory.com')
    const needed = sameSite && !['image', 'font', 'media', 'stylesheet'].includes(request.resourceType())
    void (needed ? request.continue() : request.abort()).catch(() => {})
  })

  const failures = []
  for (const { key, year, month } of months) {
    const file = news.getFilePath(year, month)
    let cached
    try {
      cached = JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (key !== currentMonth && cached?.coverage === 'month') continue

    try {
      let events
      try {
        events = await readMonth(page, year, month)
      } catch (error) {
        console.warn(`${key} retrying: ${error.message}`)
        await delay(10000)
        events = await readMonth(page, year, month)
      }
      await saveMonth(file, events)
      console.log(`${key} saved ${events.length} events`)
    } catch (error) {
      failures.push(key)
      console.error(`${key} failed: ${error.message}`)
    }
    await delay(750)
  }
  if (failures.length) throw new Error(`Unfilled months: ${failures.join(', ')}`)
} finally {
  await browser.close()
}
