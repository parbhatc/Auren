/**
 * Base class for Prop Firms
 */
import { ReactElement } from 'react'

export abstract class PropFirmBase {
  abstract readonly id: string
  abstract readonly displayName: string
  // Username and password are always required fields

  /**
   * Validate prop-firm readiness (credentials/session/etc).
   * Returns validation result indicating if prop firm is properly configured.
   * @returns Promise<{success: boolean, type?: string}> - Validation result
   */
  async validate(): Promise<{success: boolean, type?: string}> {
    return { success: false, type: "not_implemented" }
  }

  /**
   * Get the prop firm definition
   */
  getDefinition() {
    return {
      id: this.id,
      displayName: this.displayName
    }
  }

  /**
   * Called after successful validation
   * Override this method in subclasses to perform actions after validation succeeds
   */
  async onValidateSuccess(): Promise<void> {
    console.log('onValidateSuccess not implemented for', this.displayName)
    // Default implementation does nothing
  }

  /**
   * Get the chart component to render for this prop firm
   * @param symbol - Trading symbol to display
   * @param timeframe - Chart timeframe/interval
   * @param isDark - Whether to use dark theme
   * @returns React element representing the chart
   */
  getRenderChart(_symbol: string, _timeframe: string, _isDark: boolean): ReactElement | null {
    // Default implementation returns null
    // Override in subclasses to provide chart rendering
    return null
  }

  /**
   * Get statistics data for the stats page
   * @param dateRange - Optional date range for filtering trades
   * @param skipProfitFactorAPI - Optional flag to skip profit factor API call (e.g., for calendar view)
   * @returns Promise with stats data including trades, equity curve, etc.
   */
  async getStats(_dateRange?: { startDate: string; endDate: string }, _skipProfitFactorAPI?: boolean): Promise<{
    trades: any[]
    equityCurveData: Array<{ date: string; value: number }>
    stats: any
    calculateTradePnL: (trade: any) => number
    parseTradeTimestamp: (timestamp: any) => Date | null
    formatDuration: (seconds: number) => string
    initialBalance?: number
    symbolData?: Record<string, { 
      tickSize: number
      tickValue: number
      description?: string
      exchangeFee?: number
      regulatoryFee?: number
      commissionFee?: number
      totalFees?: number
    }>
    durationAnalysisData?: Array<{ label: string; rate?: number; count?: number }>
    winRateAnalysisData?: Array<{ label: string; rate: number }>
    tradeseaCalendarDays?: unknown
    tradeseaDashboard?: unknown
    practiceAccount?: unknown
    practiceRulesStatus?: unknown
  } | null> {
    // Default implementation returns null
    // Override in subclasses to provide stats
    console.log('getStats not implemented for', this.displayName)
    return null
  }

  /**
   * Get the trade handler instance for this prop firm
   * Override in subclasses to return the appropriate trade handler
   * @returns The trade handler instance, or null if not implemented
   */
  getHandler(): any {
    // Default implementation returns null
    // Override in subclasses to provide trade handler
    console.log('getHandler not implemented for', this.displayName)
    return null
  }
}

