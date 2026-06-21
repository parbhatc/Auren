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

export async function loadAurenChartBoot(): Promise<AurenChartBootModule> {
  const hooks = await getBwcHostHooks()
  return {
    registerAurenChartIndicators,
    bootChart,
    registerTradeContextActions: hooks.registerTradeContextActions,
    clearChartContextActions: hooks.clearChartContextActions,
  }
}
