export const MOBILE_TRADE_PREFS_KEY_PREFIX = 'practice_mobile_trade_'
export const MOBILE_TRADE_PREFS_EVENT = 'practiceMobileTradePrefsChanged'

/** Fixed mobile bottom tab bar clearance (h-9 + safe-area). */
export const MOBILE_NAV_CLEARANCE_CSS =
  'calc(2.25rem + env(safe-area-inset-bottom, 0px))'

/** Chart clearance when quick-trade is fixed to the bottom (nav hidden). */
export const MOBILE_TRADE_DOCK_CLEARANCE_CSS =
  'calc(8.25rem + env(safe-area-inset-bottom, 0px))'

/** Bottom offset for mobile symbol picker sheet (nav + compact dock). */
export const MOBILE_PICKER_SHEET_BOTTOM_CSS = `calc(${MOBILE_NAV_CLEARANCE_CSS} + 3.25rem + 0.25rem)`

/** Body class while mobile order/settings sheet is open. */
export const MOBILE_TRADE_OVERLAY_BODY_CLASS = 'auren-mobile-trade-overlay-open'

/** @deprecated use MOBILE_TRADE_PREFS_EVENT */
export const PRACTICE_MOBILE_TRADE_PREFS_EVENT = MOBILE_TRADE_PREFS_EVENT
