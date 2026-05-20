import { ChartPositionLineProps } from '../../types/chart'
import { debugTradeseaSl } from '../../services/tradesea/tradeseaDebug'

/**
 * Chart Position Line Utility
 * Manages position lines on the chart for both /trade and /backtester routes
 * 
 * TODO: Implement position line rendering logic
 */
class ChartPositionLine {
  private props: ChartPositionLineProps
  private RIGHT_PLOT_SIDE: number
  private ORDER_RIGHT_PLOT_SIDE: number
  private line: any
  /** Prevents duplicate TV order lines while createOrderLine is in flight. */
  private orderLineCreatePromise: Promise<any> | null = null

  constructor(props: ChartPositionLineProps) {
    this.props = props
    this.RIGHT_PLOT_SIDE = 8;
    this.ORDER_RIGHT_PLOT_SIDE = 21;
    this.line = null;
  }

  hasTvLine(): boolean {
    return Boolean(this.line)
  }

  /** Clear TV widget ref after remove() so sync does not touch a destroyed line. */
  detachTvLine(): void {
    this.line = null
  }

  private setTvLineText(tvLine: any, text: string): void {
    if (!tvLine) return
    debugTradeseaSl('chart:line-text', {
      symbol: this.props.symbol,
      lineType: this.props.lineType,
      text,
      entryPrice: this.props.entryPrice,
      price: this.props.price,
      contracts: this.props.contracts,
    })
    try {
      tvLine.setText(text)
    } catch (err) {
      debugTradeseaSl('chart:line-text-error', {
        symbol: this.props.symbol,
        lineType: this.props.lineType,
        text,
        message: err instanceof Error ? err.message : String(err),
      })
      this.detachTvLine()
    }
  }

  /**
   * Update position line with new props
   */
  update(props: Partial<ChartPositionLineProps>): void {
    this.props = { ...this.props, ...props }
    // TODO: Update position line when props change
  }

  /**
   * Remove position line from chart
   */
  destroy(): void {
  }

  getSymbol(): string {
    return this.props.symbol;
  }

  setEntryPrice(entryPrice: number): void {
    this.props.entryPrice = entryPrice;
  }

  getEntryPrice(): number {
    return this.props.entryPrice || 0;
  }

  setPrice(price: number): void {
    this.props.price = price;
  }

  getPrice(): number {
    return this.props.price || 0;
  }

  setContracts(contracts: number): void {
    this.props.contracts = contracts;
  }

  getContracts(): number {
    return this.props.contracts || 0;
  }

  getType(): 'long' | 'short' {
    return this.props.contracts > 0 ? 'long' : 'short';
  }

  create(): boolean {
    if(this.props.lineType === 'position'){
      this.createPositionLine();
    }else if(this.props.lineType === 'stop_loss'){
      this.createStopLossLine();
    }else if(this.props.lineType === 'take_profit'){
      this.createTakeProfitLine();
    }
    return true;
  }

