import type { RithmicLoginResponse } from '../../api/rithmic.api'
import type { PropFirmCredentials } from '../../types/props'

type RithmicCredentialBase = {
  username: string
  password?: string
  systemName?: string
  gatewayName?: string
  gatewayUri?: string | null
}

/** Map a successful Rithmic login response into stored prop-firm credentials. */
export function buildRithmicCredentialsFromLogin(
  login: RithmicLoginResponse,
  base: RithmicCredentialBase
): PropFirmCredentials {
  const credentials: PropFirmCredentials = {
    username: base.username,
    systemName: login.system_name?.trim() || base.systemName?.trim() || '',
    gatewayName: login.gateway_name?.trim() || base.gatewayName?.trim() || '',
    gatewayUri: (login.gateway_uri?.trim() || base.gatewayUri) ?? null,
    loginPassed: true,
    uniqueUserId: login.unique_user_id ?? undefined,
    fcmId: login.fcm_id ?? undefined,
    ibId: login.ib_id ?? undefined,
    infraType: login.infra_type ?? undefined,
    rpCode: login.rp_code ?? undefined,
  }

  if (base.password) {
    credentials.password = base.password
  }

  return credentials
}
