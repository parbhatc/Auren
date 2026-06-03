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

/** Rithmic hub: credentials + order-plant account selected (like Tradesea account picker). */
export function resolveRithmicMarketConnection(
  ctx: MarketDataConnectionContext
): MarketDataConnectionState {
  const credentials = ctx.firmCredentials
  const credsOk = Boolean(credentials?.loginPassed === true && credentials?.username?.trim())
  if (!credsOk) {
    return { connected: false }
  }

  const accountId = String(ctx.marketAccountId || '').trim()
  const fromList = ctx.brokerAccounts?.find((a) => a.id === accountId)?.label

  const connected =
    Boolean(accountId) &&
    !ctx.brokerSessionExpired &&
    (ctx.brokerAccounts?.length ?? 0) > 0 &&
    Boolean(fromList || accountId)

  return {
    connected,
    statusLabel: connected ? fromList || accountId : credentialLoginStatusLabel(credentials),
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

/** Practice trade / chart: saved Rithmic credentials + hub account selection. */
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

  if (!credentials?.loginPassed || !credentials.username?.trim()) {
    return {
      ok: false,
      message: t('practice.notConnected'),
    }
  }

  const md = getPracticeMarketDataSettings()
  const accountId = md.accountId?.trim()
  if (!accountId) {
    return {
      ok: false,
      message: t('practice.selectAccount'),
    }
  }

  const label =
    md.accountLabel?.trim() ||
    credentialLoginStatusLabel(credentials) ||
    accountId

  return { ok: true, accountId, label }
}