  private async createPositionLine(){
    let entryPrice = this.props.entryPrice;
    let price = this.props.price;
    let size = this.props.contracts;
    let line = await this.createOrderLine();
    if(!line){
      console.error('[ChartPositionLine] createPositionLine: Failed to create order line');
      return;
    }
    this.updatePositionLine(size);

    line.onModify(() => {})
    line.onCancel(() => {
        line.remove();
        this.props.onCancel?.();
    })
    line.onMove(async () => {
        let target = line.target;
        line.isMoving = false;
        this.updatePositionLine(this.props.contracts);
        this.props.onUpdate?.(target.price, target.type);
    })
    line.onMoving(() => {
        line.isMoving = true;
        let target_price = line.getPrice();
        line.target = {price: target_price, type: null}
        this.props.onMoving?.(target_price);

        let symbol = this.getSymbol();
        let datafeed = this.props.datafeed;
        let lastBar = datafeed.getLastBarForChart(this.props.chart);
        let lastClose = lastBar?.close;
        let tickSize = datafeed.getTickSize(symbol);
        let tickValue = datafeed.getTickValue(symbol);
        let pnl = this.calcPnL(entryPrice, target_price, size, tickSize, tickValue);
        let text = this.formatDollar(pnl, "-")

        if(size > 0){
          //long position
          if(target_price <= price){
            //stop loss
            line.setText('Set Stop Market ' + text);
            this.setLineColor(line, false);
            line.target.type = 'stop_loss';
          }else{
            if(target_price <= lastClose){
              //stop loss
              line.setText('Set Stop Market ' + text);
              this.setLineColor(line, false);
              line.target.type = 'stop_loss';
            }else{
              //limit order
              line.setText('Set Limit Order ' + text);
              this.setLineColor(line);
              line.target.type = 'limit_order';
            }
          }
        }else{
          //short position
          if(target_price >= price){
            //stop loss
            line.setText('Set Stop Market ' + text);
            this.setLineColor(line, false);
            line.target.type = 'stop_loss';
          }else{
            if (target_price >= lastClose){
              //stop profit
              line.setText('Set Stop Profit ' + text);
              line.target.type = 'stop_profit';
            }else{
              //take profit
              line.setText('Set Take Profit ' + text);
              line.target.type = 'take_profit';
            }
            this.setLineColor(line);
          }
        }
    })
    line.setPrice(entryPrice);
    line.setQuantity(size.toString());
    line.setLineStyle(0);
    line.setLineLength(this.RIGHT_PLOT_SIDE);
    line.setQuantityBackgroundColor(size > 0 ? '#00ff00' : '#ff0000');
    line.setCancelTooltip('Close position');
  }

  updatePositionLine(size: number): void {
    if(!this.line){
      return;
    }
    let datafeed = this.props.datafeed;
    if(!datafeed){
      return;
    }
    let symbol = this.getSymbol();
    let tickSize = datafeed.getTickSize(symbol);  
    let tickValue = datafeed.getTickValue(symbol);
    if(tickSize === null || tickSize === undefined || tickValue === null || tickValue === undefined){
      return;
    }
    let lastBar = datafeed.getLastBarForChart(this.props.chart);
    if(lastBar){
      this.updatePositionLineByBar(lastBar, size, tickSize, tickValue);
      return;
    }
    const mark = this.props.price ?? this.props.entryPrice;
    if (mark == null) return
    this.updatePositionLineByBar({ close: mark }, size, tickSize, tickValue);
  }

  updatePositionLineByBar(bar: any, size: number, tickSize: number, tickValue: number): void {
    if(!this.line || !bar){
      return;
    }
    if(this.line.isMoving){
      return;
    }
    let barClose = bar.close;
    let entryPrice = this.props.entryPrice;
    let pnl = this.calcPnL(entryPrice, barClose, size, tickSize, tickValue);
    let text = this.formatDollar(pnl, "-")
    this.line.setPrice(entryPrice);
    this.setTvLineText(this.line, text);
    this.line.setQuantity(size.toString());
    if(pnl >= 0){
      this.setLineColor(this.line);
    }else{
      this.setLineColor(this.line, false);
    }
  }
  
