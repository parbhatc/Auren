import { ChartPositionLineProps } from '../../types/chart'
import {
  chartLineColors,
  chartQtyColors,
  sideToChartAction,
  TRADING_SIDE_CHART,
} from '../../constants/tradingSide'
import { debugTradeseaSl } from '../../services/tradesea/tradeseaDebug'
import type { OrderSide } from '../../types/order'

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
  private readonly PILL_FONT_WEIGHT = 900
  private readonly PILL_FONT_SIZE = 12
  private readonly PILL_FONT_FAMILY = "'Trebuchet MS', Roboto, Ubuntu, sans-serif"
  private readonly PILL_TEXT_COLOR = '#000000'
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
      this.applyPillTextStyle(tvLine)
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
    let line = await this.createOrderLine();
    if(!line){
      console.error('[ChartPositionLine] createPositionLine: Failed to create order line');
      return;
    }
    this.updatePositionLine(this.props.contracts);

    line.onModify(() => {})
    line.onCancel(() => {
        line.remove();
        this.detachTvLine();
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

        const size = this.getContracts();
        const entry = this.getEntryPrice();
        let symbol = this.getSymbol();
        let datafeed = this.props.datafeed;
        let lastBar = datafeed.getLastBarForChart(this.props.chart);
        let tickSize = datafeed.getTickSize(symbol);
        let tickValue = datafeed.getTickValue(symbol);
        let pnl = this.calcPnL(entry, target_price, size, tickSize, tickValue);
        let text = this.formatDollar(pnl, "-")
        const eps = (tickSize || 0.25) / 1000

        if(size > 0){
          // Long: below/equal entry = stop loss, above entry = take profit
          if(target_price <= entry + eps){
            line.setText('Set Stop Market ' + text);
            this.setLineColor(line, false);
            line.target.type = 'stop_loss';
          }else{
            line.setText('Set Take Profit ' + text);
            this.setLineColor(line);
            line.target.type = 'take_profit';
          }
        }else if(size < 0){
          // Short: above/equal entry = stop loss, below entry = take profit
          if(target_price >= entry - eps){
            line.setText('Set Stop Market ' + text);
            this.setLineColor(line, false);
            line.target.type = 'stop_loss';
          }else{
            line.setText('Set Take Profit ' + text);
            this.setLineColor(line);
            line.target.type = 'take_profit';
          }
        }
    })
    line.setPrice(entryPrice);
    line.setQuantity(this.getContracts().toString());
    line.setLineStyle(2);
    line.setLineLength(this.RIGHT_PLOT_SIDE);
    this.applyFullWidthLine(line);
    this.applyPositionPillOffset(line);
    this.applyPillTextStyle(line);
    const qtyColors = chartQtyColors(this.getContracts() > 0 ? 'buy' : 'sell');
    line.setQuantityBackgroundColor(qtyColors.fill);
    line.setCancelTooltip('Close position');
  }

  private bracketExitQuantity(size: number): string {
    return (size * -1).toString()
  }

  private refreshBracketQuantity(line: any, size: number): void {
    line.setQuantity(this.bracketExitQuantity(size))
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
    this.applyPositionPillOffset(this.line);
  }
  
  private async createStopLossLine(){
    if (this.hasTvLine()) return
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
        this.detachTvLine();
        this.props.onCancel?.();
    })
    line.onMove(() => {
      const liveSize = this.getContracts();
      this.refreshBracketQuantity(line, liveSize);
      this.props.onUpdate?.(line.getPrice());
    })
    line.onMoving(() => {
      const liveSize = this.getContracts();
      let target_price = line.getPrice();
      let pnl = this.calcPnL(entryPrice, target_price, liveSize, tickSize, tickValue);
      let text = this.formatDollar(pnl, "-")
      this.setTvLineText(line, text);
      this.refreshBracketQuantity(line, liveSize);
      this.props.onMoving?.(target_price);
    })
    line.setPrice(price);
    this.setTvLineText(line, this.formatDollar(pnl));
    this.refreshBracketQuantity(line, size);
    line.setLineStyle(2);
    line.setLineLength(this.ORDER_RIGHT_PLOT_SIDE);
    this.applyFullWidthLine(line);
    this.applyBracketPillOffset(line);
    this.applyPillTextStyle(line);
    const slQty = chartQtyColors(pnl >= 0 ? 'buy' : 'sell');
    line.setQuantityBackgroundColor(slQty.fill);
    this.applyChartLineColor(line, pnl >= 0);
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
      this.refreshBracketQuantity(this.line, size);
      this.line.setPrice(price);
      const qtyColors = chartQtyColors(pnl >= 0 ? 'buy' : 'sell');
      this.line.setQuantityBackgroundColor(qtyColors.fill);
      this.applyChartLineColor(this.line, pnl >= 0);
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
      this.applyBracketPillOffset(this.line);
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
    if (this.hasTvLine()) return
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
        this.detachTvLine();
        this.props.onCancel?.();
    })
    line.onMove(() => {
      const liveSize = this.getContracts();
      this.refreshBracketQuantity(line, liveSize);
      this.props.onUpdate?.(line.getPrice());
    })
    line.onMoving(() => {
      const liveSize = this.getContracts();
      let target_price = line.getPrice();
      let pnl = this.calcPnL(entryPrice, target_price, liveSize, tickSize, tickValue);
      let text = this.formatDollar(pnl)
      this.setTvLineText(line, text);
      this.refreshBracketQuantity(line, liveSize);
      this.props.onMoving?.(target_price);
    })
    line.setPrice(price);
    this.setTvLineText(line, this.formatDollar(pnl));
    this.refreshBracketQuantity(line, size);
    line.setLineStyle(2);
    line.setLineLength(this.ORDER_RIGHT_PLOT_SIDE);
    this.applyFullWidthLine(line);
    this.applyBracketPillOffset(line);
    this.applyPillTextStyle(line);
    line.setQuantityBackgroundColor(TRADING_SIDE_CHART.buy.fill);
    this.applyChartLineColor(line, true);
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
      this.refreshBracketQuantity(this.line, size);
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
    this.applyBracketPillOffset(this.line);
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
      line.setCancelButtonBorderColor('#000');
      line.setCancelButtonIconColor('#000');
      this.applyPillTextStyle(line);
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
   * Working limit/stop order line — prefer this over createLimitOrder.
   */
  async createWorkingOrder(opts: {
    price: number
    quantity: number
    side: OrderSide
    orderType?: 'limit' | 'stop'
    onCancel?: () => void
  }): Promise<any | null> {
    return this.createLimitOrder(
      opts.price,
      opts.quantity,
      opts.orderType === 'stop' ? 'Stop' : 'Limit',
      sideToChartAction(opts.side),
      opts.onCancel
    )
  }

  /**
   * @deprecated use createWorkingOrder
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
      this.applyFullWidthLine(line)
      this.applyPillTextStyle(line)

      const gray = TRADING_SIDE_CHART.neutral
      line.setBodyBackgroundColor(gray.fill)
      line.setBodyBorderColor('#000')
      line.setLineColor(gray.fill)

      const qtyColors = chartQtyColors(action === 'Buy' ? 'buy' : 'sell')
      line.setQuantityBackgroundColor(qtyColors.fill)
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

  private applyChartLineColor(line: any, profit = true): void {
    const { fill } = chartLineColors(profit)
    line.setBodyBackgroundColor(fill)
    line.setLineColor(fill)
    this.applyPillTextStyle(line)
  }

  /** Span the horizontal rule across the full chart pane (BWC order line). */
  private applyFullWidthLine(line: any): void {
    if (typeof line?.setLineFullWidth === 'function') {
      line.setLineFullWidth(true)
    }
  }

  private applyPillOffset(line: any, offset: number): void {
    if (typeof line?.setPillOffset === 'function') {
      line.setPillOffset(offset)
    }
  }

  /** Position line sits closer to the price axis; SL/TP pills sit further left. */
  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  }

  private getPositionPillOffset(): number {
    return this.isMobileViewport() ? 28 : 200
  }

  private getBracketPillOffset(): number {
    return this.isMobileViewport() ? 44 : 300
  }

  private applyPositionPillOffset(line: any): void {
    this.applyPillOffset(line, this.getPositionPillOffset())
  }

  private applyBracketPillOffset(line: any): void {
    this.applyPillOffset(line, this.getBracketPillOffset())
  }

  private applyPillTextStyle(line: any): void {
    if (typeof line?.setBodyTextColor === 'function') {
      line.setBodyTextColor(this.PILL_TEXT_COLOR)
    }
    if (typeof line?.setQuantityTextColor === 'function') {
      line.setQuantityTextColor(this.PILL_TEXT_COLOR)
    }
    if (typeof line?.setBodyFontWeight === 'function') {
      line.setBodyFontWeight(this.PILL_FONT_WEIGHT)
    }
    if (typeof line?.setQuantityFontWeight === 'function') {
      line.setQuantityFontWeight(this.PILL_FONT_WEIGHT)
    }
    if (typeof line?.setBodyFontSize === 'function') {
      line.setBodyFontSize(this.PILL_FONT_SIZE)
    }
    if (typeof line?.setQuantityFontSize === 'function') {
      line.setQuantityFontSize(this.PILL_FONT_SIZE)
    }
    if (typeof line?.setBodyFontFamily === 'function') {
      line.setBodyFontFamily(this.PILL_FONT_FAMILY)
    }
    if (typeof line?.setQuantityFontFamily === 'function') {
      line.setQuantityFontFamily(this.PILL_FONT_FAMILY)
    }
  }

  /** @deprecated use applyChartLineColor */
  private setLineColor(line: any, isGreen = true): void {
    this.applyChartLineColor(line, isGreen)
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

