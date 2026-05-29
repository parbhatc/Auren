import type { TradingMode } from '../../types/tradingMode'
import type {
  PracticeMarketDataSlotPolicy,
  PracticePropFirmMarketDataConfig,
} from '../../constants/practicePropFirms'

export type { TradingMode, PropFirmId, TradeRouteContext } from '../../types/tradingMode'

/** Per-mode capabilities for a prop firm plugin. */
export interface PropFirmModeCapabilities {
  practice: {
    enabled: boolean
    marketData?: PracticePropFirmMarketDataConfig
  }
  live: {
    enabled: boolean
  }
  backtest: {
    enabled: boolean
  }
}

export interface PropFirmDefinition {
  id: string
  displayName: string
  modes: PropFirmModeCapabilities
}

export type PropFirmMarketDataSlotPolicy = PracticeMarketDataSlotPolicy

export function firmSupportsMode(definition: PropFirmDefinition, mode: TradingMode): boolean {
  if (mode === 'practice') return definition.modes.practice.enabled
  if (mode === 'live') return definition.modes.live.enabled
  return definition.modes.backtest.enabled
}
