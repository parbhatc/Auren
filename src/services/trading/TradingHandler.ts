/**
 * Trading Handler
 * Handles trading-related operations and logging
 */
export class TradingHandler {
  /**
   * Log when a trading button is pressed
   */
  static logButtonPress(buttonName: string, data?: { quantity?: number; symbol?: string }) {
    const logData: any = { button: buttonName }
    if (data?.quantity) logData.quantity = data.quantity
    if (data?.symbol) logData.symbol = data.symbol
    
    console.log(`[Trading] ${buttonName} button pressed`, logData)
  }

  /**
   * Log when contract quantity changes
   */
  static logQuantityChange(oldValue: number, newValue: number, method: 'preset' | 'increment' | 'input' | 'decrement') {
    console.log(`[Trading] Quantity changed via ${method}:`, {
      oldValue,
      newValue,
      delta: method === 'increment' ? 1 : method === 'decrement' ? -1 : newValue - oldValue
    })
  }

  /**
   * Log when account is changed
   */
  static logAccountChange(oldAccount: string, newAccount: string) {
    console.log(`[Trading] Account changed:`, {
      from: oldAccount,
      to: newAccount
    })
  }

  /**
   * Log when symbol is changed
   */
  static logSymbolChange(oldSymbol: string, newSymbol: string) {
    console.log(`[Trading] Symbol changed:`, {
      from: oldSymbol,
      to: newSymbol
    })
  }
}