  private async createStopLossLine(){
    if (this.line) return
    let entryPrice = this.props.entryPrice;
    if(!entryPrice){
      return;
    }
    let price = this.props.price;
    if(price === null || price === undefined){
      console.error('[ChartPositionLine] createStopLossLine: price is null or undefined');
      return;
    }
    let datafeed = this.props.datafeed;
    if(!datafeed){
      console.error('[ChartPositionLine] createStopLossLine: datafeed is null or undefined');
      return;
    }
    let symbol = this.getSymbol();
    if(!symbol){
      console.error('[ChartPositionLine] createStopLossLine: symbol is null or undefined');
      return;
    }
    let tickSize = datafeed.getTickSize(symbol);
    let tickValue = datafeed.getTickValue(symbol);
    if(tickSize === null || tickSize === undefined || tickValue === null || tickValue === undefined){
      console.error('[ChartPositionLine] createStopLossLine: tickSize or tickValue is null or undefined', {tickSize, tickValue});
      return;
    }
    let line = await this.createOrderLine();
    if(!line){
      return;
    }
    let size = this.props.contracts;
    let pnl = this.calcPnL(entryPrice, price, size, tickSize, tickValue);
    
    line.onModify(() => {})
    line.onCancel(() => {
        line.remove();
        this.props.onCancel?.();
    })
    line.onMove(() => {
      this.props.onUpdate?.(line.getPrice());
    })
    line.onMoving(() => {
      let target_price = line.getPrice();
      let pnl = this.calcPnL(entryPrice, target_price, size, tickSize, tickValue);
      let text = this.formatDollar(pnl, "-")
      this.setTvLineText(line, text);
      this.props.onMoving?.(target_price);
    })
    line.setPrice(price);
    this.setTvLineText(line, this.formatDollar(pnl));
    line.setQuantity((size * -1).toString());
    line.setLineStyle(2);
    line.setLineLength(this.ORDER_RIGHT_PLOT_SIDE);
    line.setQuantityBackgroundColor(pnl >= 0 ? '#00ff00' : '#ff0000');
    this.setLineColor(line, pnl >= 0);
    line
  }

  async updateStopLossLine(){
    let entryPrice = this.props.entryPrice;
    if(!entryPrice){
      return;
    }
    let price = this.props.price;
    if(price === null || price === undefined){
      return;
    }
    let size = this.props.contracts;
    let datafeed = this.props.datafeed;
    if(!datafeed){
      return;
    }
    let symbol = this.getSymbol();
    if(!symbol){
      return;
    }

    if(!this.line){
      if (this.orderLineCreatePromise) {
        await this.orderLineCreatePromise
      } else {
        await this.createStopLossLine();
      }
      if(!this.line){
        return;
      }
    }

    this.applyStopLossLineVisual(entryPrice, price, size, datafeed, symbol)
  }

  private applyStopLossLineVisual(
    entryPrice: number,
    price: number,
    size: number,
    datafeed: NonNullable<ChartPositionLineProps['datafeed']>,
    symbol: string
  ): void {
    if (!this.line) return
    let tickSize = datafeed.getTickSize(symbol);
    let tickValue = datafeed.getTickValue(symbol);
    if(tickSize === null || tickSize === undefined || tickValue === null || tickValue === undefined){
      return;
    }
    let pnl = this.calcPnL(entryPrice, price, size, tickSize, tickValue);
    let text = this.formatDollar(pnl)
    this.setTvLineText(this.line, text);
    try {
      this.line.setQuantity((size * -1).toString());
      this.line.setPrice(price);
      this.line.setQuantityBackgroundColor(pnl >= 0 ? '#00ff00' : '#ff0000');
      this.setLineColor(this.line, pnl >= 0);
      if(size > 0){
        if(price <= entryPrice){
          this.setLineColor(this.line, false);
        }else{
          this.setLineColor(this.line);
        }
      }else{
        if(price >= entryPrice){
          this.setLineColor(this.line, false);
        }else{
          this.setLineColor(this.line);
        }
      }
    } catch (err) {
      debugTradeseaSl('chart:line-update-error', {
        symbol: this.props.symbol,
        lineType: 'stop_loss',
        message: err instanceof Error ? err.message : String(err),
      })
      this.detachTvLine()
    }
  }

  private async createTakeProfitLine(){
    if (this.line) return
    let entryPrice = this.props.entryPrice;
    if(!entryPrice){
      return;
    }
    let price = this.props.price;
    if(price === null || price === undefined){
      return;
    }
    let datafeed = this.props.datafeed;
    if(!datafeed){
      return;
    }
    let symbol = this.getSymbol();
    if(!symbol){
      return;
    }
    let tickSize = datafeed.getTickSize(symbol);
    let tickValue = datafeed.getTickValue(symbol);
    if(tickSize === null || tickSize === undefined || tickValue === null || tickValue === undefined){
      return;
    }
    let line = await this.createOrderLine();
    if(!line){
      return;
    }
    let size = this.props.contracts;
    let pnl = this.calcPnL(entryPrice, price, size, tickSize, tickValue);

    line.onModify(() => {})
    line.onCancel(() => {
        line.remove();
        this.props.onCancel?.();
    })
    line.onMove(() => {
      this.props.onUpdate?.(line.getPrice());
    })
    line.onMoving(() => {
      let target_price = line.getPrice();
      let pnl = this.calcPnL(entryPrice, target_price, size, tickSize, tickValue);
      let text = this.formatDollar(pnl)
      this.setTvLineText(line, text);
      this.props.onMoving?.(target_price);
    })
    line.setPrice(price);
    this.setTvLineText(line, this.formatDollar(pnl));
    line.setQuantity((size * -1).toString());
    line.setLineStyle(2);
    line.setLineLength(this.ORDER_RIGHT_PLOT_SIDE);
    line.setQuantityBackgroundColor('#00ff00');
    this.setLineColor(line);
  }

