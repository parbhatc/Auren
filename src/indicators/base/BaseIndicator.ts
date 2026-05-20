/**
 * Base class for creating custom TradingView indicators
 * Extend this class to create your own indicators
 */
import { CandleNode } from './CandleNode'
import { ShapesAPI } from '../shapes/ShapesAPI'
import type {
  PlotDefinition,
  InputDefinition,
  PaletteDefinition,
  PlotStyle,
  DefaultStyle,
  TimeframeConfig,
  TimeframeInfo,
  TimeframeChange,
  PineJSContext,
  InputCallback,
  PineJS
} from '../types'

export abstract class BaseIndicator {
  name: string
  displayName: string
  description: string
  plots: PlotDefinition[]
  inputs: InputDefinition[]
  isPriceStudy: boolean
  isHiddenStudy: boolean
  palettes: Record<string, PaletteDefinition>
  plotStyles: Record<string, PlotStyle>
  defaultStyles: Record<string, DefaultStyle>
  paletteDefaults: Record<string, { colors: any[] }>
  
  // Candle management - persists across init() calls
  candleMap: Map<string, Map<number, CandleNode>>
  latestCandle: Map<string, CandleNode>
  
  // Period and symbol tracking
  period: string | null
  symbol: string | null
  
  // Timeframe ID to index mapping
  protected _timeframeIdMap: Map<string, number>
  
  // Shapes API for drawing operations
  protected _shapesAPI: ShapesAPI
  
  // Reference to IndicatorManager (set when registered)
  protected _indicatorManager: any
  
  // Previous inputs tracking
  protected _previousInputs?: Map<string, any>

  constructor(name: string, displayName: string, description: string) {
    this.name = name
    this.displayName = displayName
    this.description = description
    this.plots = []
    this.inputs = []
    this.isPriceStudy = false
    this.isHiddenStudy = false
    this.palettes = {}
    this.plotStyles = {}
    this.defaultStyles = {}
    this.paletteDefaults = {}
    
    this.candleMap = new Map()
    this.latestCandle = new Map()
    
    this.period = null
    this.symbol = null
    
    this._timeframeIdMap = new Map()
    
    this._shapesAPI = new ShapesAPI()
    this._indicatorManager = null
  }

  onRemove(): void {
    this.reset()
  }

  onHidden(): void {
    this.reset()
  }

  onShown(): void {
    this.reset()
  }

  setPlots(plots: PlotDefinition[]): this {
    this.plots = plots
    return this
  }

  addPlot(id: string, type: string, options: Record<string, any> = {}): this {
    this.plots.push({
      id,
      type,
      ...options
    })
    return this
  }

  addPalette(id: string, colorNames: Record<number, { name: string }>): this {
    this.palettes[id] = {
      colors: colorNames
    }
    return this
  }

  setPaletteDefaults(paletteId: string, colors: any[]): this {
    this.paletteDefaults[paletteId] = {
      colors
    }
    return this
  }

  setPlotStyle(plotId: string, style: PlotStyle): this {
    this.plotStyles[plotId] = style
    return this
  }

  setDefaultStyle(plotId: string, style: DefaultStyle): this {
    this.defaultStyles[plotId] = style
    return this
  }

  setInputs(inputs: InputDefinition[]): this {
    this.inputs = inputs
    return this
  }

  addIntegerInput(
    id: string,
    name: string,
    defval: number,
    min?: number,
    max?: number,
    group?: string,
    inline?: string
  ): this {
    const input: any = {
      id,
      name,
      type: 'integer',
      defval
    }
    if (min !== undefined) input.min = min
    if (max !== undefined) input.max = max
    if (group !== undefined) input.group = group
    if (inline !== undefined) input.inline = inline
    this.inputs.push(input)
    return this
  }

