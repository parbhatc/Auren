/**
 * Timeframe String Validator
 * Validates and parses timeframe strings according to TradingView specifications
 * 
 * Format rules:
 * - Multiplier + unit letter (e.g., "1S", "30", "1D", "3M")
 * - Units: T (ticks), S (seconds), D (days), W (weeks), M (months)
 * - No unit letter for minutes (just number, e.g., "30" = 30 minutes)
 * - No multiplier = 1 assumed ("S" = "1S", "D" = "1D")
 * - Just "1" = 1 minute
 * - No "H" for hours - use "60" for 1 hour
 * 
 * Valid multipliers:
 * - Ticks: 1, 10, 100, 1000
 * - Seconds: 1, 5, 10, 15, 30, 45
 * - Minutes: 1 to 1440
 * - Days: 1 to 365
 * - Weeks: 1 to 52
 * - Months: 1 to 12
 */

import { ParsedTimeframe } from '../types/utils'

// Re-export for backward compatibility
export type { ParsedTimeframe }

const VALID_TICK_MULTIPLIERS = [1, 10, 100, 1000]
const VALID_SECOND_MULTIPLIERS = [1, 5, 10, 15, 30, 45]
const MIN_MINUTES = 1
const MAX_MINUTES = 1440
const MIN_DAYS = 1
const MAX_DAYS = 365
const MIN_WEEKS = 1
const MAX_WEEKS = 52
const MIN_MONTHS = 1
const MAX_MONTHS = 12

/**
 * Parse and validate a timeframe string
 * @param timeframe - Timeframe string (e.g., "1S", "30", "1D", "3M")
 * @returns Parsed timeframe object with validation info
 */
export function parseTimeframe(timeframe: string): ParsedTimeframe {
  if (!timeframe || typeof timeframe !== 'string') {
    return {
      multiplier: 1,
      unit: 'M',
      original: String(timeframe || ''),
      isValid: false,
      error: 'Timeframe must be a non-empty string'
    }
  }

  const trimmed = timeframe.trim().toUpperCase()
  const original = timeframe.trim()

  // Handle empty string
  if (trimmed === '') {
    return {
      multiplier: 1,
      unit: 'M',
      original,
      isValid: false,
      error: 'Timeframe cannot be empty'
    }
  }

  // Check for unit letters: T, S, D, W, M
  const unitMatch = trimmed.match(/^(\d*)([TSDWM])$/)
  
  if (unitMatch) {
    const multiplierStr = unitMatch[1]
    const unit = unitMatch[2] as 'T' | 'S' | 'D' | 'W' | 'M'
    const multiplier = multiplierStr === '' ? 1 : parseInt(multiplierStr, 10)

    if (isNaN(multiplier) || multiplier < 1) {
      return {
        multiplier: 1,
        unit: 'M',
        original,
        isValid: false,
        error: `Invalid multiplier: ${multiplierStr || 'empty'}`
      }
    }

    // Validate based on unit
    switch (unit) {
      case 'T': // Ticks
        if (!VALID_TICK_MULTIPLIERS.includes(multiplier)) {
          return {
            multiplier,
            unit: 'T',
            original,
            isValid: false,
            error: `Invalid tick multiplier. Valid values: ${VALID_TICK_MULTIPLIERS.join(', ')}`
          }
        }
        return { multiplier, unit: 'T', original, isValid: true }

      case 'S': // Seconds
        if (!VALID_SECOND_MULTIPLIERS.includes(multiplier)) {
          return {
            multiplier,
            unit: 'S',
            original,
            isValid: false,
            error: `Invalid second multiplier. Valid values: ${VALID_SECOND_MULTIPLIERS.join(', ')}`
          }
        }
        return { multiplier, unit: 'S', original, isValid: true }

      case 'D': // Days
        if (multiplier < MIN_DAYS || multiplier > MAX_DAYS) {
          return {
            multiplier,
            unit: 'D',
            original,
            isValid: false,
            error: `Day multiplier must be between ${MIN_DAYS} and ${MAX_DAYS}`
          }
        }
        return { multiplier, unit: 'D', original, isValid: true }

      case 'W': // Weeks
        if (multiplier < MIN_WEEKS || multiplier > MAX_WEEKS) {
          return {
            multiplier,
            unit: 'W',
            original,
            isValid: false,
            error: `Week multiplier must be between ${MIN_WEEKS} and ${MAX_WEEKS}`
          }
        }
        return { multiplier, unit: 'W', original, isValid: true }

      case 'M': // Months
        if (multiplier < MIN_MONTHS || multiplier > MAX_MONTHS) {
          return {
            multiplier,
            unit: 'MONTH',
            original,
            isValid: false,
            error: `Month multiplier must be between ${MIN_MONTHS} and ${MAX_MONTHS}`
          }
        }
        return { multiplier, unit: 'MONTH', original, isValid: true }

      default:
        return {
          multiplier,
          unit: 'M',
          original,
          isValid: false,
          error: `Unknown unit: ${unit}`
        }
    }
  }

  // No unit letter - treat as minutes
  const minutes = parseInt(trimmed, 10)
  if (!isNaN(minutes)) {
    if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      return {
        multiplier: minutes,
        unit: 'M',
        original,
        isValid: false,
        error: `Minutes must be between ${MIN_MINUTES} and ${MAX_MINUTES}`
      }
    }
    return { multiplier: minutes, unit: 'M', original, isValid: true }
  }

  // Invalid format
  return {
    multiplier: 1,
    unit: 'M',
    original,
    isValid: false,
    error: `Invalid timeframe format: "${original}". Expected format: number (minutes) or number + unit (T/S/D/W/M)`
  }
}

