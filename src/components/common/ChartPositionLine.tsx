import { ChartPositionLineProps } from '../../types/chart'
import {
  chartLineColors,
  chartQtyColors,
  sideToChartAction,
  TRADING_SIDE_CHART,
} from '../../constants/tradingSide'
import { debugTradeseaSl } from '../../services/tradesea/tradeseaDebug'
import { isBwcChartPanning, whenBwcPanEnds } from '../../utils/bwcPan'
import type { OrderSide } from '../../types/order'
import { resolvePositionLineBracketType } from '../../utils/practiceBracketMath'

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
  private readonly PILL_FONT_WEIGHT = 600
  private readonly PILL_FONT_FAMILY =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  private line: any
  /** Prevents duplicate TV order lines while createOrderLine is in flight. */
  private orderLineCreatePromise: Promise<any> | null = null
  private lastPositionPnlText = ''
  private lastPositionProfit = true

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
    this.lastPositionPnlText = ''
    this.lastPositionProfit = true
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
        const datafeed = this.props.datafeed
        let target = line.target ?? { price: line.getPrice(), type: null as 'stop_loss' | 'take_profit' | null }
        if (!target.type) {
          const mark = datafeed?.getLastBarForChart(this.props.chart)?.close ?? null
          const tickSize = datafeed?.getTickSize(this.getSymbol()) ?? null
          target.type = resolvePositionLineBracketType(
            this.getContracts(),
            this.getEntryPrice(),
            target.price ?? line.getPrice(),
            mark,
            tickSize
          )
        }
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
        let mark = lastBar?.close ?? null;
        let tickSize = datafeed.getTickSize(symbol);
        let tickValue = datafeed.getTickValue(symbol);
        let pnl = this.calcPnL(entry, target_price, size, tickSize, tickValue);
        let text = this.formatDollar(pnl, "-")

        const bracketType = resolvePositionLineBracketType(
          size,
          entry,
          target_price,
          mark,
          tickSize
        )
        line.target.type = bracketType

        if (bracketType === 'stop_loss') {
          line.setText('Set Stop Market ' + text);
          this.setLineColor(line, this.isStopLossInProfitZone(entry, target_price, size, tickSize));
        } else {
          line.setText('Set Take Profit ' + text);
          this.setLineColor(line);
        }
    })
    line.setPrice(entryPrice);
    line.setQuantity(this.getContracts().toString());
    line.setLineStyle(2);
    line.setLineLength(this.RIGHT_PLOT_SIDE);
    this.applyFullWidthLine(line);
    this.applyPositionPillOffset(line);
    this.applyPillTextStyle(line);
    this.applyPillChrome(line, true);
    line.setCancelTooltip('Close position');
  }

  private bracketExitQuantity(size: number): string {
    return (size * -1).toString()
  }

  /** Long: SL at/above entry locks profit (green). Short: SL at/below entry (green). */
  private isStopLossInProfitZone(
    entryPrice: number,
    price: number,
    size: number,
    tickSize?: number | null
  ): boolean {
    const eps = tickSize && tickSize > 0 ? tickSize / 1000 : 1e-6
    if (size > 0) return price >= entryPrice - eps
    if (size < 0) return price <= entryPrice + eps
    return false
  }

  private applyStopLossBracketColors(
    line: any,
    entryPrice: number,
    price: number,
    size: number,
    tickSize: number | null | undefined,
    tickValue: number | null | undefined
  ): void {
    if (!line) return
    const inProfitZone = this.isStopLossInProfitZone(entryPrice, price, size, tickSize)
    this.applyChartLineColor(line, inProfitZone)
    if (tickSize != null && tickValue != null) {
      const pnl = this.calcPnL(entryPrice, price, size, tickSize, tickValue)
      this.setTvLineText(line, this.formatDollar(pnl))
    }
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
    if (isBwcChartPanning()) {
      whenBwcPanEnds(() => this.updatePositionLineByBar(bar, size, tickSize, tickValue))
      return
    }
    if(this.line.isMoving){
      return;
    }
    const barClose = bar.close;
    const entryPrice = this.props.entryPrice;
    const pnl = this.calcPnL(entryPrice, barClose, size, tickSize, tickValue);
    const profit = pnl >= 0;
    const text = this.formatDollar(pnl, "-");
    const textChanged = text !== this.lastPositionPnlText;
    const zoneChanged = profit !== this.lastPositionProfit;
    if (!textChanged && !zoneChanged) {
      return;
    }
    const { fill, text: textColor } = chartLineColors(profit);
    try {
      if (typeof this.line.applyAppearance === "function") {
        const patch: { text?: string; profit?: boolean; fill?: string; textColor?: string } = {};
        if (textChanged) {
          this.lastPositionPnlText = text;
          patch.text = text;
        }
        if (zoneChanged) {
          this.lastPositionProfit = profit;
          patch.profit = profit;
          patch.fill = fill;
          patch.textColor = textColor;
        }
        this.line.applyAppearance(patch);
      } else {
        if (textChanged) {
          this.lastPositionPnlText = text;
          this.line.setText(text);
        }
        if (zoneChanged) {
          this.lastPositionProfit = profit;
          this.applyChartLineColor(this.line, profit);
        }
      }
    } catch (err) {
      debugTradeseaSl('chart:line-update-error', {
        symbol: this.props.symbol,
        lineType: 'position',
        message: err instanceof Error ? err.message : String(err),
      })
      this.detachTvLine()
    }
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
      this.refreshBracketQuantity(line, liveSize);
      this.applyStopLossBracketColors(
        line,
        entryPrice,
        target_price,
        liveSize,
        tickSize,
        tickValue
      );
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
    this.applyStopLossBracketColors(line, entryPrice, price, size, tickSize, tickValue);
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
    try {
      this.refreshBracketQuantity(this.line, size);
      this.line.setPrice(price);
      this.applyStopLossBracketColors(
        this.line,
        entryPrice,
        price,
        size,
        tickSize,
        tickValue
      );
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
      this.applyPillChrome(line)
      this.applyPillTextStyle(line)
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
      line.setLineColor(gray.fill)

      const qtyColors = chartQtyColors(action === 'Buy' ? 'buy' : 'sell')
      line.setQuantityBackgroundColor(qtyColors.fill)

      this.applyPillChrome(line, action === 'Buy')
      
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
    const { fill, text } = chartLineColors(profit)
    line.setBodyBackgroundColor(fill)
    line.setLineColor(fill)
    if (typeof line?.setBodyTextColor === 'function') {
      line.setBodyTextColor(text)
    }
    if (typeof line?.setQuantityTextColor === 'function') {
      line.setQuantityTextColor(text)
    }
    if (typeof line?.setQuantityBackgroundColor === 'function') {
      line.setQuantityBackgroundColor(fill)
    }
    this.applyPillChrome(line, profit)
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

  /** Clean system UI font at pill size. */
  private getPillFontSize(): number {
    return 12
  }

  /** No black shell — let CSS handle subtle dividers and shadow. */
  private applyPillChrome(line: any, profit = true): void {
    if (typeof line?.setBodyBorderColor === 'function') {
      line.setBodyBorderColor('transparent')
    }
    if (typeof line?.setQuantityBorderColor === 'function') {
      line.setQuantityBorderColor('transparent')
    }
    if (typeof line?.setCancelButtonBorderColor === 'function') {
      line.setCancelButtonBorderColor('transparent')
    }
    if (typeof line?.setCancelButtonIconColor === 'function') {
      line.setCancelButtonIconColor('rgba(0, 0, 0, 0.5)')
    }
    if (typeof line?.setCancelButtonBackgroundColor === 'function') {
      line.setCancelButtonBackgroundColor('rgba(255, 255, 255, 0.96)')
    }
    const { text } = chartLineColors(profit)
    if (typeof line?.setBodyTextColor === 'function') {
      line.setBodyTextColor(text)
    }
    if (typeof line?.setQuantityTextColor === 'function') {
      line.setQuantityTextColor(text)
    }
  }

  private getPositionPillOffset(): number {
    return this.isMobileViewport() ? 40 : 200
  }

  private getBracketPillOffset(): number {
    return this.isMobileViewport() ? 56 : 300
  }

  private applyPositionPillOffset(line: any): void {
    this.applyPillOffset(line, this.getPositionPillOffset())
  }

  private applyBracketPillOffset(line: any): void {
    this.applyPillOffset(line, this.getBracketPillOffset())
  }

  private applyPillTextStyle(line: any): void {
    if (typeof line?.setBodyFontWeight === 'function') {
      line.setBodyFontWeight(this.PILL_FONT_WEIGHT)
    }
    if (typeof line?.setQuantityFontWeight === 'function') {
      line.setQuantityFontWeight(this.PILL_FONT_WEIGHT)
    }
    if (typeof line?.setBodyFontSize === 'function') {
      line.setBodyFontSize(this.getPillFontSize())
    }
    if (typeof line?.setQuantityFontSize === 'function') {
      line.setQuantityFontSize(this.getPillFontSize())
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

