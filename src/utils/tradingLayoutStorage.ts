import { TradingLayout, DEFAULT_LAYOUT } from '../types/tradingLayout'

const TRADING_STORAGE_KEY = 'trading_layout_preferences'
const BACKTESTER_STORAGE_KEY = 'backtester_layout_preferences'

export type LayoutType = 'trading' | 'backtester'

/**
 * Get saved layout preferences from localStorage
 * @param type - 'trading' or 'backtester'
 */
export const getSavedLayout = (type: LayoutType = 'trading'): TradingLayout => {
  try {
    const storageKey = type === 'trading' ? TRADING_STORAGE_KEY : BACKTESTER_STORAGE_KEY
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      return JSON.parse(saved) as TradingLayout
    }
  } catch (error) {
    console.error(`[${type}Layout] Error loading saved layout:`, error)
  }
  return DEFAULT_LAYOUT
}

/**
 * Save layout preferences to localStorage
 * @param layout - Layout configuration
 * @param type - 'trading' or 'backtester'
 */
export const saveLayout = (layout: TradingLayout, type: LayoutType = 'trading'): void => {
  try {
    const storageKey = type === 'trading' ? TRADING_STORAGE_KEY : BACKTESTER_STORAGE_KEY
    localStorage.setItem(storageKey, JSON.stringify(layout))
  } catch (error) {
    console.error(`[${type}Layout] Error saving layout:`, error)
  }
}

/**
 * Reset layout to default
 * @param type - 'trading' or 'backtester'
 */
export const resetLayout = (type: LayoutType = 'trading'): void => {
  const storageKey = type === 'trading' ? TRADING_STORAGE_KEY : BACKTESTER_STORAGE_KEY
  localStorage.removeItem(storageKey)
}

