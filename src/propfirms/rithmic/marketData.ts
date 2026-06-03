import type { PropFirmCredentials, PropsSettingsResponse } from '../../types/props'
import type { MarketDataConnectionContext, MarketDataConnectionState } from '../marketData/types'

export async function testCredentialLoginMarketConnection(
  _firmId: string,
  credentials: { username: string; password: string }
): Promise<PropsSettingsResponse> {
  const { t } = await import('../../utils/translator')
  const { rithmicAPI } = await import('../../api/rithmic.api')
  if (!credentials.username?.trim() || !credentials.password?.trim()) {
    return {
      success: false,
      message: t('props.missingCredentials'),
    }
  }
  try {
    const login = await rithmicAPI.login({
      username: credentials.username.trim(),
      password: credentials.password.trim(),
      system: 'Rithmic Paper Trading',
    })
    if (!login.passed) {
      const { formatRithmicLoginMessage } = await import('./formatLoginMessage')
      const detail = formatRithmicLoginMessage(login.message) || t('props.connectionFailed')
      return {
        success: false,
        message: detail,
      }
    }
    return {
      success: true,
      message: t('props.connectionSuccessful'),
    }
  } catch (error: unknown) {
    const { handleApiError } = await import('../../utils/errorHandler')
    return {
      success: false,
      message: handleApiError(error),
    }
  }
}

export function resolveCredentialLoginMarketConnection(
  ctx: MarketDataConnectionContext
): MarketDataConnectionState {
  const credentials = ctx.firmCredentials
  const connected = Boolean(credentials?.loginPassed === true && credentials?.username?.trim())

  return {
    connected,
    statusLabel: connected ? credentialLoginStatusLabel(credentials) : undefined,
  }
}

export function credentialLoginStatusLabel(credentials?: PropFirmCredentials | null): string {
  if (!credentials?.username?.trim()) return ''
  const parts = [credentials.systemName, credentials.gatewayName].filter(Boolean) as string[]
  if (parts.length) return parts.join(' · ')
  return credentials.username.trim()
}

export type RithmicPracticeMarketDataReady =
  | { ok: true; accountId: string; label: string }
  | { ok: false; message: string }

/** Practice trade / chart: credentials only — no order-plant /accounts call. */
export async function ensureRithmicPracticeMarketDataReady(): Promise<RithmicPracticeMarketDataReady> {
  const { t } = await import('../../utils/translator')
  const { propsAPI } = await import('../../api/props.api')
  const { getPracticeMarketDataSettings } = await import('../../constants/practice')

  let credentials: PropFirmCredentials | null = null
  try {
    const response = await propsAPI.getPropFirm('rithmic')
    credentials = response.propFirm?.credentials ?? null
  } catch {
    credentials = null
  }

  const state = resolveCredentialLoginMarketConnection({
    firmId: 'rithmic',
    firmCredentials: credentials,
  })

  if (!state.connected) {
    return {
      ok: false,
      message: t('practice.notConnected'),
    }
  }

  const md = getPracticeMarketDataSettings()
  const accountId =
    md.accountId?.trim() ||
    credentials?.username?.trim() ||
    'rithmic'
  const label =
    md.accountLabel?.trim() ||
    credentialLoginStatusLabel(credentials) ||
    accountId

  return { ok: true, accountId, label }
}
