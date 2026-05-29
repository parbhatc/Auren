import { propsAPI } from '../../../api/props.api'
import type { PropFirm, PropFirmCredentials } from '../../../types/props'

export async function savePropFirmCredentials(
  type: string,
  propFirm: PropFirm | undefined,
  credentials: PropFirmCredentials
): Promise<void> {
  if (propFirm) {
    await propsAPI.updatePropFirm(type, { credentials: { ...propFirm.credentials, ...credentials } })
  } else {
    await propsAPI.savePropFirm({ type: type as PropFirm['type'], credentials })
  }
}

export async function savePropFirmToken(
  type: string,
  accessToken: string,
  refreshToken: string | null
): Promise<void> {
  await propsAPI.updateToken(type, accessToken, refreshToken, null)
}
