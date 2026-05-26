type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

type LogEntry = {
  ts: number
  level: ConsoleLevel
  text: string
}

const MAX_ENTRIES_DEFAULT = 250_000

let entries: LogEntry[] = []
let capturing = false
let maxEntries = MAX_ENTRIES_DEFAULT

const originals: Partial<Record<ConsoleLevel, (...args: unknown[]) => void>> = {}

function getCircularReplacer() {
  const seen = new WeakSet<object>()
  return (_key: string, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }
    return value
  }
}

function formatArg(arg: unknown): string {
  if (arg === undefined) return 'undefined'
  if (arg === null) return 'null'
  if (typeof arg === 'string') return arg
  if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') {
    return String(arg)
  }
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`
  }
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg, getCircularReplacer(), 2)
    } catch {
      return Object.prototype.toString.call(arg)
    }
  }
  return String(arg)
}

function formatLine(level: ConsoleLevel, args: unknown[]): string {
  return args.map(formatArg).join('\t')
}

function pushEntry(level: ConsoleLevel, args: unknown[]): void {
  entries.push({
    ts: Date.now(),
    level,
    text: formatLine(level, args),
  })
  if (entries.length > maxEntries) {
    entries = entries.slice(entries.length - maxEntries)
  }
}

function wrap(level: ConsoleLevel): (...args: unknown[]) => void {
  const orig = originals[level] ?? console[level].bind(console)
  return (...args: unknown[]) => {
    if (capturing) pushEntry(level, args)
    orig(...args)
  }
}

/** Hook console methods and buffer output (call before reproducing the bug). */
export function startConsoleCapture(options?: { maxEntries?: number }): void {
  if (typeof window === 'undefined') return
  if (options?.maxEntries != null) maxEntries = options.maxEntries
  if (capturing) return

  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    originals[level] = console[level].bind(console)
    console[level] = wrap(level) as (typeof console)[typeof level]
  }
  capturing = true
  originals.log?.('[console-capture] started — use downloadConsoleLog() when done')
}

/** Restore native console methods (buffer is kept). */
export function stopConsoleCapture(): void {
  if (!capturing) return
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    if (originals[level]) console[level] = originals[level] as (typeof console)[typeof level]
  }
  capturing = false
  originals.log?.('[console-capture] stopped')
}

export function clearConsoleLogCapture(): void {
  entries = []
}

export function getConsoleCaptureCount(): number {
  return entries.length
}

export function isConsoleCaptureActive(): boolean {
  return capturing
}

/** Full buffer as plain text. */
export function getConsoleLogText(): string {
  return entries
    .map((e) => {
      const iso = new Date(e.ts).toISOString()
      return `${iso} [${e.level.toUpperCase()}] ${e.text}`
    })
    .join('\n')
}

function triggerDownload(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Download buffered console output as a `.log` file.
 * Only logs emitted after `startConsoleCapture()` are included (browser cannot read past DevTools history).
 */
export function downloadConsoleLog(filename?: string): void {
  if (!capturing && entries.length === 0) {
    console.warn(
      '[console-capture] nothing captured yet. Run startConsoleCapture(), reproduce, then downloadConsoleLog() again.'
    )
    return
  }

  const name =
    filename ??
    `console-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.log`

  const text = getConsoleLogText()
  if (!text) {
    console.warn('[console-capture] buffer is empty')
    return
  }

  triggerDownload(name, text)
  originals.log?.(`[console-capture] downloaded ${entries.length} lines → ${name}`)
}

/** Copy buffer to clipboard (fallback when download is blocked). */
export async function copyConsoleLog(): Promise<boolean> {
  const text = getConsoleLogText()
  if (!text) {
    console.warn('[console-capture] buffer is empty')
    return false
  }
  await navigator.clipboard.writeText(text)
  originals.log?.(`[console-capture] copied ${entries.length} lines to clipboard`)
  return true
}

export function enableConsoleCaptureOnReload(): void {
  localStorage.setItem('auren.debug.console', '1')
  console.log('[console-capture] enabled — reload the page; capture starts automatically in dev')
}

export function registerConsoleCaptureGlobals(): void {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return

  const w = window as Window & {
    startConsoleCapture?: typeof startConsoleCapture
    stopConsoleCapture?: typeof stopConsoleCapture
    downloadConsoleLog?: typeof downloadConsoleLog
    copyConsoleLog?: typeof copyConsoleLog
    clearConsoleLogCapture?: typeof clearConsoleLogCapture
    getConsoleLogText?: typeof getConsoleLogText
    enableConsoleCaptureOnReload?: typeof enableConsoleCaptureOnReload
  }

  w.startConsoleCapture = startConsoleCapture
  w.stopConsoleCapture = stopConsoleCapture
  w.downloadConsoleLog = downloadConsoleLog
  w.copyConsoleLog = copyConsoleLog
  w.clearConsoleLogCapture = clearConsoleLogCapture
  w.getConsoleLogText = getConsoleLogText
  w.enableConsoleCaptureOnReload = enableConsoleCaptureOnReload

  if (localStorage.getItem('auren.debug.console') === '1') {
    startConsoleCapture()
  }
}