  async updateTakeProfitLine(){
    let entryPrice = this.props.entryPrice;
    if(!entryPrice){
      return;
    }
    let price = this.props.price;
    if(price === null || price === undefined){
      return;
    }
    let size = this.props.contracts;
    let datafeed = this.props.datafeed;
    if(!datafeed){
      return;
    }
    let symbol = this.getSymbol();
    if(!symbol){
      return;
    }

    if(!this.line){
      if (this.orderLineCreatePromise) {
        await this.orderLineCreatePromise
      } else {
        await this.createTakeProfitLine();
      }
      if(!this.line){
        return;
      }
    }

    this.applyTakeProfitLineVisual(entryPrice, price, size, datafeed, symbol)
  }

  private applyTakeProfitLineVisual(
    entryPrice: number,
    price: number,
    size: number,
    datafeed: NonNullable<ChartPositionLineProps['datafeed']>,
    symbol: string
  ): void {
    if (!this.line) return
    let tickSize = datafeed.getTickSize(symbol);
    let tickValue = datafeed.getTickValue(symbol);
    if(tickSize === null || tickSize === undefined || tickValue === null || tickValue === undefined){
      return;
    }
    let pnl = this.calcPnL(entryPrice, price, size, tickSize, tickValue);
    let text = this.formatDollar(pnl)
    this.setTvLineText(this.line, text);
    try {
      this.line.setQuantity((size * -1).toString());
      this.line.setPrice(price);
    } catch (err) {
      debugTradeseaSl('chart:line-update-error', {
        symbol: this.props.symbol,
        lineType: 'take_profit',
        message: err instanceof Error ? err.message : String(err),
      })
      this.detachTvLine()
      return
    }

    if(size > 0){
      if(price <= entryPrice){
        this.setLineColor(this.line, false);
      }else{
        this.setLineColor(this.line);
      }
    }else{
      if(price >= entryPrice){
        this.setLineColor(this.line, false);
      }else{
        this.setLineColor(this.line);
      }
    }
  }

  async createOrderLine(){
    if(this.line){
      this.line.remove();
      this.line = null;
    }
    if (this.orderLineCreatePromise) {
      return this.orderLineCreatePromise
    }
    this.orderLineCreatePromise = this.createOrderLineImpl()
    try {
      return await this.orderLineCreatePromise
    } finally {
      this.orderLineCreatePromise = null
    }
  }

  private async createOrderLineImpl(){
    let chart = this.props.chart;
    if(!chart){
      console.error('[ChartPositionLine] createOrderLine: chart is null or undefined');
      return null;
    }
    if(typeof chart.createOrderLine !== 'function'){
      console.error('[ChartPositionLine] createOrderLine: chart.createOrderLine is not a function');
      return null;
    }
    try {
      let line = await chart.createOrderLine();
      if(!line){
        console.error('[ChartPositionLine] createOrderLine: Failed to create order line - returned null');
        return null;
      }
      line.onContextMenu(() => {return []})
      line.setBodyBorderColor('#000');
      line.setQuantityTextColor('#000');
      line.setQuantityBorderColor('#000');
      line.setCancelButtonBorderColor('#000');
      line.setCancelButtonIconColor('#000');
      this.line = line;
      debugTradeseaSl('chart:line-created', {
        symbol: this.props.symbol,
        lineType: this.props.lineType,
        entryPrice: this.props.entryPrice,
        price: this.props.price,
        contracts: this.props.contracts,
      })
      return line;
    } catch (error) {
      console.error('[ChartPositionLine] createOrderLine: Error creating order line', error);
      return null;
    }
  }

