/**
 * Chart Context Menu Configuration
 * Customizes the TradingView chart context menu for all charts
 * 
 * This configuration applies to all charts using BaseChart component.
 * Adds trading actions (Market Buy/Sell, Limit Buy, Stop Sell) with quantity sub-items.
 */

import { ChartContextMenuCallbacks } from '../../types/chart'

const priceLabelRegex = /price ([\d,]+(\.\d+)?)/i

/**
 * Chart Context Menu Class
 * Manages context menu items and callbacks for trading actions
 */
export class ChartContextMenu {
  private callbacks: ChartContextMenuCallbacks = {}
  private quantities: number[] = [1, 2, 3, 4, 5, 10, 15]
  public widget: any = null
  public datafeed: any = null

  constructor(callbacks?: ChartContextMenuCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks
    }
  }

  /**
   * Set callbacks for trading actions
   */
  setCallbacks(callbacks: ChartContextMenuCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * Set quantities for trading actions
   */
  setQuantities(quantities: number[]): void {
    this.quantities = quantities
  }


  /**
   * Find price from menu items
   * Looks for price labels in the default TradingView menu items
   */
  findPrice(items: any[]): string | null {
    if (!Array.isArray(items)) {
      return null
    }
    
    for (const item of items) {
      if (item && typeof item.getLabel === 'function') {
        const label = item.getLabel()
        if (label) {
          const priceMatch = String(label).match(priceLabelRegex)
          if (priceMatch) {
            return priceMatch[1]
          }
        }
      }
      // Also check label property directly
      if (item && item.label) {
        const priceMatch = String(item.label).match(priceLabelRegex)
        if (priceMatch) {
          return priceMatch[1]
        }
      }
    }
    return null
  }

  /**
   * Context menu items processor
   * Called each time the context menu is displayed
   * TradingView signature: items_processor(items, actionsFactory, params)
   */
  createItemsProcessor() {
    return (items: any[], actionsFactory: any, params?: any) => {
      // Ensure items is an array
      if (!Array.isArray(items)) {
        console.warn('[ChartContextMenu] items_processor received non-array items:', items)
        items = []
      }

      // Find price from items or params
      let price = this.findPrice(items)
      if (!price && params) {
        price = params.price || params.point?.price || params.point?.y
        if (price) {
          price = String(price).replace(/,/g, '')
        }
      }

      if (!price) {
        // If no price available, return default items
        return Promise.resolve(items)
      }

      const cleanPrice = parseFloat(price.replace(/,/g, ''))
      const priceStr = cleanPrice.toFixed(2)
      const time = params?.time || params?.point?.time || params?.point?.x

      // Create sub-items arrays
      const marketBuySubs: any[] = []
      const marketSellSubs: any[] = []
      const limitBuySubs: any[] = []
      const limitSellSubs: any[] = []

      for (let idx = 0; idx < this.quantities.length; idx++) {
        const qty = this.quantities[idx]

        // Market Buy
        marketBuySubs.push(actionsFactory.createAction({
          actionId: `market-buy-${qty}`,
          label: `Market Buy ${qty}`,
          onExecute: () => {
            if (this.callbacks.onMarketBuy) {
              this.callbacks.onMarketBuy(qty, cleanPrice, time)
            }
          }
        }))

        // Market Sell
        marketSellSubs.push(actionsFactory.createAction({
          actionId: `market-sell-${qty}`,
          label: `Market Sell ${qty}`,
          onExecute: () => {
            if (this.callbacks.onMarketSell) {
              this.callbacks.onMarketSell(qty, cleanPrice, time)
            }
          }
        }))

        // Limit Buy
        limitBuySubs.push(actionsFactory.createAction({
          actionId: `limit-buy-${qty}`,
          label: `Limit Buy ${qty} @ ${priceStr}`,
          onExecute: () => {
            if (this.callbacks.onLimitBuy) {
              this.callbacks.onLimitBuy(qty, cleanPrice, cleanPrice, time)
            }
          }
        }))

        // Stop Sell
        limitSellSubs.push(actionsFactory.createAction({
          actionId: `limit-sell-${qty}`,
          label: `Stop Sell ${qty} @ ${priceStr}`,
          onExecute: () => {
            if (this.callbacks.onStopSell) {
              this.callbacks.onStopSell(qty, cleanPrice, cleanPrice, time)
            }
          }
        }))
      }

      // Create main menu items with sub-items
      const marketBuyItem = actionsFactory.createAction({
        actionId: 'market-buy',
        label: 'Market Buy',
        subItems: marketBuySubs
      })

      const marketSellItem = actionsFactory.createAction({
        actionId: 'market-sell',
        label: 'Market Sell',
        subItems: marketSellSubs
      })

      const limitBuyItem = actionsFactory.createAction({
        actionId: 'limit-buy',
        label: `Limit Buy @ ${priceStr}`,
        subItems: limitBuySubs
      })

      const limitSellItem = actionsFactory.createAction({
        actionId: 'limit-sell',
        label: `Stop Sell @ ${priceStr}`,
        subItems: limitSellSubs
      })

      // Add trading items at the top of the menu
      items.unshift(limitSellItem)
      items.unshift(limitBuyItem)
      items.unshift(marketSellItem)
      items.unshift(marketBuyItem)

      return Promise.resolve(items)
    }
  }

  /**
   * Context menu renderer factory
   * Allows custom rendering of menu items
   */
  createRendererFactory() {
    return (params: any) => {
      // Return undefined to use default renderer
      return undefined
    }
  }

  /**
   * Get context menu configuration
   * @returns Configuration object with items_processor and renderer_factory
   */
  getConfig() {
    return {
      items_processor: this.createItemsProcessor(),
      renderer_factory: this.createRendererFactory()
    }
  }
}

// Default instance
const defaultContextMenu = new ChartContextMenu()

/**
 * Get default context menu configuration
 * This will be merged with any user-provided context_menu config
 */
export function getDefaultContextMenuConfig() {
  return defaultContextMenu.getConfig()
}

/**
 * Set callbacks for the default context menu instance
 */
export function setContextMenuCallbacks(callbacks: ChartContextMenuCallbacks): void {
  defaultContextMenu.setCallbacks(callbacks)
}

/**
 * Set widget and datafeed references for the default context menu instance
 * This allows the context menu to access current price and symbol information
 */
export function setContextMenuWidget(widget: any, datafeed: any): void {
  defaultContextMenu.widget = widget
  defaultContextMenu.datafeed = datafeed
}