/**
 * Validate a timeframe string
 * @param timeframe - Timeframe string to validate
 * @returns True if valid, false otherwise
 */
export function isValidTimeframe(timeframe: string): boolean {
  return parseTimeframe(timeframe).isValid
}

/**
 * Get error message for invalid timeframe
 * @param timeframe - Timeframe string to validate
 * @returns Error message or null if valid
 */
export function getTimeframeError(timeframe: string): string | null {
  const parsed = parseTimeframe(timeframe)
  return parsed.isValid ? null : (parsed.error || 'Invalid timeframe')
}

/**
 * Format timeframe to standard string format
 * @param parsed - Parsed timeframe object
 * @returns Formatted string (e.g., "1S", "30", "1D", "3M")
 */
export function formatTimeframe(parsed: ParsedTimeframe): string {
  if (!parsed.isValid) {
    return parsed.original
  }

  if (parsed.unit === 'M') {
    // Minutes - no unit letter
    return String(parsed.multiplier)
  }

  // Other units - include unit letter
  const unitLetter = parsed.unit === 'MONTH' ? 'M' : parsed.unit
  return `${parsed.multiplier}${unitLetter}`
}

/**
 * Convert timeframe to minutes (for comparison/calculation)
 * @param timeframe - Timeframe string
 * @returns Number of minutes or null if invalid
 */
export function timeframeToMinutes(timeframe: string): number | null {
  const parsed = parseTimeframe(timeframe)
  
  if (!parsed.isValid) {
    return null
  }

  switch (parsed.unit) {
    case 'T':
      // Ticks - cannot convert to minutes (return null or 0)
      return null
    case 'S':
      // Seconds to minutes
      return parsed.multiplier / 60
    case 'M':
      // Minutes
      return parsed.multiplier
    case 'D':
      // Days to minutes
      return parsed.multiplier * 1440
    case 'W':
      // Weeks to minutes
      return parsed.multiplier * 10080
    case 'MONTH':
      // Months to minutes (approximate: 30 days per month)
      return parsed.multiplier * 43200
    default:
      return null
  }
}

