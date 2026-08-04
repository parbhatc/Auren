import type { ComponentType } from 'react'
import type { PropFirm } from '../../types/props'
import type { PropFirmConnectCallbacks } from '../types/common'
import { PRACTICE_PROP_FIRM_CONFIGS } from '../../constants/practicePropFirms'
import { TradeseaConnectPanel } from '../tradesea'
import { t } from '../../utils/translator'
import { SettingsStatusPill } from '../../components/settings/SettingsFormPrimitives'
import TradingViewConnectPanel from '../tradingview/TradingViewConnectPanel'

export type PropFirmSettingsPanelProps = PropFirmConnectCallbacks & {
  isDark: boolean
  propFirm?: PropFirm
}

type PanelEntry = {
  ConnectPanel: ComponentType<PropFirmSettingsPanelProps>
  descriptionKey: string
  canClear: (propFirm?: PropFirm) => boolean
}

const PANEL_BY_FIRM_ID: Record<string, PanelEntry> = {
  tradesea: {
    ConnectPanel: TradeseaConnectPanel,
    descriptionKey: 'props.tradesea.otpDescription',
    canClear: (firm) => Boolean(firm?.token),
  },
  tradingview: {
    ConnectPanel: TradingViewConnectPanel,
    descriptionKey: 'props.tradingview.description',
    canClear: (firm) => Boolean(firm?.tokenConfigured),
  },
}

export function getPropFirmSettingsPanel(firmId: string): PanelEntry | undefined {
  return PANEL_BY_FIRM_ID[firmId]
}

export function getPropFirmSettingsDescription(firmId: string): string {
  const entry = getPropFirmSettingsPanel(firmId)
  if (!entry) {
    const name =
      PRACTICE_PROP_FIRM_CONFIGS.find((c) => c.id === firmId)?.displayName ?? firmId
    return t('practice.hub.marketDataComingSoon', { firm: name })
  }
  return t(entry.descriptionKey)
}

export function canClearPropFirmSettings(firmId: string, propFirm?: PropFirm): boolean {
  return getPropFirmSettingsPanel(firmId)?.canClear(propFirm) ?? false
}
