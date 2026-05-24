import { IndicatorManager } from './manager/IndicatorManager'
import { loadPineScriptIndicators } from './scripts/loadPineScripts'
import { SwingIndicator } from './swing'

/** Register `.pine` scripts from `scripts/` plus built-in class indicators. */
export function createIndicatorManager(): IndicatorManager {
  const manager = new IndicatorManager()
  manager.registerAll([...loadPineScriptIndicators(), new SwingIndicator()])
  return manager
}
