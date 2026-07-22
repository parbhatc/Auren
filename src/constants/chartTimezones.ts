/** IANA timezones supported in user settings (subset of BetterweightChartPro chart timezones). */
export const SUPPORTED_CHART_TIMEZONES = [
  'Etc/UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Australia/Sydney',
] as const

/** @deprecated */
export const SUPPORTED_TRADINGVIEW_TIMEZONES = SUPPORTED_CHART_TIMEZONES