  addFloatInput(
    id: string,
    name: string,
    defval: number,
    min?: number,
    max?: number,
    step?: number,
    group?: string,
    inline?: string
  ): this {
    const input: any = {
      id,
      name,
      type: 'float',
      defval
    }
    if (min !== undefined) input.min = min
    if (max !== undefined) input.max = max
    if (step !== undefined) input.step = step
    if (group !== undefined) input.group = group
    if (inline !== undefined) input.inline = inline
    this.inputs.push(input)
    return this
  }

  addSourceInput(
    id: string,
    name: string,
    defval: string = 'close',
    options?: string[],
    group?: string,
    inline?: string
  ): this {
    const input: any = {
      id,
      name,
      type: 'source',
      defval,
      options: options || ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4']
    }
    if (group !== undefined) input.group = group
    if (inline !== undefined) input.inline = inline
    this.inputs.push(input)
    return this
  }

  addTextInput(
    id: string,
    name: string,
    defval: string,
    options?: string[],
    group?: string,
    inline?: string
  ): this {
    const input: any = {
      id,
      name,
      type: 'text',
      defval
    }
    if (options !== undefined && options !== null && Array.isArray(options) && options.length > 0) {
      input.options = options
    }
    if (group !== undefined) input.group = group
    if (inline !== undefined) input.inline = inline
    this.inputs.push(input)
    return this
  }

  addBooleanInput(
    id: string,
    name: string,
    defval: boolean,
    group?: string,
    inline?: string
  ): this {
    const input: any = {
      id,
      name,
      type: 'bool',
      defval
    }
    if (group !== undefined) input.group = group
    if (inline !== undefined) input.inline = inline
    this.inputs.push(input)
    return this
  }

  addColorInput(
    id: string,
    name: string,
    defval: string,
    group?: string,
    inline?: string
  ): this {
    const input: any = {
      id,
      name,
      type: 'color',
      defval
    }
    if (group !== undefined) input.group = group
    if (inline !== undefined) input.inline = inline
    this.inputs.push(input)
    return this
  }

  addResolutionInput(
    id: string,
    name: string,
    defval: string = '1',
    group?: string,
    inline?: string
  ): this {
    const input: any = {
      id,
      name,
      type: 'resolution',
      defval
    }
    if (group !== undefined) input.group = group
    if (inline !== undefined) input.inline = inline
    this.inputs.push(input)
    return this
  }

  addTimeframeGroup(
    index: number,
    config: TimeframeConfig,
    group: string = 'Timeframes',
    inlinePrefix: string | null = null
  ): this {
    const inline = inlinePrefix || `tf_${index}_inline`
    const prefix = `tf_${index}`
    
    if (config.id) {
      this._timeframeIdMap.set(config.id, index)
    }
    
    this.addBooleanInput(`${prefix}`, `Timeframe ${index + 1}`, config.enabled || false, group, inline)
    this.addResolutionInput(`${prefix}_res`, '', config.resolution || '', group, inline)
    this.addTextInput(`${prefix}_text`, '', config.text || 'FVG', undefined, group, inline)
    
    return this
  }

  addTimeframes(timeframes: TimeframeConfig[], group: string = 'Timeframes'): this {
    timeframes.forEach((config, index) => {
      this.addTimeframeGroup(index, config, group)
    })
    return this
  }

