/**
 * Chart Trade Cache Utility
 * Manages caching of trade-related data for charts
 */

import ChartPositionCache from "./ChartPositionCache"
import { chartSymbolToProductRoot } from '../../services/tradesea/tradeseaSymbolInfo'

class ChartTradeCache {
  protected handler: any
  protected chart: any
  protected cache: Map<string, any>
  protected create_stop_loss_and_take_profit_lines: boolean = true

  constructor(handler: any, chart: any) {
    this.handler = handler
    this.chart = chart
    this.cache = new Map<string, any>()
    this.create_stop_loss_and_take_profit_lines = true
  }

  protected calcPnL(entryPrice: number, currentPrice: number, positionSize: number, tickSize: number, tickValue: number): number {
    return ((currentPrice - entryPrice) / tickSize) * tickValue * positionSize
  }

  /** True when `symbol` is the active chart ticker or the same product (MNQ vs CME:MNQ). */
  protected symbolMatchesActiveChart(symbol: string): boolean {
    let chartSymbol = ''
    try {
      chartSymbol = String(this.chart?.symbol?.() || '').trim()
    } catch {
      return false
    }
    if (!chartSymbol || !symbol) return false
    if (symbol === chartSymbol) return true

    const datafeed = this.getDatafeed()
    if (datafeed && typeof datafeed.getSymbolInfo === 'function') {
      const info = datafeed.getSymbolInfo(chartSymbol)
      const broker = String(info?.broker_symbol || info?.ticker || '').trim()
      if (broker && (broker === symbol || symbol === broker)) return true
    }

    if (datafeed && typeof datafeed.resolveProductSymbol === 'function') {
      const chartProduct = datafeed.resolveProductSymbol(chartSymbol)
      const symProduct = datafeed.resolveProductSymbol(symbol)
      if (chartProduct && symProduct && chartProduct === symProduct) return true
    }

    return chartSymbolToProductRoot(symbol) === chartSymbolToProductRoot(chartSymbol)
  }

  load(data: any, clear: boolean = true) {
    if(clear){
      this.cache.clear()
    }
    let chartSymbol = this.chart.symbol()
    for(let key in data){
      let info = data[key]
      let symbol = info.symbol

      if(symbol === chartSymbol){
        this.onOpenPosition(symbol, info.entry, info.contracts, info.stopLoss, info.takeProfit, info.entryTime, info.id, info.stopLossOrderId, info.takeProfitOrderId)
      }else{
        let data = this.setData(symbol, info.entry, info.stopLoss, info.takeProfit, info.contracts, info.entryTime, info.id, info.stopLossOrderId, info.takeProfitOrderId)
        this.handleOpenPosition(data)
      }
    }
  }

  onFlattenAllPosition() {
    // Remove all position lines
    for(let [, position] of this.cache){
      if(position){
        // Remove all lines (position, stop loss, take profit) if line exists
        if(position.line){
          try {
            // Use removeAll() to remove all lines (position, stop loss, take profit)
            if (typeof position.line.removeAll === 'function') {
              position.line.removeAll()
            } else if (typeof position.line.clear === 'function') {
              position.line.clear()
            } else if (typeof position.line.remove === 'function') {
              // Fallback: try to remove individual line types
              position.line.remove('position')
              position.line.remove('stop_loss')
              position.line.remove('take_profit')
            }
          } catch (error) {
            console.warn('[ChartTradeCache] Error removing position line:', error)
          }
        }
        // Clear position data
        position.contracts = 0
        position.line = null
      }
    }
    // Clear the cache completely
    this.cache.clear()
  }

