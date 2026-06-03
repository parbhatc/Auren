import { useEffect, useMemo, useRef, useState } from 'react'
import { rithmicAPI, type RithmicGateway } from '../../../api/rithmic.api'
import { t } from '../../../utils/translator'
import { fieldLabelClass, selectInputClass } from '../../../styles/aurenTheme'
import type { RithmicConnectPanelProps } from '../../types/rithmic'
import BasePropFirm from '../../connect/BasePropFirm'
import BaseLoginFirm from '../../connect/BaseLoginFirm'
import { savePropFirmCredentials } from '../../connect/utils/savePropFirmCredentials'
import { buildRithmicCredentialsFromLogin } from '../buildCredentialsFromLogin'

const PAPER_TRADING = 'Rithmic Paper Trading'
const DEFAULT_GATEWAY = 'Chicago Area'

function sortRithmicSystemNames(names: string[]): string[] {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  const rest = unique.filter((n) => n !== PAPER_TRADING).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return unique.includes(PAPER_TRADING) ? [PAPER_TRADING, ...rest] : rest
}

function sortGateways(gateways: RithmicGateway[]): RithmicGateway[] {
  const unique = new Map<string, RithmicGateway>()
  for (const g of gateways) {
    const name = g.name?.trim()
    if (name) unique.set(name, { name, uri: g.uri ?? null })
  }
  const rest = [...unique.values()]
    .filter((g) => g.name !== DEFAULT_GATEWAY)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  if (unique.has(DEFAULT_GATEWAY)) {
    return [{ name: DEFAULT_GATEWAY, uri: unique.get(DEFAULT_GATEWAY)!.uri }, ...rest]
  }
  return rest
}

function pickDefaultGateway(
  gateways: RithmicGateway[],
  savedGatewayName: string | undefined,
  savedSystemName: string | undefined,
  currentSystemName: string
): string {
  const names = gateways.map((g) => g.name)
  const saved =
    savedSystemName === currentSystemName ? savedGatewayName?.trim() : undefined
  if (saved && names.includes(saved)) return saved
  if (names.includes(DEFAULT_GATEWAY)) return DEFAULT_GATEWAY
  return gateways[0]?.name ?? ''
}

