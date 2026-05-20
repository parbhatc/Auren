/**
 * Shapes API - Queues drawing operations asynchronously
 */
import type {
  Point,
  ShapeOptions,
  ChartAPI,
  TradingViewWidget
} from '../types'

export class ShapesAPI {
  private widget: TradingViewWidget | null = null
  private queue: Array<{
    type: string
    args: any[]
    resolve?: (value: any) => void
    reject?: (error: any) => void
  }> = []
  private ownerStudyId: string | null = null
  public shapeIds: Set<string> = new Set()

  /**
   * Set the TradingView widget reference
   */
  setWidget(widget: TradingViewWidget): void {
    this.widget = widget
    // Delay processing queue to ensure widget is fully initialized
    setTimeout(() => {
      this.processQueue()
    }, 100)
  }

  /**
   * Set the owner study ID (indicator ID) for attached drawings
   */
  setOwnerStudyId(studyId: string): void {
    this.ownerStudyId = studyId
  }

  /**
   * Get the active chart API
   */
  private getChart(): ChartAPI | null {
    if (!this.widget) {
      // Try to get from global indicatorManager
      if (typeof (window as any).indicatorManager !== 'undefined' && (window as any).indicatorManager?.widget) {
        this.widget = (window as any).indicatorManager.widget
      } else {
        return null
      }
    }
    
    // Widget might not be fully initialized yet, so check if chart() method exists
    if (!this.widget || typeof this.widget.chart !== 'function') {
      return null
    }
    
    // Try activeChart first, fallback to chart()
    try {
      if (typeof this.widget.activeChart === 'function') {
        const chart = this.widget.activeChart()
        if (chart) return chart as ChartAPI
      }
    } catch (error) {
      // activeChart might not be available yet, fall through to chart()
    }
    
    try {
      const chart = this.widget.chart()
      return chart as ChartAPI
    } catch (error) {
      return null
    }
  }

  /**
   * Process queued operations
   */
  private async processQueue(): Promise<void> {
    const chart = this.getChart()
    if (!chart || this.queue.length === 0) {
      return
    }

    const operations = [...this.queue]
    this.queue = []

    for (const operation of operations) {
      try {
        const result = await this.executeOperation(chart, operation)
        if (operation.resolve) {
          operation.resolve(result)
        }
      } catch (error) {
        console.error('Error executing shape operation:', error, operation)
        if (operation.reject) {
          operation.reject(error)
        }
      }
    }
  }

  /**
   * Execute a queued operation
   */
  private async executeOperation(chart: ChartAPI, operation: {
    type: string
    args: any[]
  }): Promise<string | null> {
    const { type, args } = operation

    // Add ownerStudyId to options if not already present
    if (this.ownerStudyId && args.length > 0) {
      const lastArg = args[args.length - 1]
      if (typeof lastArg === 'object' && lastArg !== null && !lastArg.ownerStudyId) {
        lastArg.ownerStudyId = this.ownerStudyId
      }
    }

    let properties: Record<string, any> = {}
    if (!args[1]) {
      args[1] = {}
    }
    args[1].disableSave = true
    args[1].disableSelection = true
    args[1].disableUndo = true
    args[1].lock = true
    args[1].filled = true
    if (args[1].properties) {
      properties = args[1].properties
    }

    let shapeId: string | null = null
    switch (type) {
      case 'createShape':
        shapeId = await chart.createShape(args[0], args[1])
        break
      case 'createMultipointShape':
        shapeId = await chart.createMultipointShape(args[0], args[1])
        break
      case 'createAnchoredShape':
        shapeId = await chart.createAnchoredShape(args[0], args[1])
        break
      case 'createExecutionShape':
        await chart.createExecutionShape(args[0], args[1])
        break
      default:
        console.warn('Unknown shape operation type:', type)
    }

    if (shapeId) {
      this.shapeIds.add(shapeId)
    }

    // Set properties if provided
    if (shapeId && properties) {
      const ids = Object.keys(properties)
      if (ids.length > 0) {
        const shape = chart.getShapeById(shapeId)
        if (shape) {
          for (const id of ids) {
            const property = properties[id]
            if (property !== undefined && property !== null) {
              try {
                if ((shape as any)._source?._properties?.[id]) {
                  (shape as any)._source._properties[id]._value = property
                }
              } catch (error) {
                console.warn('Error setting shape property:', id, error)
              }
            }
          }

          if ((shape as any)._source?._properties?._listeners) {
            ;(shape as any)._source._properties._listeners.fire()
          }
        }
      }
    }

    return shapeId
  }

  /**
   * Queue a shape operation
   */
  private async queueOperation(type: string, args: any[]): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const operation = { type, args, resolve, reject }

