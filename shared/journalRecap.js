export const MAX_JOURNAL_SCREENSHOTS = 4
export const MAX_JOURNAL_IMAGE_BYTES = 512 * 1024
export const JOURNAL_MISTAKE_TAGS = [
  'FOMO',
  'Moved stop',
  'Oversized',
  'Early exit',
  'Late entry',
  'Revenge trade',
  'Skipped confirmation',
]

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const object = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

/** Only embedded raster images are allowed: no SVG, external tracking URLs, or HTML. */
export function isJournalImage(dataUrl) {
  if (
    typeof dataUrl !== 'string' ||
    dataUrl.length > Math.ceil(MAX_JOURNAL_IMAGE_BYTES / 3) * 4 + 32
  )
    return false
  const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match || match[2].length % 4 !== 0) return false
  const bytes =
    (match[2].length * 3) / 4 - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0)
  if (bytes > MAX_JOURNAL_IMAGE_BYTES) return false
  const header = atob(match[2].slice(0, 24))
  if (match[1] === 'png') return header.startsWith('\x89PNG\r\n\x1a\n')
  if (match[1] === 'jpeg') return header.startsWith('\xff\xd8\xff')
  return header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP'
}

/** Shared by the editor and API; stable, bounded fields for old and new entries. */
export function normalizeJournalRecap(value) {
  const recap = object(value)
  const screenshots = Array.isArray(recap.screenshots) ? recap.screenshots : []
  if (screenshots.length > MAX_JOURNAL_SCREENSHOTS)
    throw new Error('Attach up to four screenshots per entry.')
  const normalizedImages = screenshots.map((image, index) => {
    if (!isJournalImage(image?.dataUrl))
      throw new Error('Screenshots must be PNG, JPEG, or WebP images up to 512 KB each.')
    return {
      id: text(image.id, 80) || `image-${index}`,
      caption: text(image.caption, 300),
      dataUrl: image.dataUrl,
      capturedAt: text(image.capturedAt, 80),
      chartResolution: text(image.chartResolution, 40),
      cursorTime: text(image.cursorTime, 80),
      annotations: (Array.isArray(image.annotations) ? image.annotations : [])
        .slice(0, 30)
        .filter(
          (mark) =>
            ['arrow', 'level'].includes(mark?.kind) &&
            ['x1', 'y1', 'x2', 'y2'].every(
              (key) =>
                typeof mark[key] === 'number' &&
                Number.isFinite(mark[key]) &&
                mark[key] >= 0 &&
                mark[key] <= 1
            )
        )
        .map(({ kind, x1, y1, x2, y2 }) => ({ kind, x1, y1, x2, y2 })),
    }
  })
  return {
    riskDollars:
      Number(recap.riskDollars) > 0 && Number.isFinite(Number(recap.riskDollars))
        ? String(recap.riskDollars)
        : '',
    title: text(recap.title, 160),
    session: text(recap.session, 80),
    execution: ['taken', 'missed', 'observation'].includes(recap.execution)
      ? recap.execution
      : 'taken',
    grade: ['A', 'B', 'C'].includes(recap.grade) ? recap.grade : '',
    lesson: text(recap.lesson, 8000),
    mistakeTags: Array.isArray(recap.mistakeTags)
      ? [...new Set(recap.mistakeTags.filter((tag) => JOURNAL_MISTAKE_TAGS.includes(tag)))]
      : [],
    setupConditions: Array.isArray(recap.setupConditions)
      ? recap.setupConditions
          .slice(0, 50)
          .map((condition, index) => ({
            id: text(condition?.id, 100) || `condition-${index}`,
            label: text(condition?.label, 160),
            type: text(condition?.type, 40) || 'text',
          }))
          .filter((condition) => condition.label)
      : [],
    screenshots: normalizedImages,
    screenshotCount: normalizedImages.length,
  }
}

/** Keep list state light; full image payloads are loaded only when reviewing/editing. */
export function summarizeJournalEntry(entry) {
  const { screenshots, ...recap } = entry.recap || {}
  return {
    ...entry,
    recap: { ...recap, screenshotCount: screenshots?.length ?? recap.screenshotCount ?? 0 },
  }
}

export function journalLocalDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function validateJournalEntry(entry) {
  if (!String(entry.playbook || '').trim() || !String(entry.symbol || '').trim() || !entry.dateTime)
    return 'Playbook, date/time, and symbol are required.'
  const start = Date.parse(entry.dateTime)
  if (!Number.isFinite(start)) return 'Enter a valid entry date and time.'
  if (
    entry.exitDateTime &&
    (!Number.isFinite(Date.parse(entry.exitDateTime)) || Date.parse(entry.exitDateTime) < start)
  )
    return 'Exit time must be on or after entry time.'
  for (const field of ['entryPrice', 'closePrice', 'size', 'pnl']) {
    const value = String(entry[field] ?? '').trim()
    if (value && (!Number.isFinite(Number(value)) || (field === 'size' && Number(value) <= 0)))
      return `${field === 'pnl' ? 'Net P&L' : field === 'size' ? 'Position size' : 'Price'} must be a valid ${field === 'size' ? 'positive ' : ''}number.`
  }
  return ''
}
