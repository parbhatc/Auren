import { EconomicNewsController } from './EconomicNewsController.js'

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function parseFfTimeEt(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (!s || /all day|tentative|^day \d|^\d+$/.test(s)) return null
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2]
  if (m[3] === 'pm' && h !== 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}`
}

function formatEvent(ev) {
  const impactRaw = String(ev.impact || 'low').toLowerCase()
  const impact =
    impactRaw === 'high' ? 'High' : impactRaw === 'medium' ? 'Medium' : impactRaw === 'holiday' ? 'Holiday' : 'Low'
  const timeLabel = ev.timeLabel || ev.time || '—'
  return {
    id: ev.id || null,
    title: ev.event || ev.name || 'Unknown',
    country: ev.currency || ev.country || 'N/A',
    impact,
    hmEt: parseFfTimeEt(timeLabel),
    timeLabel,
    forecast: ev.forecast || null,
    previous: ev.previous || null,
    actual: ev.actual || null,
    url: ev.url || null,
  }
}

function eventMatchesTypes(title, types) {
  const t = String(title ?? '').trim().toLowerCase()
  for (const type of types) {
    if (type === 'ppi' && (/^core ppi m\/m$/.test(t) || /^ppi m\/m$/.test(t))) return true
    if (type === 'cpi' && (/^core cpi m\/m$/.test(t) || /^cpi m\/m$/.test(t))) return true
    if (
      type === 'fomc' &&
      /^fomc (statement|press conference|economic projections|meeting minutes)$/.test(t)
    ) {
      return true
    }
    if (type === 'nfp' && /^non-?farm employment change$/.test(t)) return true
    if (type && t.includes(type)) return true
  }
  return false
}

function hmToMinutes(hm) {
  const p = String(hm).split(':')
  if (p.length < 2) return null
  return Number(p[0]) * 60 + Number(p[1])
}

/**
 * BetterweightChartPro-compatible ForexFactory news API (uses Auren scraped calendar cache).
 */
class NewsController {
  static newsConfig(_req, res) {
    res.json({
      sources: [{ id: 'forexfactory', label: 'ForexFactory' }],
      default_source: 'forexfactory',
      default_types: ['ppi', 'cpi', 'fomc', 'nfp'],
      default_currencies: 'USD',
      time_zone: 'America/New_York',
      endpoints: {
        config: '/news/config',
        calendar: '/news/calendar?day=YYYY-MM-DD&source=forexfactory&currencies=USD',
      },
    })
  }

  static async newsCalendar(req, res) {
    try {
      const dayYmd = String(req.query.day || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYmd)) {
        return res.status(400).json({ error: 'day=YYYY-MM-DD required', events: [] })
      }

      const source = String(req.query.source || 'forexfactory').toLowerCase()
      if (source !== 'forexfactory') {
        return res.status(400).json({ error: `Unknown news source: ${source}`, day: dayYmd, events: [] })
      }

      const [year, month] = dayYmd.split('-').map(Number)
      const controller = new EconomicNewsController()
      let events = await controller.getEventsFromFile(year, month)

      if (!events.length) {
        try {
          const scraped = await controller.scrapeForexFactory(year, month)
          await controller.saveEvents(scraped, year, month)
          events = await controller.getEventsFromFile(year, month)
        } catch (err) {
          console.warn('[News] scrape on calendar request failed:', err.message || err)
        }
      }

      const currencySet = new Set(
        String(req.query.currencies || 'USD')
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      )
      const impactFilter = String(req.query.impact || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      const typeFilter = String(req.query.types || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)

      const raw = events.filter((ev) => {
        const date = ev.date || dayYmd
        return date === dayYmd
      })

      const out = []
      for (const ev of raw) {
        const country = String(ev.currency || ev.country || '').toUpperCase()
        if (currencySet.size && !currencySet.has(country) && country !== 'ALL') continue
        const impact = String(ev.impact || 'low').toLowerCase()
        if (impactFilter.length && !impactFilter.includes(impact)) continue
        const formatted = formatEvent(ev)
        if (typeFilter.length && !eventMatchesTypes(formatted.title, typeFilter)) continue
        out.push(formatted)
      }

      out.sort((a, b) => {
        const am = a.hmEt ? hmToMinutes(a.hmEt) : 9999
        const bm = b.hmEt ? hmToMinutes(b.hmEt) : 9999
        if (am !== bm) return am - bm
        return a.title.localeCompare(b.title)
      })

      res.json({
        day: dayYmd,
        source: 'forexfactory',
        timeZone: 'America/New_York',
        file: `${MONTH_NAMES[month - 1]}.json`,
        events: out,
      })
    } catch (error) {
      console.error('[News] calendar error:', error)
      res.status(502).json({
        error: error.message || 'Calendar failed',
        events: [],
      })
    }
  }
}

export default NewsController
