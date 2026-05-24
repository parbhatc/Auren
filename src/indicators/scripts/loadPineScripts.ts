import type { BaseIndicator } from '../base/BaseIndicator'
import { createIndicatorFromPineFile } from '../pine/createIndicatorFromPineFile'

const pineModules = import.meta.glob('./*.pine', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Load every `scripts/*.pine` and register as a custom indicator. */
export function loadPineScriptIndicators(): BaseIndicator[] {
  const indicators: BaseIndicator[] = []

  for (const [path, source] of Object.entries(pineModules)) {
    try {
      const IndicatorClass = createIndicatorFromPineFile(source, path)
      const instance = new IndicatorClass()
      indicators.push(instance)
      console.log('[indicators] registered pine script:', (instance as { name?: string }).name, path)
    } catch (err) {
      console.error(`[indicators] Failed to load ${path}:`, err)
    }
  }

  return indicators
}