  protected getPositionForActiveChart(preferredSymbol?: string): {
    key: string
    position: Record<string, unknown>
  } | null {
    let chartSymbol = ''
    try {
      chartSymbol = String(this.chart?.symbol?.() || '').trim()
    } catch {
      chartSymbol = ''
    }

    if (chartSymbol && this.cache.has(chartSymbol)) {
      return { key: chartSymbol, position: this.cache.get(chartSymbol) }
    }

    const preferred = String(preferredSymbol || '').trim()
    if (preferred && this.cache.has(preferred)) {
      return { key: preferred, position: this.cache.get(preferred) }
    }

    const datafeed = this.getDatafeed()
    if (chartSymbol && datafeed && typeof datafeed.getSymbolInfo === 'function') {
      const info = datafeed.getSymbolInfo(chartSymbol)
      const broker = String(info?.broker_symbol || info?.ticker || '').trim()
      if (broker && this.cache.has(broker)) {
        return { key: broker, position: this.cache.get(broker) }
      }
    }

    const chartRoot =
      datafeed && typeof datafeed.resolveProductSymbol === 'function'
        ? datafeed.resolveProductSymbol(chartSymbol)
        : chartSymbolToProductRoot(chartSymbol)
    if (chartRoot) {
      for (const [key, position] of this.cache.entries()) {
        const keyRoot =
          datafeed && typeof datafeed.resolveProductSymbol === 'function'
            ? datafeed.resolveProductSymbol(key)
            : chartSymbolToProductRoot(key)
        if (keyRoot && keyRoot === chartRoot) {
          return { key, position }
        }
      }
    }

    return null
  }

  onRealTimeBar(symbol: string, bar: any, tickSize: number|null = null, tickValue: number|null = null) {
    const resolved = this.getPositionForActiveChart(symbol)
    const cacheKey = resolved?.key ?? symbol
    let position = resolved?.position ?? this.cache.get(symbol)

    if(position){
      // If position exists but has no line yet, create it now that we have bars
      if(!position.line && bar && bar.close !== null && bar.close !== undefined){
        const update = this.symbolMatchesActiveChart(symbol)
        
        if(update){
          const currentPrice = bar.close || position.entry
          const line = this.createLines(cacheKey, position.entry, currentPrice, position.contracts, position.stopLoss, position.takeProfit)
          if(line){
            position.line = line
            if(bar.close && bar.close !== position.entry){
              line.updatePositionLine(position.entry, bar.close, position.contracts)
            }
          }
        }
      }
      
      if(!tickSize){
        let datafeed = this.getDatafeed()
        tickSize = datafeed.getTickSize(cacheKey)
        tickValue = datafeed.getTickValue(cacheKey)
      }
      // Only update position line if it exists (line is created when symbol matches chart symbol)
      if (position.line && typeof position.line.get === 'function') {
        position.line.get("position")?.updatePositionLineByBar(bar, position.contracts, tickSize, tickValue)
      }
      this.handlePriceUpdate(cacheKey, position.entry, bar, tickSize, tickValue)
    }
  }

  onSymbolChange(symbol: string) {
    let position = this.cache.get(symbol)

    if(position){
      setTimeout(() => {
        let datafeed = this.getDatafeed()
        let lastBar = datafeed.getLastBarForChart(this.chart)
        if(!lastBar){
          return;
        }
        if(position.line && typeof position.line.updatePositionLine === 'function'){
          position.line.updatePositionLine(position.entry, lastBar?.close ?? position.entry, position.contracts)
        }else{
          let line = this.createLines(symbol, position.entry, lastBar?.close ?? position.entry, position.contracts, position.stopLoss, position.takeProfit)
          position.line = line;
        }
      }, 200)
    }
  }

  calcAvgEntryPrice(originalContracts: number, contracts: number, totalContracts: number, price: number, entry: number) {
    originalContracts = Math.abs(originalContracts);
    contracts = Math.abs(contracts);
    totalContracts = Math.abs(totalContracts);
    return ((originalContracts * entry) + (contracts * price)) / totalContracts;
  }

