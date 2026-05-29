/**
 * Runtime prop firm adapters (chart, MDS, trade handlers).
 */
import { PropFirmBase } from './PropFirmBase'
import { TradeseaPropFirm } from './tradesea'

export const propFirmRegistry: PropFirmBase[] = [new TradeseaPropFirm()]

export function getPropFirmById(id: string): PropFirmBase | undefined {
  return propFirmRegistry.find((firm) => firm.id === id)
}

export function getAllPropFirms() {
  return propFirmRegistry.map((firm) => firm.getDefinition())
}

export type { PropFirmBase } from './PropFirmBase'
export { TradeseaPropFirm } from './tradesea'