  addInputGroup(
    groupName: string,
    inputs: Array<{
      type: string
      id: string
      name: string
      defval: any
      inline?: string
      [key: string]: any
    }>,
    options: { inlinePrefix?: string; sharedInline?: boolean } = {}
  ): this {
    const inlinePrefix = options.inlinePrefix || `${groupName.toLowerCase().replace(/\s+/g, '_')}_inline`
    const sharedInline = options.sharedInline !== undefined ? options.sharedInline : false
    
    inputs.forEach((inputConfig, index) => {
      const { type, id, name, defval, inline, ...inputOptions } = inputConfig
      
      let finalInline = inline
      if (!finalInline) {
        finalInline = sharedInline ? inlinePrefix : `${inlinePrefix}_${index}`
      }
      
      switch (type) {
        case 'boolean':
        case 'bool':
          this.addBooleanInput(id, name, defval, groupName, finalInline)
          break
        case 'integer':
        case 'int':
          this.addIntegerInput(id, name, defval, inputOptions.min, inputOptions.max, groupName, finalInline)
          break
        case 'float':
          this.addFloatInput(id, name, defval, inputOptions.min, inputOptions.max, inputOptions.step, groupName, finalInline)
          break
        case 'text':
        case 'string':
          this.addTextInput(id, name, defval, inputOptions.options, groupName, finalInline)
          break
        case 'color':
          this.addColorInput(id, name, defval, groupName, finalInline)
          break
        case 'resolution':
        case 'timeframe':
          this.addResolutionInput(id, name, defval, groupName, finalInline)
          break
        case 'source':
          this.addSourceInput(id, name, defval, inputOptions.options, groupName, finalInline)
          break
        default:
          console.warn(`Unknown input type: ${type} for input ${id}`)
      }
    })
    return this
  }

  getInputIndexById(id: string): number {
    return this.inputs.findIndex(input => input.id === id)
  }

  getInputValueById(id: string): any {
    return this._previousInputs ? this._previousInputs.get(id) : undefined
  }

  protected _resolveTimeframeIndex(identifier: number | string): number {
    if (typeof identifier === 'number') {
      return identifier
    }
    const index = this._timeframeIdMap.get(identifier)
    if (index !== undefined) {
      return index
    }
    throw new Error(`Timeframe identifier "${identifier}" not found`)
  }

  isTimeframeEnabled(identifier: number | string): boolean {
    const index = this._resolveTimeframeIndex(identifier)
    return this.getInputValueById(`tf_${index}`) === true
  }

  getTimeframeResolution(identifier: number | string): string {
    const index = this._resolveTimeframeIndex(identifier)
    return this.getInputValueById(`tf_${index}_res`)
  }

  getTimeframeText(identifier: number | string): string {
    const index = this._resolveTimeframeIndex(identifier)
    return this.getInputValueById(`tf_${index}_text`)
  }

  getTimeframeInfo(identifier: number | string): TimeframeInfo {
    const index = this._resolveTimeframeIndex(identifier)
    return {
      index,
      enabled: this.isTimeframeEnabled(index),
      resolution: this.getTimeframeResolution(index),
      text: this.getTimeframeText(index)
    }
  }

  areAllTimeframesDisabled(): boolean {
    const allTimeframes = this.getAllTimeFrameInfo()
    if (allTimeframes.length === 0) {
      return true
    }
    return allTimeframes.every(tf => !tf.enabled)
  }

  getAllTimeFrameInfo(): TimeframeInfo[] {
    const timeframes: TimeframeInfo[] = []
    
    const timeframeIndices = new Set<number>()
    this.inputs.forEach(input => {
      const match = input.id.match(/^tf_(\d+)$/)
      if (match) {
        timeframeIndices.add(parseInt(match[1], 10))
      }
    })
    
    const sortedIndices = Array.from(timeframeIndices).sort((a, b) => a - b)
    
    const indexToIdMap = new Map<number, string>()
    this._timeframeIdMap.forEach((index, id) => {
      indexToIdMap.set(index, id)
    })
    
    sortedIndices.forEach(index => {
      const info: TimeframeInfo = {
        index,
        enabled: this.isTimeframeEnabled(index),
        resolution: this.getTimeframeResolution(index),
        text: this.getTimeframeText(index)
      }
      
      const id = indexToIdMap.get(index)
      if (id) {
        info.id = id
      }
      
      timeframes.push(info)
    })
    
    return timeframes
  }

  hasTimeframeChanges(changes: Record<string, any> | null): boolean {
    if (!changes) return false
    return Object.keys(changes).some(key => 
      key.startsWith('tf_') && (key.endsWith('_res') || key.endsWith('_text') || /^tf_\d+$/.test(key))
    )
  }