export default function RithmicConnectPanel({
  isDark,
  propFirm,
  onRefresh,
  onSuccess,
  onError,
}: RithmicConnectPanelProps) {
  const [username, setUsername] = useState(propFirm?.credentials?.username || '')
  const [password, setPassword] = useState(propFirm?.credentials?.password || '')
  const [systemName, setSystemName] = useState(
    propFirm?.credentials?.systemName?.trim() || PAPER_TRADING
  )
  const [gatewayName, setGatewayName] = useState(
    propFirm?.credentials?.gatewayName?.trim() || DEFAULT_GATEWAY
  )
  const [systems, setSystems] = useState<string[]>([])
  const [gateways, setGateways] = useState<RithmicGateway[]>([])
  const [loadingSystems, setLoadingSystems] = useState(true)
  const [loadingGateways, setLoadingGateways] = useState(false)
  const [systemsError, setSystemsError] = useState('')
  const [gatewaysError, setGatewaysError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loginStatus, setLoginStatus] = useState<'idle' | 'checking' | 'passed' | 'failed'>(
    propFirm?.credentials?.loginPassed === true ? 'passed' : propFirm?.credentials?.loginPassed === false ? 'failed' : 'idle'
  )
  const [loginMessage, setLoginMessage] = useState('')
  const gatewayBySystemRef = useRef(new Map<string, RithmicGateway[]>())
  const gatewaySelectionBySystemRef = useRef(new Map<string, string>())

  useEffect(() => {
    setUsername(propFirm?.credentials?.username || '')
    setPassword(propFirm?.credentials?.password || '')
    setSystemName(propFirm?.credentials?.systemName?.trim() || PAPER_TRADING)
    setGatewayName(propFirm?.credentials?.gatewayName?.trim() || DEFAULT_GATEWAY)
  }, [propFirm])

  useEffect(() => {
    const saved = propFirm?.credentials
    const savedUser = saved?.username?.trim() || ''
    const savedSystem = saved?.systemName?.trim() || PAPER_TRADING
    const savedGateway = saved?.gatewayName?.trim() || DEFAULT_GATEWAY
    const savedPassword = saved?.password || ''
    const matchesSavedLogin =
      saved?.loginPassed === true &&
      username.trim() === savedUser &&
      systemName.trim() === savedSystem &&
      gatewayName.trim() === savedGateway &&
      password === savedPassword

    if (matchesSavedLogin) {
      setLoginStatus('passed')
      setLoginMessage(t('props.rithmic.loginPassed'))
      return
    }

    if (saved?.loginPassed === false) {
      setLoginStatus('failed')
      setLoginMessage('')
      return
    }

    setLoginStatus('idle')
    setLoginMessage('')
  }, [username, password, systemName, gatewayName, propFirm?.credentials])

  useEffect(() => {
    let cancelled = false

    const loadSystems = async () => {
      setLoadingSystems(true)
      setSystemsError('')
      try {
        const result = await rithmicAPI.getDiscoverySystems()
        if (!result.success || !result.system_name?.length) {
          throw new Error(result.message || t('props.rithmic.systemsLoadFailed'))
        }
        const sorted = sortRithmicSystemNames(result.system_name)
        if (cancelled) return
        setSystems(sorted)
        setSystemName((prev) => {
          if (prev && sorted.includes(prev)) return prev
          if (sorted.includes(PAPER_TRADING)) return PAPER_TRADING
          return sorted[0] ?? PAPER_TRADING
        })
      } catch (err: unknown) {
        if (cancelled) return
        setSystems([])
        setSystemsError(err instanceof Error ? err.message : t('props.rithmic.systemsLoadFailed'))
      } finally {
        if (!cancelled) setLoadingSystems(false)
      }
    }

    void loadSystems()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const trimmedSystem = systemName.trim()
    if (!trimmedSystem || loadingSystems) return

    let cancelled = false

    const applyGatewaysForSystem = (sorted: RithmicGateway[]) => {
      const remembered = gatewaySelectionBySystemRef.current.get(trimmedSystem)
      const saved =
        propFirm?.credentials?.systemName === trimmedSystem
          ? propFirm?.credentials?.gatewayName?.trim()
          : undefined
      const preferred = remembered || saved
      const names = sorted.map((g) => g.name)
      const nextGateway =
        preferred && names.includes(preferred)
          ? preferred
          : pickDefaultGateway(
              sorted,
              propFirm?.credentials?.gatewayName,
              propFirm?.credentials?.systemName,
              trimmedSystem
            )
      setGateways(sorted)
      setGatewayName(nextGateway)
      gatewaySelectionBySystemRef.current.set(trimmedSystem, nextGateway)
    }

    const cached = gatewayBySystemRef.current.get(trimmedSystem)
    if (cached?.length) {
      setGatewaysError('')
      applyGatewaysForSystem(cached)
      return
    }

    const loadGateways = async () => {
      setLoadingGateways(true)
      setGatewaysError('')
      try {
        const result = await rithmicAPI.getDiscoveryGateways(trimmedSystem)
        if (!result.success || !result.gateways?.length) {
          throw new Error(result.message || t('props.rithmic.gatewaysLoadFailed'))
        }
        const sorted = sortGateways(result.gateways)
        gatewayBySystemRef.current.set(trimmedSystem, sorted)
        if (cancelled) return
        applyGatewaysForSystem(sorted)
      } catch (err: unknown) {
        if (cancelled) return
        setGateways([])
        setGatewaysError(err instanceof Error ? err.message : t('props.rithmic.gatewaysLoadFailed'))
      } finally {
        if (!cancelled) setLoadingGateways(false)
      }
    }

    void loadGateways()
    return () => {
      cancelled = true
    }
  }, [systemName, loadingSystems, propFirm?.credentials?.gatewayName, propFirm?.credentials?.systemName])

  const systemOptions = useMemo(() => {
    if (!systemName || systems.includes(systemName)) return systems
    return [systemName, ...systems]
  }, [systemName, systems])

  const gatewayOptions = useMemo(() => {
    if (!gatewayName || gateways.some((g) => g.name === gatewayName)) return gateways
    return [{ name: gatewayName, uri: null }, ...gateways]
  }, [gatewayName, gateways])

  const selectedGatewayUri =
    gatewayOptions.find((g) => g.name === gatewayName)?.uri ?? propFirm?.credentials?.gatewayUri ?? null

  const configured = Boolean(propFirm?.credentials?.username?.trim())

  const handleSave = async () => {
    const trimmedUser = username.trim()
    const trimmedSystem = systemName.trim()
    const trimmedGateway = gatewayName.trim()

    if (!trimmedUser) {
      onError(t('props.usernameRequired'))
      return
    }
    if (!trimmedSystem) {
      onError(t('props.rithmic.systemRequired'))
      return
    }
    if (!trimmedGateway) {
      onError(t('props.rithmic.gatewayRequired'))
      return
    }
    if (!password.trim() && !configured) {
      onError(t('props.passwordRequired'))
      return
    }

    const loginPassword = password.trim() || propFirm?.credentials?.password || ''
    if (!loginPassword) {
      onError(t('props.passwordRequired'))
      return
    }

    setSaving(true)
    setLoginStatus('checking')
    setLoginMessage(t('props.rithmic.loginChecking'))
    onError('')
    try {
      const loginResult = await rithmicAPI.login({
        username: trimmedUser,
        password: loginPassword,
        system: trimmedSystem,
        gateway: trimmedGateway,
        gatewayUri: selectedGatewayUri,
      })

      if (!loginResult.passed) {
        setLoginStatus('failed')
        const { formatRithmicLoginMessage } = await import('../formatLoginMessage')
        const msg =
          formatRithmicLoginMessage(loginResult.message) || t('props.connectionFailed')
        setLoginMessage(msg)
        onError(msg)
        return
      }

      setLoginStatus('passed')
      setLoginMessage(t('props.rithmic.loginPassed'))

      const credentials = buildRithmicCredentialsFromLogin(loginResult, {
        username: trimmedUser,
        password: loginPassword || undefined,
        systemName: trimmedSystem,
        gatewayName: trimmedGateway,
        gatewayUri: selectedGatewayUri,
      })

      await savePropFirmCredentials('rithmic', propFirm, credentials)
      if (credentials.password) {
        setPassword(credentials.password)
      }
      onRefresh()
      onSuccess(t('props.rithmic.saved'))
    } catch (err: unknown) {
      setLoginStatus('failed')
      const { handleApiError } = await import('../../../utils/errorHandler')
      const { formatRithmicLoginMessage } = await import('../formatLoginMessage')
      const msg =
        formatRithmicLoginMessage(handleApiError(err)) || t('props.connectionFailed')
      setLoginMessage(msg)
      onError(msg)
    } finally {
      setSaving(false)
    }
  }

  const connectedAs = configured
    ? t('props.rithmic.connectedAs', { username: propFirm?.credentials?.username || username })
    : null

  const selectClass = selectInputClass(isDark)
  const hintClass = isDark ? 'text-slate-500' : 'text-slate-500'

  return (
    <BasePropFirm isDark={isDark} connectedAs={connectedAs}>
      <div className="mb-4">
        <label className={fieldLabelClass(isDark)} htmlFor="rithmic-system">
          {t('props.rithmic.systemLabel')}
        </label>
        {loadingSystems ? (
          <p className={`mt-1.5 text-sm ${hintClass}`}>{t('props.rithmic.systemsLoading')}</p>
        ) : systemsError ? (
          <p className={`mt-1.5 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{systemsError}</p>
        ) : (
          <select
            id="rithmic-system"
            value={systemName}
            onChange={(e) => setSystemName(e.target.value)}
            disabled={saving || systemOptions.length === 0}
            className={`${selectClass} mt-1.5`}
          >
            {systemOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-4">
        <label className={fieldLabelClass(isDark)} htmlFor="rithmic-gateway">
          {t('props.rithmic.gatewayLabel')}
        </label>
        {loadingGateways ? (
          <p className={`mt-1.5 text-sm ${hintClass}`}>{t('props.rithmic.gatewaysLoading')}</p>
        ) : gatewaysError ? (
          <p className={`mt-1.5 text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{gatewaysError}</p>
        ) : (
          <select
            id="rithmic-gateway"
            value={gatewayName}
            onChange={(e) => {
              const next = e.target.value
              setGatewayName(next)
              gatewaySelectionBySystemRef.current.set(systemName.trim(), next)
            }}
            disabled={saving || loadingSystems || gatewayOptions.length === 0}
            className={`${selectClass} mt-1.5`}
          >
            {gatewayOptions.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loginStatus !== 'idle' ? (
        <p
          className={`mb-4 text-sm font-medium ${
            loginStatus === 'passed'
              ? isDark
                ? 'text-emerald-400'
                : 'text-emerald-600'
              : loginStatus === 'failed'
                ? isDark
                  ? 'text-red-400'
                  : 'text-red-600'
                : hintClass
          }`}
          role="status"
        >
          {loginStatus === 'checking'
            ? loginMessage
            : loginStatus === 'passed'
              ? t('props.rithmic.loginStatusPassed')
              : t('props.rithmic.loginStatusFailed')}
          {loginStatus === 'failed' && loginMessage ? ` — ${loginMessage}` : null}
        </p>
      ) : null}

      <BaseLoginFirm
        isDark={isDark}
        idPrefix="rithmic"
        username={username}
        password={password}
        saving={saving}
        configured={configured}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onSave={() => void handleSave()}
        usernamePlaceholder={t('props.rithmic.usernamePlaceholder')}
        passwordPlaceholder={t('props.rithmic.passwordPlaceholder')}
      />
    </BasePropFirm>
  )
}
