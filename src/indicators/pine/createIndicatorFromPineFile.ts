import type { BaseIndicator } from '../base/BaseIndicator'
import { PineJSIndicator } from './PineJSIndicator'

/** Build a Charting Library indicator class from a `.pine` file. */
export function createIndicatorFromPineFile(
  source: string,
  filePath: string
): new () => BaseIndicator {
  return class extends PineJSIndicator {
    constructor() {
      super(source, filePath)
    }
  }
}