  getTimeframeChanges(changes: Record<string, any> | null): Record<string | number, TimeframeChange> {
    if (!changes) return {}
    
    const timeframeChanges: Record<string | number, TimeframeChange> = {}
    
    Object.keys(changes).forEach(key => {
      const enabledMatch = key.match(/^tf_(\d+)$/)
      if (enabledMatch) {
        const index = parseInt(enabledMatch[1], 10)
        const id = this._getTimeframeIdByIndex(index)
        const identifier = id || index
        if (!timeframeChanges[identifier]) {
          timeframeChanges[identifier] = { index }
        }
        timeframeChanges[identifier].enabled = changes[key]
      }
      
      const resMatch = key.match(/^tf_(\d+)_res$/)
      if (resMatch) {
        const index = parseInt(resMatch[1], 10)
        const id = this._getTimeframeIdByIndex(index)
        const identifier = id || index
        if (!timeframeChanges[identifier]) {
          timeframeChanges[identifier] = { index }
        }
        timeframeChanges[identifier].resolution = changes[key]
      }
      
      const textMatch = key.match(/^tf_(\d+)_text$/)
      if (textMatch) {
        const index = parseInt(textMatch[1], 10)
        const id = this._getTimeframeIdByIndex(index)
        const identifier = id || index
        if (!timeframeChanges[identifier]) {
          timeframeChanges[identifier] = { index }
        }
        timeframeChanges[identifier].text = changes[key]
      }
    })
    
    return timeframeChanges
  }

  protected _getTimeframeIdByIndex(index: number): string | undefined {
    for (const [id, idx] of this._timeframeIdMap.entries()) {
      if (idx === index) {
        return id
      }
    }
    return undefined
  }

  setPriceStudy(value: boolean = true): this {
    this.isPriceStudy = value
    return this
  }

  setHiddenStudy(value: boolean = true): this {
    this.isHiddenStudy = value
    return this
  }

  getPlotStyles(): Record<string, PlotStyle> {
    return this.plotStyles
  }

  processInputs(): { processedInputs: InputDefinition[]; inputDefaults: Record<string, any> } {
    const processedInputs: InputDefinition[] = []
    const inputDefaults: Record<string, any> = {}
    
    this.inputs.forEach(input => {
      processedInputs.push(input)
      if ((input as any).defval !== undefined) {
        inputDefaults[input.id] = (input as any).defval
      } else if ((input as any).def !== undefined) {
        inputDefaults[input.id] = (input as any).def
      }
    })
    
    return { processedInputs, inputDefaults }
  }

  getDefaults(): Record<string, any> {
    const defaults: Record<string, any> = {
      styles: this.defaultStyles
    }
    
    if (Object.keys(this.paletteDefaults).length > 0) {
      defaults.palettes = this.paletteDefaults
    }
    
    return defaults
  }

  buildMetainfo(): any {
    const { processedInputs, inputDefaults } = this.processInputs()
    const defaults = this.getDefaults()
    const plots = this.plots
    const styles = this.getPlotStyles()
    
    const metainfo: any = {
      _metainfoVersion: 52,
      description: this.displayName || this.name,
      shortDescription: this.description || this.displayName || this.name,
      is_price_study: this.isPriceStudy,
      is_hidden_study: this.isHiddenStudy,
      id: this.name + '@tv-basicstudies-1',
      isTVScript: false,
      isTVScriptStub: false,
      plots,
      styles,
      defaults: {
        ...defaults,
        inputs: { ...inputDefaults, ...defaults.inputs }
      },
      inputs: processedInputs,
      isCustomIndicator: true,
      format: { type: 'price' }
    }
    
    if (Object.keys(this.palettes).length > 0) {
      metainfo.palettes = this.palettes
    }
    
    return metainfo
  }

