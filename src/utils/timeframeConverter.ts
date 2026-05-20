/**
 * Timeframe conversion utilities
 * Converts between database format (int/string) and display format (string)
 * Supports TradingView timeframe formats
 * 
 * Database format:
 * - Integers: minutes (1 = 1 minute, 60 = 60 minutes, 120 = 120 minutes)
 * - Strings: "1S" (seconds), "1T" (ticks), "1D" (days), "1W" (weeks), "1M" (months), "1Y" (years)
 * 
 * Display format (TradingView compatible):
 * - "1S", "2S" (seconds)
 * - "1T", "2T" (ticks)
 * - "1m", "2m", "5m", "15m", "30m", "45m" (minutes)
 * - "1H", "2H", "3H", "4H", "12H" (hours - uppercase H)
 * - "1D", "2D", "3D" (days)
 * - "1W" (weeks)
 * - "1M", "2M", "3M" (months)
 * - "1Y" (years)
 */

/**
 * Convert database timeframe to display format
 * @param dbTimeframe - Database value (number or string)
 * @returns Display format string (e.g., "1m", "1h", "1S", "1D")
 */
export function timeframeToDisplay(dbTimeframe: string | number | null | undefined): string {
  if (!dbTimeframe && dbTimeframe !== 0) {
    return '1m' // Default
  }

  // If it's a number, it represents minutes
  if (typeof dbTimeframe === 'number') {
    if (dbTimeframe < 60) {
      return `${dbTimeframe}m`
    } else if (dbTimeframe === 60) {
      return '1H'
    } else if (dbTimeframe < 1440) {
      // Less than 24 hours (1440 minutes)
      const hours = Math.floor(dbTimeframe / 60)
      return `${hours}H`
    } else if (dbTimeframe < 10080) {
      // Less than 1 week (10080 minutes)
      const days = Math.floor(dbTimeframe / 1440)
      return `${days}D`
    } else if (dbTimeframe < 43200) {
      // Less than 1 month (approx 43200 minutes = 30 days)
      const weeks = Math.floor(dbTimeframe / 10080)
      return `${weeks}W`
    } else if (dbTimeframe < 525600) {
      // Less than 1 year (approx 525600 minutes = 365 days)
      const months = Math.floor(dbTimeframe / 43200)
      return `${months}M`
    } else {
      // Years
      const years = Math.floor(dbTimeframe / 525600)
      return `${years}Y`
    }
  }

  // If it's a string, check if it already has a TradingView suffix
  const str = String(dbTimeframe)
  if (str.match(/^[0-9]+[STmHDWMY]$/i)) {
    // Convert lowercase h to uppercase H for TradingView compatibility
    return str.replace(/h$/i, 'H')
  }

  // If it's a numeric string without suffix, treat as minutes
  const num = parseInt(str, 10)
  if (!isNaN(num)) {
    if (num < 60) {
      return `${num}m`
    } else if (num === 60) {
      return '1H'
    } else if (num < 1440) {
      const hours = Math.floor(num / 60)
      return `${hours}H`
    } else if (num < 10080) {
      const days = Math.floor(num / 1440)
      return `${days}D`
    } else if (num < 43200) {
      const weeks = Math.floor(num / 10080)
      return `${weeks}W`
    } else if (num < 525600) {
      const months = Math.floor(num / 43200)
      return `${months}M`
    } else {
      const years = Math.floor(num / 525600)
      return `${years}Y`
    }
  }

  // Default fallback
  return '1m'
}

/**
 * Convert display format to database format
 * @param displayTimeframe - Display format string (e.g., "1m", "1h", "1S", "1D")
 * @returns Database format (number for minutes, string for S/D/h)
 */
export function timeframeToDb(displayTimeframe: string | null | undefined): string | number {
  if (!displayTimeframe) {
    return 1 // Default: 1 minute
  }

  const trimmed = String(displayTimeframe).trim()
  
  // Check for lowercase 'm' FIRST (minutes) before converting to uppercase
  if (trimmed.toLowerCase().endsWith('m')) {
    // Minutes (lowercase m) - convert to integer
    const minutes = parseInt(trimmed.slice(0, -1), 10)
    if (!isNaN(minutes)) {
      return minutes
    }
    return 1 // Default fallback
  }

  const str = trimmed.toUpperCase()

  // Check for TradingView suffixes (case-insensitive)
  if (str.endsWith('S')) {
    // Seconds - keep as string
    return str
  } else if (str.endsWith('T')) {
    // Ticks - keep as string
    return str
  } else if (str.endsWith('D')) {
    // Days - keep as string
    return str
  } else if (str.endsWith('W')) {
    // Weeks - keep as string
    return str
  } else if (str.endsWith('M')) {
    // Months - keep as string
    return str
  } else if (str.endsWith('Y')) {
    // Years - keep as string
    return str
  } else if (str.endsWith('H')) {
    // Hours (uppercase H) - convert to minutes (integer)
    const hours = parseInt(str.slice(0, -1), 10)
    if (!isNaN(hours)) {
      return hours * 60
    }
    return str // Fallback: keep as string
  }

  // If no suffix, try to parse as number (treat as minutes)
  const num = parseInt(str, 10)
  if (!isNaN(num)) {
    return num
  }

  // Default fallback
  return 1
}

/**
 * Get default timeframe (1 minute)
 */
export function getDefaultTimeframe(): string {
  return '1m'
}

/**
 * Get default timeframe in database format
 */
export function getDefaultTimeframeDb(): number {
  return 1
}

