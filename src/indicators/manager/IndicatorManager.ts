/**
 * Indicator Manager - Manages registration and lifecycle of custom indicators
 */
import { BaseIndicator } from '../base/BaseIndicator'
import type { TradingViewWidget, PineJS } from '../types'

export class IndicatorManager {
  private indicators: BaseIndicator[] = []
  public widget: TradingViewWidget | null = null
  private studies: any[] = []

  /**
   * Set the TradingView widget reference
   */
  setWidget(widget: TradingViewWidget): void {
    this.widget = widget
    this.indicators.forEach(indicator => {
      if ((indicator as any)._shapesAPI) {
        ;(indicator as any)._shapesAPI.setWidget(widget)
      }
    })
  }

  /**
   * Register an indicator instance
   */
  register(indicator: BaseIndicator): void {
    if (!(indicator instanceof BaseIndicator)) {
      console.error('Indicator must extend BaseIndicator class')
      return
    }
    indicator.setIndicatorManager(this)
    this.indicators.push(indicator)
  }

  /**
   * Register multiple indicators at once
   */
  registerAll(indicators: BaseIndicator[]): void {
    indicators.forEach(indicator => this.register(indicator))
  }

  /**
   * Get all registered indicators in TradingView format
   * This method is called by TradingView with PineJS as parameter
   */
  getter(PineJS: PineJS): Promise<any[]> {
    const tradingViewIndicators = this.indicators.map(indicator => 
      indicator.toTradingViewFormat(PineJS)
    )
    
    return Promise.resolve(tradingViewIndicators)
  }

  /**
   * Get a function that can be used as custom_indicators_getter callback
   * Usage: widgetConfig={{ custom_indicators_getter: manager.getCustomIndicatorsGetter() }}
   */
  getCustomIndicatorsGetter(): (PineJS: PineJS) => Promise<any[]> {
    return (PineJS: PineJS) => this.getter(PineJS)
  }

  onReady(): void {
    if (!this.widget) return

    // Safely get chart - try activeChart first, then chart()
    const chart = (this.widget as any).activeChart?.() || this.widget.chart?.()
    if (!chart) {
      console.warn('[IndicatorManager] Chart not available yet, widget may not be fully initialized')
      return
    }
    
    try {
      this.studies = chart.getAllStudies()
    } catch (error) {
      console.warn('[IndicatorManager] Error getting studies:', error)
      return
    }

    this.widget.subscribe('study_properties_changed', (studyId: string) => {
      const indicator = this.getIndicatorByStudyId(studyId)

      if (indicator) {
        try {
          const study = chart.getStudyById(studyId)
          const isVisible = study.isVisible()

          if (!isVisible) {
            indicator.onHidden()
          } else {
            indicator.onShown()
          }
        } catch (error) {
          console.warn('[IndicatorManager] Error handling study properties changed:', error)
        }
      }
    })
    
    this.widget.subscribe('study_event', (studyId: string, action: string) => {
      if (!this.widget) return
      
      try {
        const currentChart = (this.widget as any).activeChart?.() || this.widget.chart?.()
        if (!currentChart) return
        
        switch (action) {
          case 'create':
            this.studies = currentChart.getAllStudies()
            break
          case 'remove':
            const indicator = this.getIndicatorByStudyId(studyId)
            this.studies = currentChart.getAllStudies()
            if (indicator) {
              indicator.onRemove()
            }
            break
        }
      } catch (error) {
        console.warn('[IndicatorManager] Error handling study event:', error)
      }
    })
  }

  getIndicatorByName(name: string): BaseIndicator | undefined {
    return this.indicators.find(ind => ind.displayName === name || ind.name === name)
  }

  getIndicatorByStudyId(studyId: string): BaseIndicator | null {
    const study = this.studies.find((s: any) => s.id === studyId)
    if (!study) {
      return null
    }
    return this.getIndicatorByName(study.name) || null
  }

  /**
   * Reset all registered indicators
   * Called when new data is loaded (e.g., symbol change, timeframe change)
   */
  reset(): void {
    this.indicators.forEach(indicator => {
      try {
        indicator.reset()
      } catch (error) {
        console.error(`Error resetting indicator ${indicator.displayName}:`, error)
      }
    })
  }
}

