import type { BwcWidget } from './bwcDatafeed'
import {
  bootChart,
  getBwcHostHooks,
  registerAurenChartIndicators,
} from '../../chart/aurenChartBoot'
import {
  registerTradeContextActions,
  clearChartContextActions,
} from '../../components/common/aurenTradeContextMenu'

export type AurenChartBootModule = {
  registerAurenChartIndicators: () => Promise<void>
  bootChart: (options?: Record<string, unknown>) => Promise<BwcWidget>
  registerTradeContextActions: typeof registerTradeContextActions
  clearChartContextActions: typeof clearChartContextActions
}

let bootModulePromise: Promise<AurenChartBootModule> | null = null

export function loadAurenChartBoot(): Promise<AurenChartBootModule> {
  if (!bootModulePromise) {
    bootModulePromise = Promise.all([
      getBwcHostHooks(),
      registerAurenChartIndicators(),
    ]).then(([hooks]) => ({
      registerAurenChartIndicators,
      bootChart,
      registerTradeContextActions: hooks.registerTradeContextActions,
      clearChartContextActions: hooks.clearChartContextActions,
    })).catch((error) => {
      bootModulePromise = null
      throw error
    })
  }
  return bootModulePromise
}