  buildConstructor(PineJS: PineJS): any {
    const self = this
    return function(this: any) {
      this._indicatorInstance = self
      
      this.init = function(context: PineJSContext, inputCallback: InputCallback) {
        this._context = context
        this._input = inputCallback
        this._PineJS = PineJS
        
        let studyId: string | null = null
        if (typeof (this as any)._studyId !== 'undefined') {
          studyId = (this as any)._studyId
        } else if (typeof (this as any).studyId !== 'undefined') {
          studyId = (this as any).studyId
        } else if (context && (context as any).studyId) {
          studyId = (context as any).studyId
        }
        
        if (self._shapesAPI && studyId) {
          self._shapesAPI.setOwnerStudyId(studyId)
        }
        
        const manager = self.getIndicatorManager()
        if (manager && manager.widget) {
          self._shapesAPI.setWidget(manager.widget)
        }
        
        let period = PineJS.Std.period(context)
        let symbol = PineJS.Std.ticker(context)
        
        if (self.period !== period) {
          if (self.period !== null) {
            if (typeof (self as any).onPeriodChanged === 'function') {
              ;(self as any).onPeriodChanged.call(self, self.period, period)
            } else {
              self.reset()
            }
          }
          self.period = period
        }
        
        if (self.symbol !== symbol) {
          if (self.symbol !== null) {
            if (typeof (self as any).onSymbolChanged === 'function') {
              ;(self as any).onSymbolChanged.call(self, self.symbol, symbol)
            } else {
              self.reset()
            }
          }
          self.symbol = symbol
        }
        
        let changes: Record<string, any> = {}
        let firstInit = false
        if (!self._previousInputs) {
          firstInit = true
          self._previousInputs = new Map()
        }
        self.inputs.forEach(input => {
          let index = self.getInputIndexById(input.id)
          const value = inputCallback(index)
          
          if (firstInit) {
            self._previousInputs!.set(input.id, value)
          } else {
            let previousValue = self._previousInputs!.get(input.id)
            if (value !== previousValue) {
              changes[input.id] = { index, old: previousValue, new: value }
              self._previousInputs!.set(input.id, value)
            }
          }
        })
        
        if (!firstInit && self.hasTimeframeChanges && typeof self.hasTimeframeChanges === 'function') {
          if (self.hasTimeframeChanges(changes)) {
            self.reset()
          }
        }
        
        if ((self as any).init) {
          ;(self as any).init.call(this, context, inputCallback, firstInit ? null : changes)
        }
      }
      
      this.main = function(context: PineJSContext, inputCallback: InputCallback) {
        this._context = context
        this._input = inputCallback
        this._PineJS = PineJS
        
        this.candle = function(offset: number, id?: string) {
          return self.candle.call(self, offset, id)
        }
        
        if ((self as any).main) {
          return (self as any).main.call(this, context, inputCallback)
        }
        
        return NaN
      }
    }
  }

  candle(offset: number, id: string = 'current'): CandleNode | null {
    const latest = this.latestCandle.get(id)
    if (!latest) return null
    return latest.at(offset)
  }

  getShapes(): ShapesAPI {
    return this._shapesAPI
  }

  setStudyId(studyId: string): void {
    if (this._shapesAPI) {
      this._shapesAPI.setOwnerStudyId(studyId)
    }
  }

  getIndicatorManager(): any {
    if (this._indicatorManager) {
      return this._indicatorManager
    }
    if (typeof (window as any).indicatorManager !== 'undefined') {
      return (window as any).indicatorManager
    }
    return null
  }

  setIndicatorManager(manager: any): void {
    this._indicatorManager = manager
  }

