import type { PropFirm } from '../../types/props'
import type { PropFirmConnectCallbacks } from './common'

export interface RithmicConnectPanelProps extends PropFirmConnectCallbacks {
  propFirm?: PropFirm
}

export type RithmicLoginCredentials = {
  username: string
  password?: string
  systemName?: string
  gatewayName?: string
  gatewayUri?: string | null
  loginPassed?: boolean
  uniqueUserId?: string
  fcmId?: string
  ibId?: string
  infraType?: number
  rpCode?: string
}
