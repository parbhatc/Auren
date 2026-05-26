/**
 * Indicator Manager - Manages registration and lifecycle of custom indicators
 */
import { BaseIndicator } from '../base/BaseIndicator'
import type { TradingViewWidget, PineJS } from '../types'
export class IndicatorManager {
  private indicators: BaseIndicator[] = []
  public widget: TradingViewWidget | null = null
  private studies: any[] = []
  /** TV study instance id → registered indicator template (FVG / Swing). */
  private studyById = new Map<string, BaseIndicator>()
  /** Last known visibility per study id (to avoid false onShown/onHidden on settings edits). */
  private studyVisibilityById = new Map<string, boolean>()

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

  private getActiveChart(): ReturnType<TradingViewWidget['chart']> | null {
    if (!this.widget) return null
    try {
      return (this.widget as { activeChart?: () => ReturnType<TradingViewWidget['chart']> }).activeChart?.() ?? this.widget.chart?.() ?? null
    } catch {
      return null
    }
  }

  private isCustomAurenStudy(studyName: string): boolean {
    const n = studyName.trim()
    return this.indicators.some(
      (ind) =>
        n === ind.displayName ||
        n === ind.name ||
        n === ind.description ||
        n.includes(ind.displayName) ||
        n.includes(ind.name)
    )
  }

  /** Log every study on the active chart pane (built-in TV + custom Auren). */
  logActiveChartStudies(reason = 'snapshot'): void {
    const chart = this.getActiveChart()
    if (!chart?.getAllStudies) {
      console.warn('[chart] no chart — cannot list studies')
      return
    }

    let studies: Array<{ id: string; name: string }> = []
    try {
      studies = chart.getAllStudies()
      this.studies = studies
    } catch (err) {
      console.warn('[chart] getAllStudies failed', err)
      return
    }

    const onChart = studies.map((s, index) => ({
      '#': index + 1,
      name: s.name,
      id: s.id,
      source: this.isCustomAurenStudy(s.name) ? 'Auren (custom pine)' : 'TradingView',
    }))

    console.group(`[chart] active studies (${studies.length}) — ${reason}`)
    if (onChart.length === 0) {
      console.log('(none on chart)')
    } else {
      console.table(onChart)
    }
    console.groupEnd()
  }

  onReady(): void {
    if (!this.widget) return

    const chart = this.getActiveChart()
    if (!chart) {
      console.warn('[IndicatorManager] Chart not available yet, widget may not be fully initialized')
      return
    }
    
    try {
      this.studies = chart.getAllStudies()
      this.studyVisibilityById.clear()
      for (const s of this.studies as Array<{ id: string }>) {
        try {
          const visible = chart.getStudyById(s.id)?.isVisible?.()
          if (typeof visible === 'boolean') this.studyVisibilityById.set(s.id, visible)
        } catch {
          /* ignore visibility bootstrap errors */
        }
      }
    } catch (error) {
      console.warn('[IndicatorManager] Error getting studies:', error)
      return
    }

    this.logActiveChartStudies('chart ready')

    if (typeof window !== 'undefined') {
      ;(window as Window & { logChartStudies?: () => void }).logChartStudies = () =>
        this.logActiveChartStudies('manual')
    }

    this.widget.subscribe('study_properties_changed', (studyId: string) => {
      const indicator = this.getIndicatorByStudyId(studyId)

      if (indicator) {
        try {
          const study = chart.getStudyById(studyId)
          const isVisible = study.isVisible()
          const prevVisible = this.studyVisibilityById.get(studyId)
          this.studyVisibilityById.set(studyId, isVisible)
          if (prevVisible === undefined || prevVisible === isVisible) return
          if (!isVisible) indicator.onHidden()
          else indicator.onShown()
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
          case 'create': {
            this.studies = currentChart.getAllStudies()
            const created = this.studies.find((s: { id: string; name: string }) => s.id === studyId)
            const addedName = created?.name ?? studyId
            const indicator = this.getIndicatorByName(addedName)
            try {
              const visible = currentChart.getStudyById(studyId)?.isVisible?.()
              if (typeof visible === 'boolean') this.studyVisibilityById.set(studyId, visible)
            } catch {
              /* ignore */
            }
            if (indicator) {
              indicator.setStudyId(studyId)
              this.studyById.set(studyId, indicator)
            }
            this.logActiveChartStudies(`added: ${addedName}`)
            break
          }
          case 'remove': {
            const removedStudy = this.studies.find(
              (s: { id: string; name: string }) => s.id === studyId
            )
            const indicator =
              this.studyById.get(studyId) ?? this.getIndicatorByStudyId(studyId)
            const removedName =
              removedStudy?.name ?? indicator?.displayName ?? indicator?.name ?? studyId
            this.studyById.delete(studyId)
            this.studyVisibilityById.delete(studyId)
            if (indicator) {
              indicator.onRemove()
            }
            this.studies = currentChart.getAllStudies()
            this.logActiveChartStudies(`removed: ${removedName}`)
            break
          }
        }
      } catch (error) {
        console.warn('[IndicatorManager] Error handling study event:', error)
      }
    })
  }

  getIndicatorByName(name: string): BaseIndicator | undefined {
    return this.indicators.find(
      (ind) =>
        ind.displayName === name ||
        ind.name === name ||
        ind.description === name
    )
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

