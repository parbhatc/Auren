import { IndicatorManager } from './manager/IndicatorManager'
import { loadPineScriptIndicators } from './scripts/loadPineScripts'

/** Register every `.pine` script from `scripts/`. */
export function createIndicatorManager(): IndicatorManager {
  const manager = new IndicatorManager()
  manager.registerAll(loadPineScriptIndicators())
  return manager
}
