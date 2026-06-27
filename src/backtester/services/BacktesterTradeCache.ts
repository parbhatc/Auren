import ChartTradeCache from '../../components/common/ChartTradeCache'
import { backtesterAPI } from '../../api/backtester.api'
import { BacktesterTradeHandler } from './BacktesterTradeHandler'
import type { BacktesterChartDataFeed } from '../components/chart/BacktesterChartDataFeed'

/**
 * Backtester Trade Cache
 * Extends ChartTradeCache with backtester-specific functionality
 */
class BacktesterTradeCache extends ChartTradeCache {
  private tradeHandler: BacktesterTradeHandler
  private sessionId: string | null = null
  
  constructor(handler: BacktesterTradeHandler, chart: unknown) {
    super(handler as never, chart)
    this.tradeHandler = handler
    const session = handler.getSession()
    this.sessionId = session?.id || null
    // Load balance from database
    this.loadSessionBalance()
  }

  getDatafeed(): BacktesterChartDataFeed | null {
    return this.tradeHandler.getDatafeed()
  }

  async loadSessionBalance() {
    if (!this.sessionId) return
    try {
      const stats = await backtesterAPI.getSessionStats(this.sessionId)
      if (stats.success) {
        // Initial balance loaded but not stored (for future use)
      }
    } catch (error) {
      // Ignore errors
    }
  }

  handleClosePosition(position: any, price: number, exitTime: number) {
    if(!this.sessionId || !position) {
      super.handleClosePosition(position, price, exitTime)
      return
    }

    this.closeTrade(
      position.symbol, 
      position.type, 
      position.entry, 
      price, 
      position.contracts, 
      position.entryTime / 1000, 
      exitTime / 1000,
      position.stopLoss || null,
      position.takeProfit || null
    )
    super.handleClosePosition(position, price, exitTime)
  }

  handleUpdateSize(oldSize: number, newSize: number, position: any) {
    let diff = newSize - oldSize;
    let isReducingPosition = position.type === 'long' ? diff < 0 : diff > 0;

    if(isReducingPosition){
      let contracts = position.type === 'long' ? Math.abs(diff) : -Math.abs(diff);
      let datafeed = this.getDatafeed()
      let lastBar = datafeed.getLastBarForSymbol(position.symbol)

      if(!lastBar){
        console.error('[Backtester Trade Cache] No last bar found for symbol: ', position.symbol)
        return;
      }
      this.closeTrade(
        position.symbol, 
        position.type, 
        position.entry, 
        lastBar.close, 
        contracts, 
        position.entryTime / 1000, 
        lastBar.time / 1000,
        position.stopLoss || null,
        position.takeProfit || null
      )
    }
    super.handleUpdateSize(oldSize, newSize, position)
  }

  async handlePriceUpdate(symbol: string, entryPrice: number, bar: any, tickSize: number, tickValue: number) {
    if (!this.sessionId) return

    const position = this.getPosition(symbol)
    if (position) {
      let stopLoss = position.stopLoss
      let takeProfit = position.takeProfit

      if(this.didBarHitPrice(bar, stopLoss)){
        //stop loss hit
        this.onClosePosition(symbol, position.contracts, stopLoss, bar.time)
        console.log('[Backtester Trade Cache] Stop loss hit for symbol: ', symbol, ' at price: ', stopLoss, ' at time: ', bar.time)
      } else if(this.didBarHitPrice(bar, takeProfit)){
        //take profit hit
        this.onClosePosition(symbol, position.contracts, takeProfit, bar.time)
        console.log('[Backtester Trade Cache] Take profit hit for symbol: ', symbol, ' at price: ', takeProfit, ' at time: ', bar.time)
      } else {
        //no hit, update unrealized P&L
        let pnl = this.calcPnL(entryPrice, bar.close, position.contracts, tickSize, tickValue)
        if (this.tradeHandler && (this.tradeHandler as any).onUnrealizedPnLUpdate) {
          (this.tradeHandler as any).onUnrealizedPnLUpdate(pnl)
        }
        console.log('[Backtester Trade Cache] No hit for symbol: ', symbol, ' at price: ', bar.close, ' at time: ', bar.time)
      }
    }
  }

  closeTrade(symbol: string, direction: 'long' | 'short', entryPrice: number, exitPrice: number, contracts: number, entryTime: number, exitTime: number, stopLoss?: number | null, takeProfit?: number | null) {
    let tradeData = this.getTradeData(symbol, direction, entryPrice, exitPrice, contracts, entryTime, exitTime, stopLoss, takeProfit)
    backtesterAPI.saveTrade(tradeData as any)
      .then(() => {
        // Notify handler that stats should be refreshed
        if (this.tradeHandler && (this.tradeHandler as any).onTradeSaved) {
          try {
            (this.tradeHandler as any).onTradeSaved()
          } catch (callbackError) {
            // Ignore callback errors
          }
        }
      })
      .catch(() => {
        // Ignore save errors; still close position locally
      })
  }

  getTradeData(symbol: string, direction: 'long' | 'short', entryPrice: number, exitPrice: number, contracts: number, entryTime: number, exitTime: number, stopLoss?: number | null, takeProfit?: number | null) {
    return {
      sessionId: this.sessionId,
      symbol: symbol,
      direction: direction,
      entryPrice: entryPrice,
      exitPrice: exitPrice,
      stopLoss: stopLoss || undefined,
      takeProfit: takeProfit || undefined,
      contracts: contracts,
      entryTime: entryTime,
      exitTime: exitTime,
    }
  }

  getTradeDataFromPosition(position: any, exitPrice: number, exitTime: number) {
    return this.getTradeData(position.symbol, position.type, position.entry, exitPrice, position.contracts, position.entryTime / 1000, exitTime / 1000)
  }

  didBarHitPrice(bar: any, price: number) {
    return price >= bar.low && price <= bar.high
  }
}

export default BacktesterTradeCache
