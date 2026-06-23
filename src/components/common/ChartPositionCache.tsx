/**
 * Chart Position Cache Utility
 * Manages caching of position lines for charts
 * Cache can only have 3 items: position, stop_loss, and take_profit
 */

import { ChartPositionLineProps } from "../../types/chart"
import { debugTradeseaSl } from "../../services/tradesea/tradeseaDebug"
import ChartPositionLine from "./ChartPositionLine"
import ChartTradeCache from "./ChartTradeCache"

type LineType = 'position' | 'stop_loss' | 'take_profit'

class ChartPositionCache {

  private tradeCache: ChartTradeCache
  private chart: any
  private cache: Map<LineType, any>
  private symbol: string

  constructor(symbol: string, tradeCache: ChartTradeCache) {
    this.symbol = symbol;
    this.tradeCache = tradeCache
    this.cache = new Map<LineType, any>()
    this.chart = this.tradeCache.getChart()
  }

  /** Current size/entry from trade cache (position may have been scaled since line creation). */
  private resolveLivePosition(fallbackEntry: number, fallbackContracts: number): {
    entry: number
    contracts: number
  } {
    const position = this.tradeCache.getPosition(this.symbol)
    if (position && Number(position.contracts)) {
      return {
        entry: Number(position.entry) || fallbackEntry,
        contracts: Number(position.contracts),
      }
    }
    const positionLine = this.get('position')
    if (positionLine) {
      return {
        entry: positionLine.getEntryPrice() || fallbackEntry,
        contracts: positionLine.getContracts() || fallbackContracts,
      }
    }
    return { entry: fallbackEntry, contracts: fallbackContracts }
  }

  createPositionLine(entryPrice: number, price: number, contracts: number, create_stop_loss_and_take_profit_lines: boolean = true) {
    let lineType: LineType = 'position'
    if(this.updatePositionLine(entryPrice, price, contracts)){
      return this.get(lineType)
    }

    let datafeed = this.tradeCache.getDatafeed()
    let props: ChartPositionLineProps = {
      symbol: this.symbol,
      chart: this.chart,
      datafeed: datafeed,
      entryPrice,
      price,
      contracts,
      lineType,
      onUpdate: (updatePrice: number, type: 'stop_loss' | 'take_profit' | 'limit_order' | 'stop_profit' | null | undefined) => {
        const live = this.resolveLivePosition(entryPrice, contracts)
        if (type === 'stop_loss') {
          this.updateStopLossLine(
            live.entry,
            updatePrice,
            live.contracts,
            true,
            'onUpdate',
            create_stop_loss_and_take_profit_lines
          )
        } else if (
          type === 'take_profit' ||
          type === 'stop_profit' ||
          type === 'limit_order'
        ) {
          // Long TP above market is tagged limit_order while dragging the position line.
          this.updateTakeProfitLine(
            live.entry,
            updatePrice,
            live.contracts,
            true,
            'onUpdate',
            create_stop_loss_and_take_profit_lines
          )
        }
      },
      onCancel: () => {
        const position = this.tradeCache.getPosition(this.symbol)
        if (!position?.contracts) return
        const datafeed = this.tradeCache.getDatafeed()
        const bar = datafeed?.getLastBarForChart?.(this.chart)
        const price = bar?.close ?? position.entry
        const exitTime = bar?.time ?? Date.now()
        const qty = Math.abs(Number(position.contracts))
        this.tradeCache.onClosePosition(this.symbol, qty, price, exitTime)
      }
    }
    let line = new ChartPositionLine(props)
    line.create()
    this.set(lineType, line)
    debugTradeseaSl('chart:cache-line-register', {
      symbol: this.symbol,
      lineType,
      entryPrice,
      price,
      contracts,
    })
    return line
  }

  updatePositionLine(entryPrice: number, price: number, contracts: number): boolean {
    let lineType: LineType = 'position'
    let line = this.get(lineType)
    if(!line){
      return false
    }
    line.setEntryPrice(entryPrice)
    line.setPrice(price)
    line.setContracts(contracts)
    line.updatePositionLine(contracts)
    return true
  }

  createStopLossLine(entryPrice: number, price: number, contracts: number): any {
    let lineType: LineType = 'stop_loss'
    // Drop any stale map entry (and its TV line) before creating — avoids duplicate SL lines.
    this.remove(lineType)
    if(this.updateStopLossLine(entryPrice, price, contracts)){
      return this.get(lineType)
    }
    let datafeed = this.tradeCache.getDatafeed()
    let props: ChartPositionLineProps = {
      symbol: this.symbol,
      chart: this.chart,
      datafeed: datafeed,
      entryPrice,
      price,
      contracts,
      lineType,
      onUpdate: (updatePrice: number) => {
        this.tradeCache.updateStopLoss(this.symbol, updatePrice, "onUpdate")
      },
      onCancel: () => {
        this.tradeCache.updateStopLoss(this.symbol, null, 'onCancel')
      }
    }
    let line = new ChartPositionLine(props)
    line.create()
    this.set(lineType, line)
    debugTradeseaSl('chart:cache-line-register', {
      symbol: this.symbol,
      lineType,
      entryPrice,
      price,
      contracts,
    })
    return line
  }