  processCandle(
    time: number,
    open: number,
    high: number,
    low: number,
    close: number,
    id: string = 'current'
  ): CandleNode | null {
    if (time === undefined || time === null || isNaN(time)) {
      return null
    }

    if (!this.candleMap) {
      this.candleMap = new Map()
      this.latestCandle = new Map()
    }

    let timeMap = this.candleMap.get(id)
    if (!timeMap) {
      timeMap = new Map()
      this.candleMap.set(id, timeMap)
    }

    let latestCandleForId = this.latestCandle.get(id) || null

    if (timeMap.has(time)) {
      const existingCandle = timeMap.get(time)!
      
      if (existingCandle.open !== open || existingCandle.close !== close || 
          existingCandle.high !== high || existingCandle.low !== low) {
        existingCandle.open = open
        existingCandle.close = close
        existingCandle.high = high
        existingCandle.low = low
        
        return existingCandle
      }
      return null
    }

    const candle = new CandleNode(time, open, high, low, close)
    
    if (!latestCandleForId) {
      this.latestCandle.set(id, candle)
    } else {
      if (time > latestCandleForId.time) {
        candle.previous = latestCandleForId
        latestCandleForId.next = candle
        this.latestCandle.set(id, candle)
      } else if (time < latestCandleForId.time) {
        let current: CandleNode | null = latestCandleForId
        
        while (current.previous && current.previous.time > time) {
          current = current.previous
        }
        
        candle.previous = current.previous
        candle.next = current
        
        if (current.previous) {
          current.previous.next = candle
        }
        current.previous = candle
      } else {
        timeMap.set(time, candle)
        return candle
      }
    }
    
    timeMap.set(time, candle)
    return candle
  }

  toTradingViewFormat(PineJS: PineJS): any {
    return {
      name: this.name,
      metainfo: this.buildMetainfo(),
      constructor: this.buildConstructor(PineJS)
    }
  }

  pivotHigh(
    leftBars: number = 5,
    rightBars: number = 5,
    fromCandle: CandleNode | null = null
  ): { candle: CandleNode; price: number; time: number } | null {
    if (!fromCandle) {
      fromCandle = this.candle(0)
    }
    
    if (!fromCandle) {
      return null
    }
    
    const pivotCandle = fromCandle.at(rightBars)
    if (!pivotCandle) {
      return null
    }
    
    const pivotHigh = pivotCandle.high
    
    for (let i = 1; i <= leftBars; i++) {
      const leftCandle = pivotCandle.at(i)
      if (!leftCandle || leftCandle.high > pivotHigh) {
        return null
      }
    }
    
    for (let i = 1; i <= rightBars; i++) {
      const rightCandle = pivotCandle.at(-i)
      if (rightCandle && rightCandle.high > pivotHigh) {
        return null
      }
    }
    
    return {
      candle: pivotCandle,
      price: pivotHigh,
      time: pivotCandle.time
    }
  }

  pivotLow(
    leftBars: number = 5,
    rightBars: number = 5,
    fromCandle: CandleNode | null = null
  ): { candle: CandleNode; price: number; time: number } | null {
    if (!fromCandle) {
      fromCandle = this.candle(0)
    }
    
    if (!fromCandle) {
      return null
    }
    
    const pivotCandle = fromCandle.at(rightBars)
    if (!pivotCandle) {
      return null
    }
    
    const pivotLow = pivotCandle.low
    
    for (let i = 1; i <= leftBars; i++) {
      const leftCandle = pivotCandle.at(i)
      if (!leftCandle || leftCandle.low < pivotLow) {
        return null
      }
    }
    
    for (let i = 1; i <= rightBars; i++) {
      const rightCandle = pivotCandle.at(-i)
      if (rightCandle && rightCandle.low < pivotLow) {
        return null
      }
    }
    
    return {
      candle: pivotCandle,
      price: pivotLow,
      time: pivotCandle.time
    }
  }

  resolutionToMinutes(res: string): number {
    const number = parseInt(res, 10)
    if (res.includes('D')) return number * 1440
    if (res.includes('W')) return number * 10080
    if (res.includes('M')) return number * 43200
    return number * 60
  }

  rgbaToOpaque(color: string, opacity: number = 1): string {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/)
    if (!match) return color
    
    const [, r, g, b] = match
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  reset(): void {
    this.candleMap = new Map()
    this.latestCandle = new Map()

    this._shapesAPI.shapeIds.forEach(shapeId => {
      this.getShapes().deleteShape(shapeId)
    })
  }
}

