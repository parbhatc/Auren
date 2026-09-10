import type { JournalEntryRecord, JournalScreenshot } from '../api/journal.api'
import { MAX_JOURNAL_IMAGE_BYTES } from '../../shared/journalRecap.js'

function imageFromCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  caption: string
): JournalScreenshot {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1920 / Math.max(width, height))
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Screenshot processing is unavailable in this browser.')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  let dataUrl = canvas.toDataURL('image/webp', 0.85)
  if (dataUrl.length > (MAX_JOURNAL_IMAGE_BYTES * 4) / 3)
    dataUrl = canvas.toDataURL('image/webp', 0.6)
  if (dataUrl.length > (MAX_JOURNAL_IMAGE_BYTES * 4) / 3)
    throw new Error('This chart is too detailed. Crop or upload a smaller image.')
  return { id: crypto.randomUUID(), caption, dataUrl, annotations: [] }
}

export async function readJournalScreenshot(file: File): Promise<JournalScreenshot> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw new Error('Choose a PNG, JPEG, or WebP screenshot smaller than 15 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    return imageFromCanvas(bitmap, bitmap.width, bitmap.height, file.name.replace(/\.[^.]+$/, ''))
  } finally {
    bitmap.close()
  }
}

/** Captures only the current chart host, excluding account headers and the journal modal. */
export async function captureJournalChart(
  snapshot: JournalEntryRecord
): Promise<JournalScreenshot> {
  const host = Array.from(document.querySelectorAll<HTMLElement>('[data-journal-chart]')).find(
    (el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
  )
  if (!host || !host.querySelector('canvas'))
    throw new Error('The chart is not ready. Open a chart first or attach a screenshot.')
  const capturedAt = new Date().toISOString()
  const { default: html2canvas } = await import('html2canvas')
  const options = { backgroundColor: null, scale: 1, logging: false, allowTaint: false }
  const canvas = await html2canvas(host, options)
  return {
    ...imageFromCanvas(
      canvas,
      canvas.width,
      canvas.height,
      `${snapshot.symbol} · ${snapshot.sourceContext?.chartResolution || 'chart'} · ${snapshot.sourceContext?.cursorTime || capturedAt}`
    ),
    capturedAt,
    chartResolution: snapshot.sourceContext?.chartResolution,
    cursorTime: snapshot.sourceContext?.cursorTime,
  }
}
