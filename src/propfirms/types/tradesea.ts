import type { PropFirm } from '../../types/props'
import type { PropFirmConnectCallbacks } from './common'

export interface TradeseaConnectPanelProps extends PropFirmConnectCallbacks {
  propFirm?: PropFirm
}

export type TradeseaOtpCredentials = {
  email: string
  deviceId?: string
  firstName?: string | null
}
