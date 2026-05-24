import type { BaseIndicator } from '../base/BaseIndicator'
import { createIndicatorFromPineFile } from '../pine/createIndicatorFromPineFile'

import fvgSource from './FVGIndicator.pine?raw'
import swingSource from './SwingIndicator.pine?raw'

/** Explicit imports — Vite glob is compile-time; new `.pine` files need a dev restart or import here. */
const pineModules: Record<string, string> = {
  ...import.meta.glob('./*.pine', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  './FVGIndicator.pine': fvgSource,
  './SwingIndicator.pine': swingSource,
}

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

  console.log(`[indicators] ${indicators.length} pine script(s) registered`)
  return indicators
}