  /**
   * Create a limit order line (for Limit Buy or Limit Sell orders)
   * @param price - The limit price
   * @param quantity - The order quantity
   * @param orderType - 'Limit' or 'Stop'
   * @param action - 'Buy' or 'Sell'
   * @param onCancel - Optional callback when order is cancelled
   * @returns The created order line or null if failed
   */
  async createLimitOrder(
    price: number,
    quantity: number,
    orderType: 'Limit' | 'Stop',
    action: 'Buy' | 'Sell',
    onCancel?: () => void
  ): Promise<any | null> {
    if(this.line){
      this.line.remove();
    }
    let chart = this.props.chart;
    if(!chart){
      console.error('[ChartPositionLine] createLimitOrder: chart is null or undefined');
      return null;
    }
    if(typeof chart.createOrderLine !== 'function'){
      console.error('[ChartPositionLine] createLimitOrder: chart.createOrderLine is not a function');
      return null;
    }
    try {
      let line = await chart.createOrderLine();
      if(!line){
        console.error('[ChartPositionLine] createLimitOrder: Failed to create order line - returned null');
        return null;
      }
      
      // Set text indicating order type (e.g., "LIMIT BUY" or "LIMIT SELL")
      const orderTypeText = orderType === 'Limit' ? 'LIMIT' : 'STOP'
      const actionText = action === 'Buy' ? 'BUY' : 'SELL'
      line.setText(`${orderTypeText} ${actionText}`)
      
      // Set price and quantity
      line.setPrice(price)
      line.setQuantity(quantity.toString())
      
      // Set line style and length
      line.setLineStyle(0)
      line.setLineLength(this.ORDER_RIGHT_PLOT_SIDE)
      
      // Set gray background color (like cancel button)
      const grayColor = '#808080' // Gray color similar to cancel button
      line.setBodyBackgroundColor(grayColor)
      line.setBodyTextColor('#000') // Black text on gray background
      line.setBodyBorderColor('#000')
      line.setLineColor(grayColor)
      
      // Set quantity background color based on buy/sell
      if (action === 'Buy') {
        line.setQuantityBackgroundColor('#00ff00') // Green for buy
        line.setQuantityTextColor('#000')
      } else {
        line.setQuantityBackgroundColor('#ff0000') // Red for sell
        line.setQuantityTextColor('#fff')
      }
      line.setQuantityBorderColor('#000')
      
      // Set cancel button colors
      line.setCancelButtonBorderColor('#000')
      line.setCancelButtonIconColor('#000')
      
      // Set cancel callback
      line.onCancel(() => {
        line.remove()
        onCancel?.()
      })
      
      // Disable context menu
      line.onContextMenu(() => {return []})
      
      this.line = line;
      return line;
    } catch (error) {
      console.error('[ChartPositionLine] createLimitOrder: Error creating limit order line', error);
      return null;
    }
  }

  private setLineColor(line: any, isGreen = true){
    const color = isGreen ? '#00ff00' : '#ff0000';
    line.setBodyBackgroundColor(color)
    line.setBodyTextColor(isGreen ? '#000' : '#fff')
    line.setLineColor(color)
  }

  private calcPnL(entryPrice: number, currentPrice: number, positionSize: number, tickSize: number, tickValue: number): number {
    return ((currentPrice - entryPrice) / tickSize) * tickValue * positionSize
  }

  private formatDollar(pnl: number, include: '+' | '-' | 'both' = 'both'): string {
    const showPlus = include === '+' || include === 'both'
    const showMinus = include === '-' || include === 'both'
    const sign = pnl >= 0 
      ? (showPlus ? '+' : '') + '$'
      : '$' + (showMinus ? '-' : '')
    return sign + Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

}

export default ChartPositionLine

