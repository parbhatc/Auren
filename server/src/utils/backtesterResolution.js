/**

 * Normalize chart resolution for CSV load / aggregation (minute string, 30S, 1D/1W/1M).

 * Accepts BWC ids ("240") and API wire form ("4h", "30s").

 * @param {string} resolution

 */

export function parseBacktesterResolution(resolution) {

  const raw = String(resolution ?? '').trim()

  if (!raw) return '1'



  const upper = raw.toUpperCase()

  if (upper === 'D' || upper === '1D') return '1D'

  if (upper === 'W' || upper === '1W') return '1W'

  if (upper === 'M' || upper === '1M') return '1M'



  const secMatch = raw.match(/^(\d+)s$/i)

  if (secMatch) return `${secMatch[1]}S`



  const hourMatch = raw.match(/^(\d+)h$/i)

  if (hourMatch) {

    return String(parseInt(hourMatch[1], 10) * 60)

  }



  const minMatch = raw.match(/^(\d+)m$/i)

  if (minMatch) {

    return minMatch[1]

  }



  return raw

}



export function isSubMinuteResolution(resolution) {

  const normalized = parseBacktesterResolution(resolution)

  return /^\d+S$/.test(normalized)

}



/**

 * Wire format for GET /backtester/history — "4h" not "240", "30s" not "30S".

 * @param {string} resolution

 */

export function formatBacktesterResolutionForApi(resolution) {

  const normalized = parseBacktesterResolution(resolution)

  if (/^\d+S$/.test(normalized)) {

    return `${parseInt(normalized.slice(0, -1), 10)}s`

  }

  if (/^\d+D$/.test(normalized) || /^\d+W$/.test(normalized) || /^\d+M$/.test(normalized)) {

    return normalized

  }

  const mins = parseInt(normalized, 10)

  if (!Number.isFinite(mins)) return normalized

  if (mins >= 60 && mins % 60 === 0) return `${mins / 60}h`

  return String(mins)

}



/**

 * @param {string} resolution

 */

export function resolutionToSeconds(resolution) {

  const normalized = parseBacktesterResolution(resolution)

  const sub = normalized.match(/^(\d+)S$/)

  if (sub) return parseInt(sub[1], 10)



  const numeric = normalized.match(/^(\d+)$/)

  if (numeric) return parseInt(numeric[1], 10) * 60



  const daily = normalized.match(/^(\d+)D$/)

  if (daily) return (parseInt(daily[1], 10) || 1) * 86400



  const weekly = normalized.match(/^(\d+)W$/)

  if (weekly) return (parseInt(weekly[1], 10) || 1) * 604800



  const monthly = normalized.match(/^(\d+)M$/)

  if (monthly) return (parseInt(monthly[1], 10) || 1) * 2592000



  return 60

}



/**

 * @param {string} resolution

 */

export function resolutionToMinutes(resolution) {

  return resolutionToSeconds(resolution) / 60

}

export function alignTimeToResolutionSec(timeSec, resolution) {
  const barSec = Math.max(1, resolutionToSeconds(resolution))
  return Math.floor(Number(timeSec) / barSec) * barSec
}

/**
 * Map global replay wall time (HTF step) to last visible bar open on target TF.
 * @param {number} anchorSec
 * @param {string} sourceRes
 * @param {string} targetRes
 */
export function capReplayWallForResolution(anchorSec, sourceRes, targetRes) {
  const sourceSec = resolutionToSeconds(sourceRes)
  const targetSec = resolutionToSeconds(targetRes)
  if (targetSec >= sourceSec) {
    return alignTimeToResolutionSec(anchorSec, targetRes)
  }
  const htfOpen = alignTimeToResolutionSec(anchorSec, sourceRes)
  const lastLtOpen = htfOpen + sourceSec - targetSec
  return alignTimeToResolutionSec(lastLtOpen, targetRes)
}


