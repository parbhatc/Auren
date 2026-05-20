/**
 * Market data provider registry for practice charts.
 */
import { PropFirmBase } from './PropFirmBase'
import { TradeseaPropFirm } from './TradeseaPropFirm'

export const propFirmRegistry: PropFirmBase[] = [new TradeseaPropFirm()]

/**
 * Get prop firm by ID
 */
export function getPropFirmById(id: string): PropFirmBase | undefined {
  return propFirmRegistry.find(firm => firm.id === id)
}

/**
 * Get all prop firm definitions
 */
export function getAllPropFirms() {
  return propFirmRegistry.map(firm => firm.getDefinition())
}