  onOpenPosition(symbol: string, price: number, contracts: number, stopLoss: number | null = null, takeProfit: number | null = null, entryTime: number | null = null, id: number | null = null, stopLossOrderId: number | string | null = null, takeProfitOrderId: number | string | null = null) {
    const chartSymbol = this.chart.symbol()
    const cacheKey = this.symbolMatchesActiveChart(symbol) ? chartSymbol : symbol
    let update = cacheKey === chartSymbol
    const datafeed = this.getDatafeed()
    
    let position = this.cache.get(cacheKey) ?? this.cache.get(symbol)
    let lastBar = datafeed?.getLastBarForChart?.(this.chart)
    let lastBarTime = lastBar?.time || entryTime || Date.now()
    let lastBarClose = lastBar?.close || price

    
    if(position){
      let oldSize = position.contracts;
      const originalContracts = position.contracts;
      let totalContracts = position.contracts + contracts
      let isLong = position.type === 'long'
      let isAddingContracts = isLong ? contracts > 0 : contracts < 0

      if(totalContracts === 0 || (isLong && totalContracts < 1) || (!isLong && totalContracts > 0)){
        this.handleClosePosition(position, lastBarClose, lastBarTime)
        if(totalContracts !== 0){
          console.log('[Chart Trade Cache] reopened position: ', symbol, totalContracts)
          this.onOpenPosition(symbol, price, totalContracts)
        }
        return null
      }

      if(isAddingContracts){
        position.entry = this.calcAvgEntryPrice(originalContracts, contracts, totalContracts, price, position.entry)
      }
      position.contracts = totalContracts;
      if(position.line && typeof position.line.updatePositionLine === 'function'){
        const currentPrice = position.line.get("position")?.getPrice() || position.entry
        position.line.updatePositionLine(position.entry, currentPrice, position.contracts)
      }
      
      this.handleUpdateSize(oldSize, totalContracts, position)
      return position
    }
    if(contracts === 0){
      console.log('[ChartTradeCache] onOpenPosition: contracts is 0, returning null')
      return null
    }
    let line: any = null;
    if(update){
      // Only create lines if we have a last bar - TradingView requires bars to be loaded before creating order lines
      if(lastBar && lastBar.close !== null && lastBar.close !== undefined){
        // Use current bar price if available, otherwise use entry price
        const currentPrice = lastBarClose || price
        line = this.createLines(cacheKey, price, currentPrice, contracts, stopLoss, takeProfit)
        
        if(line){
          if(lastBar.close && lastBar.close !== price){
            line.updatePositionLine(price, lastBar.close, contracts)
          }
        }
        // Immediately update the line with current bar if available
        if (line && lastBar && lastBar.close && lastBar.close !== price) {
          setTimeout(() => {
            if (line && typeof line.updatePositionLine === 'function') {
              line.updatePositionLine(price, lastBar.close, contracts)
            }
          }, 100)
        }
      } else {
        // No bar available yet - defer line creation until bars are loaded
        // The line will be created when onRealTimeBar is called with the first bar
        console.log('[ChartTradeCache] onOpenPosition: no last bar available, deferring line creation until bars are loaded')
      }
    } else {
      console.log('[ChartTradeCache] onOpenPosition: update is false, not creating line:', { symbol, chartSymbol })
    }
    let data = this.setData(cacheKey, price, stopLoss, takeProfit, contracts, entryTime ?? lastBarTime, line, id, stopLossOrderId, takeProfitOrderId)
    this.handleOpenPosition(data)
    return data
  }

  onClosePosition(symbol: string, contracts: number, price: number | null = null, exitTime: number | null = null) {
    console.log('[Chart Trade Cache] Closing position: ', symbol, contracts)
    let position = this.cache.get(symbol)
    let update = true

    if(position){
      let oldSize = position.contracts;
      // Store original contracts before modification for handleClosePosition
      const originalContracts = position.contracts;
      // contracts parameter is always positive (how many to close)
      // For long positions: subtract (1 - 1 = 0)
      // For short positions: add (-1 + 1 = 0)
      if (position.type === 'long') {
        position.contracts -= contracts
      } else {
        position.contracts += contracts
      }

      if(position.type === 'long'){
        if(position.contracts < 1){
          if(position.line){
            if (typeof position.line.removeAll === 'function') {
              position.line.removeAll()
            } else if (typeof position.line.remove === 'function') {
              position.line.remove('position')
            }
          }
          update = false
        }
      } else if(position.type === 'short'){
        if(position.contracts < 1){
          if(position.line){
            if (typeof position.line.removeAll === 'function') {
              position.line.removeAll()
            } else if (typeof position.line.remove === 'function') {
              position.line.remove('position')
            }
          }
          update = false
        }
      }
      if(update){
        this.handleUpdateSize(oldSize, position.contracts, position)
        if(position.line && typeof position.line.updatePositionLine === 'function'){
          position.line.updatePositionLine(position.entry, position.contracts, position.type)
        }
      }else{
        // Restore original contracts before calling handleClosePosition
        // so derived classes can access the original value
        let datafeed = this.getDatafeed()
        let lastBar = datafeed?.getLastBarForChart?.(this.chart)
        exitTime = exitTime || lastBar?.time || Date.now()
        price = price ?? lastBar?.close ?? position.entry
        if(!exitTime || !price){
          console.error('[Chart Trade Cache] No exit time or price found for symbol: ', symbol)
          return;
        }
        position.contracts = originalContracts;
        this.handleClosePosition(position, price, exitTime)
        // Set to 0 after handleClosePosition is called
        position.contracts = 0;
      }
    }
  }

