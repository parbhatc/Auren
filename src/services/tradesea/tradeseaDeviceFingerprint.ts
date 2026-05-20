/**
 * Tradesea MDS connection-group id (device fingerprint).
 * Matches app.tradesea.ai: SHA-256 of browser traits + userId, cached per userId.
 */

type FingerprintInput = {
  userId: string
  userAgent: string
  platform: string
  vendor: string
  languages: string[]
  colorDepth: number | null
  deviceMemory: number | null
  hardwareConcurrency: number | null
  maxTouchPoints: number | null
  timezone: string | null
  timezoneOffset: number | null
  screenWidth: number | null
  screenHeight: number | null
  devicePixelRatio: number | null
  plugins: string[]
  userAgentData: unknown
  webgl: string | null
  environment: Record<string, boolean>
}

function collectTraits(userId: string): FingerprintInput {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator)
  const screenObj = typeof screen !== 'undefined' ? screen : ({} as Screen)
  const tz = Intl.DateTimeFormat().resolvedOptions()

  let webgl: string | null = null
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl && 'getExtension' in gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension(
        'WEBGL_debug_renderer_info'
      )
      if (debugInfo) {
        webgl = (gl as WebGLRenderingContext).getParameter(
          debugInfo.UNMASKED_RENDERER_WEBGL
        ) as string
      }
    }
  } catch {
    webgl = null
  }

  const plugins: string[] = []
  try {
    if (nav.plugins) {
      for (let i = 0; i < nav.plugins.length; i++) {
        const p = nav.plugins[i]
        if (p?.name) plugins.push(p.name)
      }
    }
  } catch {
    /* ignore */
  }

  return {
    userId,
    userAgent: nav.userAgent || '',
    platform: nav.platform || '',
    vendor: nav.vendor || '',
    languages: Array.isArray(nav.languages) ? [...nav.languages] : [],
    colorDepth: typeof screenObj.colorDepth === 'number' ? screenObj.colorDepth : null,
    deviceMemory:
      typeof (nav as Navigator & { deviceMemory?: number }).deviceMemory === 'number'
        ? (nav as Navigator & { deviceMemory?: number }).deviceMemory!
        : null,
    hardwareConcurrency:
      typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    maxTouchPoints: typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : null,
    timezone: tz.timeZone || null,
    timezoneOffset: typeof Date !== 'undefined' ? new Date().getTimezoneOffset() : null,
    screenWidth: typeof screenObj.width === 'number' ? screenObj.width : null,
    screenHeight: typeof screenObj.height === 'number' ? screenObj.height : null,
    devicePixelRatio:
      typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
        ? window.devicePixelRatio
        : null,
    plugins,
    userAgentData: (nav as Navigator & { userAgentData?: unknown }).userAgentData ?? null,
    webgl,
    environment: {
      isTauri: false,
      isStandalonePWA: false,
      isAndroidWebView: false,
      isIOSWebView: false,
    },
  }
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const data = new TextEncoder().encode(input)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export async function getTradeseaConnectionGroupId(userId: string): Promise<string> {
  const storageKey = `__fp_${userId}`
  try {
    const cached = localStorage.getItem(storageKey)
    if (cached) return cached
  } catch {
    /* ignore */
  }

  const payload = JSON.stringify(collectTraits(userId))
  const fingerprint = await sha256Hex(payload)

  try {
    localStorage.setItem(storageKey, fingerprint)
  } catch {
    /* ignore */
  }

  return fingerprint
}

export function buildTradeseaMdsUrl(
  mdsStreamBase: string,
  userId: string,
  connectionGroupId: string
): string {
  const base = mdsStreamBase.replace(/\/$/, '')
  return `${base}/${encodeURIComponent(userId)}/${connectionGroupId}`
}