      const chart = this.getChart()
      if (chart) {
        this.executeOperation(chart, operation)
          .then((result) => {
            resolve(result)
          })
          .catch((error) => {
            reject(error)
          })
      } else {
        this.queue.push(operation)
      }
    })
  }

  /**
   * Create a single-point shape
   */
  async createShape(point: Point, options: ShapeOptions = {}): Promise<string | null> {
    return this.queueOperation('createShape', [point, options])
  }

  /**
   * Create a multi-point shape
   */
  async createMultipointShape(points: Point[], options: ShapeOptions = {}): Promise<string | null> {
    return this.queueOperation('createMultipointShape', [points, options])
  }

  /**
   * Create an anchored shape
   */
  async createAnchoredShape(position: Point, options: ShapeOptions = {}): Promise<string | null> {
    return this.queueOperation('createAnchoredShape', [position, options])
  }

  /**
   * Create an execution shape
   */
  async createExecutionShape(point: Point, options: ShapeOptions = {}): Promise<any> {
    return this.queueOperation('createExecutionShape', [point, options])
  }

  // Convenience methods for common shapes
  async createRectangle(point1: Point, point2: Point, options: ShapeOptions = {}): Promise<string | null> {
    return this.createMultipointShape([point1, point2], {
      shape: 'rectangle',
      ...options
    })
  }

  async createCircle(point1: Point, point2: Point, options: ShapeOptions = {}): Promise<string | null> {
    return this.createMultipointShape([point1, point2], {
      shape: 'circle',
      ...options
    })
  }

  async createTriangle(point1: Point, point2: Point, point3: Point, options: ShapeOptions = {}): Promise<string | null> {
    return this.createMultipointShape([point1, point2, point3], {
      shape: 'triangle',
      ...options
    })
  }

  async createTrendLine(point1: Point, point2: Point, options: ShapeOptions = {}): Promise<string | null> {
    return this.createMultipointShape([point1, point2], {
      shape: 'trend_line',
      ...options
    })
  }

  async createHorizontalLine(point: Point, options: ShapeOptions = {}): Promise<string | null> {
    return this.createShape(point, {
      shape: 'horizontal_line',
      ...options
    })
  }

  async createVerticalLine(point: Point, options: ShapeOptions = {}): Promise<string | null> {
    return this.createShape(point, {
      shape: 'vertical_line',
      ...options
    })
  }

  async createArrow(point1: Point, point2: Point, options: ShapeOptions = {}): Promise<string | null> {
    return this.createMultipointShape([point1, point2], {
      shape: 'arrow',
      ...options
    })
  }

  async createText(point: Point, text: string, options: ShapeOptions = {}): Promise<string | null> {
    return this.createShape(point, {
      shape: 'text',
      text,
      ...options
    })
  }

  // Update and Delete methods
  async updateShape(shapeId: string, properties: Record<string, any> = {}): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const chart = this.getChart()
      if (!chart) {
        reject(new Error('Chart not available'))
        return
      }

      if (!shapeId) {
        reject(new Error('Shape ID is required'))
        return
      }

      try {
        const shape = chart.getShapeById(shapeId)
        if (!shape) {
          reject(new Error(`Shape with ID ${shapeId} not found`))
          return
        }

        const ids = Object.keys(properties)
        if (ids.length === 0) {
          resolve(true)
          return
        }

        for (const id of ids) {
          const property = properties[id]
          if (property !== undefined && property !== null) {
            try {
              if ((shape as any)._source?._properties?.[id]) {
                ;(shape as any)._source._properties[id]._value = property
              } else if (typeof (shape as any).setProperties === 'function') {
                ;(shape as any).setProperties({ [id]: property })
              }
            } catch (error) {
              console.warn(`Error updating shape property ${id}:`, error)
            }
          }
        }

        if ((shape as any)._source?._properties?._listeners) {
          ;(shape as any)._source._properties._listeners.fire()
        }

        resolve(true)
      } catch (error) {
        reject(error)
      }
    })
  }

  async deleteShape(shapeId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const chart = this.getChart()
      if (!chart) {
        reject(new Error('Chart not available'))
        return
      }

      if (!shapeId) {
        reject(new Error('Shape ID is required'))
        return
      }

      try {
        chart.removeEntity(shapeId)
        this.shapeIds.delete(shapeId)
        resolve(true)
      } catch (error) {
        reject(error)
      }
    })
  }

  // Convenience update/delete methods
  async updateRectangle(shapeId: string, properties: Record<string, any> = {}): Promise<boolean> {
    return this.updateShape(shapeId, properties)
  }

  async deleteRectangle(shapeId: string): Promise<boolean> {
    return this.deleteShape(shapeId)
  }

  async updateCircle(shapeId: string, properties: Record<string, any> = {}): Promise<boolean> {
    return this.updateShape(shapeId, properties)
  }

  async deleteCircle(shapeId: string): Promise<boolean> {
    return this.deleteShape(shapeId)
  }

  async updateTriangle(shapeId: string, properties: Record<string, any> = {}): Promise<boolean> {
    return this.updateShape(shapeId, properties)
  }

  async deleteTriangle(shapeId: string): Promise<boolean> {
    return this.deleteShape(shapeId)
  }

  async updateTrendLine(shapeId: string, properties: Record<string, any> = {}): Promise<boolean> {
    return this.updateShape(shapeId, properties)
  }

  async deleteTrendLine(shapeId: string): Promise<boolean> {
    return this.deleteShape(shapeId)
  }

  async updateHorizontalLine(shapeId: string, properties: Record<string, any> = {}): Promise<boolean> {
    return this.updateShape(shapeId, properties)
  }

  async deleteHorizontalLine(shapeId: string): Promise<boolean> {
    return this.deleteShape(shapeId)
  }

  async updateVerticalLine(shapeId: string, properties: Record<string, any> = {}): Promise<boolean> {
    return this.updateShape(shapeId, properties)
  }

  async deleteVerticalLine(shapeId: string): Promise<boolean> {
    return this.deleteShape(shapeId)
  }

  async updateArrow(shapeId: string, properties: Record<string, any> = {}): Promise<boolean> {
    return this.updateShape(shapeId, properties)
  }

  async deleteArrow(shapeId: string): Promise<boolean> {
    return this.deleteShape(shapeId)
  }

  async updateText(shapeId: string, properties: Record<string, any> = {}): Promise<boolean> {
    return this.updateShape(shapeId, properties)
  }

  async deleteText(shapeId: string): Promise<boolean> {
    return this.deleteShape(shapeId)
  }

  getShapeById(shapeId: string): any {
    const chart = this.getChart()
    return chart ? chart.getShapeById(shapeId) : null
  }
}