  updateStopLossLine(entryPrice: number, price: number | null | undefined, contracts: number, createIfNotFound: boolean = false, context: string | undefined = undefined, create_stop_loss_and_take_profit_lines: boolean = true): boolean {
    debugTradeseaSl('chart:line-updateStopLoss', {
      symbol: this.symbol,
      entryPrice,
      price,
      contracts,
      createIfNotFound,
      context,
      hasExistingLine: Boolean(this.get('stop_loss')),
    })
    if(!create_stop_loss_and_take_profit_lines){
      this.tradeCache.updateStopLoss(this.symbol, price, context)
      return false
    }
    let lineType: LineType = 'stop_loss'
    let line = this.get(lineType)
    if(!line){
      if(!price){
        return false
      }
      if(createIfNotFound){
        if (context !== 'sync') {
          this.tradeCache.updateStopLoss(this.symbol, price, context)
        }
        this.createStopLossLine(entryPrice, price, contracts)
        return true
      }
      return false
    }
    if(!price){
      line.line.remove()
      this.remove(lineType)
      return false
    }
    if (context === 'sync') {
      if (!line.hasTvLine?.()) {
        debugTradeseaSl('chart:line-updateStopLoss-skip-pending', {
          symbol: this.symbol,
          entryPrice,
          price,
        })
        return true
      }
      line.setEntryPrice(entryPrice)
      line.setPrice(price)
      line.setContracts(contracts)
      line.updateStopLossLine()
      return true
    }
    this.tradeCache.updateStopLoss(this.symbol, price, context)
    line.setEntryPrice(entryPrice)
    line.setPrice(price)
    line.setContracts(contracts)
    line.updateStopLossLine()
    return true
  }

  createTakeProfitLine(entryPrice: number, price: number, contracts: number): any {
    let lineType: LineType = 'take_profit'
    this.remove(lineType)
    if(this.updateTakeProfitLine(entryPrice, price, contracts)){
      return this.get(lineType)
    }
    let datafeed = this.tradeCache.getDatafeed()
    let props: ChartPositionLineProps = {
      symbol: this.symbol,
      chart: this.chart,
      datafeed: datafeed,
      entryPrice,
      price,
      contracts,
      lineType,
      onUpdate: (updatePrice: number) => {
        this.tradeCache.updateTakeProfit(this.symbol, updatePrice, "onUpdate")
      },
      onCancel: () => {
        this.tradeCache.updateTakeProfit(this.symbol, null, 'onCancel')
      }
    }
    let line = new ChartPositionLine(props)
    line.create()
    this.set(lineType, line)
    debugTradeseaSl('chart:cache-line-register', {
      symbol: this.symbol,
      lineType,
      entryPrice,
      price,
      contracts,
    })
    return line
  }

  updateTakeProfitLine(entryPrice: number, price: number | null | undefined, contracts: number, createIfNotFound: boolean = false, context: string | undefined = undefined, create_stop_loss_and_take_profit_lines: boolean = true): boolean {
    if(!create_stop_loss_and_take_profit_lines){
      this.tradeCache.updateTakeProfit(this.symbol, price, context)
      return false
    }
    let lineType: LineType = 'take_profit'
    let line = this.get(lineType)
    if(!line){
      if(!price){
        return false
      }
      if(createIfNotFound){
        if (context !== 'sync') {
          this.tradeCache.updateTakeProfit(this.symbol, price, context)
        }
        this.createTakeProfitLine(entryPrice, price, contracts)
        return true
      }
      return false
    }
    if(!price){
      line.line.remove()
      this.remove(lineType)
      return false
    }
    if (context === 'sync') {
      if (!line.hasTvLine?.()) {
        debugTradeseaSl('chart:line-updateTakeProfit-skip-pending', {
          symbol: this.symbol,
          entryPrice,
          price,
        })
        return true
      }
      line.setEntryPrice(entryPrice)
      line.setPrice(price)
      line.setContracts(contracts)
      line.updateTakeProfitLine()
      return true
    }
    this.tradeCache.updateTakeProfit(this.symbol, price, context)
    line.setEntryPrice(entryPrice)
    line.setPrice(price)
    line.setContracts(contracts)
    line.updateTakeProfitLine()
    return true
  }

  onSizeUpdate(entryPrice: number, newSize: number): void {
    let stopLoss = this.get('stop_loss')
    let takeProfit = this.get('take_profit')

    if(stopLoss){
      stopLoss.setEntryPrice(entryPrice)
      stopLoss.setContracts(newSize)
      stopLoss.updateStopLossLine()
    }
    if(takeProfit){
      takeProfit.setEntryPrice(entryPrice)
      takeProfit.setContracts(newSize)
      takeProfit.updateTakeProfitLine()
    }
  }

  set(lineType: LineType, line: any): void {
    this.cache.set(lineType, line)
  }

  get(lineType: LineType): any {
    return this.cache.get(lineType)
  }

  remove(lineType: LineType): void {
    const line = this.cache.get(lineType)
    if (!line) return
    try {
      const tvLine = line.line
      if (tvLine?.remove && typeof tvLine.remove === 'function') {
        tvLine.remove()
      } else if (typeof line.destroy === 'function') {
        line.destroy()
      }
    } catch {
      /* chart widget may already be gone */
    }
    if (typeof line.detachTvLine === 'function') {
      line.detachTvLine()
    }
    this.cache.delete(lineType)
  }

  clear(): void {
    this.cache.forEach((line) => {
      line.destroy()
    })
    this.cache.clear()
  }

  removeAll(): void {
    for (const lineType of ['position', 'stop_loss', 'take_profit'] as const) {
      this.remove(lineType)
    }
  }
}

export default ChartPositionCache