  onUpdateStopLoss(symbol: string, entryPrice: number, price: number, createIfNotFound: boolean = false) {
    let position = this.cache.get(symbol)

    if(position){
      if(position.line && typeof position.line.updateStopLossLine === 'function'){
        position.line.updateStopLossLine(entryPrice, price, position.contracts, createIfNotFound)
      }
    }
  }

  onUpdateTakeProfit(symbol: string, entryPrice: number, price: number, createIfNotFound: boolean = false) {
    let position = this.cache.get(symbol)
    if(position){
      if(position.line && typeof position.line.updateTakeProfitLine === 'function'){
        position.line.updateTakeProfitLine(entryPrice, price, position.contracts, createIfNotFound)
      }
    }
  }

  onAllPositionsClosed() {
  }

  updateStopLoss(symbol: string, price: number | null, context: string | undefined = undefined) {
    let position = this.cache.get(symbol)
    if(position){
      let oldPrice = position.stopLoss
      position.stopLoss = price
      this.handleUpdateStopLoss(price, oldPrice, position, context)
    }
  }

  updateTakeProfit(symbol: string, price: number | null, context: string | undefined = undefined) {
    let position = this.cache.get(symbol)
    if(position){
      let oldPrice = position.takeProfit
      position.takeProfit = price
      this.handleUpdateTakeProfit(price, oldPrice, position, context)
    }
  }

  handlePriceUpdate(_symbol: string, _entryPrice: number, _bar: any, _tickSize: number, _tickValue: number) {
  }

  handleOpenPosition(_position: any) {
  }
    
  handleClosePosition(position: any, _price: number, _exitTime: number, _context: string | undefined = undefined) { 
    this.cache.delete(position.symbol)
    if(position.line && typeof position.line.removeAll === 'function'){
      position.line.removeAll()
    }

    if (this.cache.size === 0 && typeof this.handler?.onAllPositionsClosed === 'function') {
      this.handler.onAllPositionsClosed()
    }
  }
  
  handleUpdateSize(_oldSize: number, newSize: number, position: any) {
    if(position.line && typeof position.line.onSizeUpdate === 'function'){
      position.line.onSizeUpdate(position.entry, newSize)
    }
  }

  handleUpdateStopLoss(price: number | null, _oldPrice: number | null, position: any, context: string | undefined = undefined) {
    if (price == null && context === 'onCancel' && position?.line?.remove) {
      position.line.remove('stop_loss')
    }
  }

  handleUpdateTakeProfit(price: number | null, _oldPrice: number | null, position: any, context: string | undefined = undefined) {
    if (price == null && context === 'onCancel' && position?.line?.remove) {
      position.line.remove('take_profit')
    }
  }

  createLines(symbol: string, entryPrice: number, price: number, contracts: number, stopLoss: number | null | undefined, takeProfit: number | null | undefined){
    let line = new ChartPositionCache(symbol, this)
    line.createPositionLine(entryPrice, price, contracts, this.create_stop_loss_and_take_profit_lines)
    if(stopLoss){
      line.createStopLossLine(entryPrice, stopLoss, contracts)
    }
    if(takeProfit){
      line.createTakeProfitLine(entryPrice, takeProfit, contracts)
    }
    return line;
  }

  setData(symbol: string, entry: number, stopLoss: number | null, takeProfit: number | null, contracts: number, entryTime: number, line: ChartPositionCache | null | undefined = null, id: number | null = null, stopLossOrderId: number | string | null = null, takeProfitOrderId: number | string | null = null) {
    let data = {symbol, entry, stopLoss, takeProfit, contracts, type: contracts > 0 ? "long" : "short", entryTime, line, id, stopLossOrderId, takeProfitOrderId, positionId: null as string | null}
    this.cache.set(symbol, data)
    return data
  }

  getPosition(symbol: string) {
    return this.cache.get(symbol)
  }

  getCache() {
    return this.cache
  }

  getChart() {
    return this.chart
  }

  getDatafeed(): any {
    return this.handler.client?.getChart().getDatafeed()
  }
}

export default ChartTradeCache

