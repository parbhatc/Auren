import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Sparkles } from 'lucide-react'
import { ROUTES, practiceTradeStatsPath } from '../../../constants/routes'
import {
  createPracticeAccount,
  deletePracticeAccount,
  getPracticeAccountDisplayTitle,
  getPracticeAccounts,
  getPracticeMarketDataSettings,
  getPracticePropFirmConfig,
  resolveOfflineModePositions,
  refreshPracticeFromApi,
  resetAllPracticeAccounts,
  resetPracticeAccount,
  applyActiveFirmToMarketDataSettings,
  savePracticeMarketDataSettings,
  updateFirmMarketDataSelection,
  type PracticeAccount,
  type PracticeAccountMode,
  type PracticeAccountRules,
} from '../../../constants/practice'
import { getDefaultPracticeRules, type PracticeAccountSize } from '../../../services/practice/practicePlans'
import { practiceAPI } from '../../../api/practice.api'
import { rithmicAPI } from '../../../api/rithmic.api'
import { tradeseaAPI } from '../../../api/tradesea.api'
import type { BrokerAccountOption } from '../../../propfirms/marketData/types'
import type { PropFirmCredentials } from '../../../types/props'
import {
  firmPersistsMarketAccountId,
  getCredentialsForFirm,
  getDefaultPropFirmId,
  loadCredentialLoginCredentials,
  resolveMarketDataConnection,
} from '../../../propfirms'
import { t } from '../../../utils/translator'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import { useTheme } from '../../../hooks/useTheme'
import { appPageBackground } from '../../../styles/aurenTheme'
import { CenteredPanel } from '../../ui/PanelCard'
import HubNav, { type HubTab } from './hub/HubNav'
import HubStatsBar from './hub/HubStatsBar'
import HubSettingsPanel from './hub/HubSettingsPanel'
import MarketDataSection from './hub/MarketDataSection'
import NewAccountSection from './hub/NewAccountSection'
import AccountsList from './hub/AccountsList'
import HubConfirmDialogs from './hub/HubConfirmDialogs'
import AccountDetailModal from './hub/AccountDetailModal'

type HubConfirm = 'create' | 'reset' | 'delete' | 'resetAll' | null

function parseTab(value: string | null): HubTab {
  if (value === 'market' || value === 'settings') return value
  return 'accounts'
}

export default function Hub() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = parseTab(searchParams.get('tab'))
  const { isDark, toggleTheme } = useTheme()

  const [accounts, setAccounts] = useState<PracticeAccount[]>([])
  const [propFirmId, setPropFirmId] = useState(getDefaultPropFirmId())
  const [marketAccountId, setMarketAccountId] = useState('')
  const [offlineModePositions, setOfflineModePositions] = useState(true)
  const [brokerAccounts, setBrokerAccounts] = useState<BrokerAccountOption[]>([])
  const [brokerSessionExpired, setBrokerSessionExpired] = useState(false)
  const [credentialsByFirm, setCredentialsByFirm] = useState<
    Record<string, PropFirmCredentials | null>
  >({})
  const [loadingMd, setLoadingMd] = useState(false)
  const [loadingHub, setLoadingHub] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newMode, setNewMode] = useState<PracticeAccountMode>('eval')
  const [newSize, setNewSize] = useState<PracticeAccountSize>(25000)
  const [customRules, setCustomRules] = useState<PracticeAccountRules>(() =>
    getDefaultPracticeRules(25000, 'eval')
  )
  const [confirm, setConfirm] = useState<HubConfirm>(null)
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [detailAccount, setDetailAccount] = useState<PracticeAccount | null>(null)

  const setActiveTab = (tab: HubTab) => {
    if (tab === 'accounts') {
      setSearchParams({})
    } else if (tab === 'settings') {
      setSearchParams({ tab: 'settings' })
    } else {
      setSearchParams({ tab })
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate(ROUTES.LOGIN)
  }

  const loadFirmCredentials = useCallback(async () => {
    const creds = await loadCredentialLoginCredentials()
    setCredentialsByFirm(creds)
  }, [])

  const syncFromCache = useCallback(() => {
    const md = getPracticeMarketDataSettings()
    const firmId = md.propFirmId || getDefaultPropFirmId()
    setAccounts(getPracticeAccounts())
    setPropFirmId(firmId)
    setMarketAccountId(firmPersistsMarketAccountId(firmId) ? md.accountId : '')
    setOfflineModePositions(resolveOfflineModePositions(md))
  }, [])

  const reload = useCallback(async () => {
    await refreshPracticeFromApi()
    syncFromCache()
  }, [syncFromCache])

  const loadBrokerAccounts = useCallback(async (firmId?: string) => {
    const firm = firmId ?? propFirmId
    if (!firmPersistsMarketAccountId(firm)) {
      setBrokerAccounts([])
      setBrokerSessionExpired(false)
      return
    }

    setLoadingMd(true)
    setError('')
    try {
      if (firm === 'tradesea') {
        let result = await tradeseaAPI.getAccounts()
        if (!result.connected && result.sessionExpired) {
          const refreshed = await tradeseaAPI.refreshSession()
          if (refreshed.connected) {
            result = await tradeseaAPI.getAccounts()
          }
        }
        if (!result.connected) {
          setBrokerAccounts([])
          setBrokerSessionExpired(Boolean(result.sessionExpired))
          setError(result.message || t('practice.notConnected'))
          return
        }
        setBrokerSessionExpired(false)
        setBrokerAccounts(
          (result.accounts || []).map((a) => ({ id: a.id, label: a.label }))
        )
      } else if (firm === 'rithmic') {
        const result = await rithmicAPI.getAccounts()
        if (!result.connected) {
          setBrokerAccounts([])
          setBrokerSessionExpired(Boolean(result.sessionExpired))
          setError(result.message || t('practice.notConnected'))
          return
        }
        setBrokerSessionExpired(false)
        setBrokerAccounts(
          (result.accounts || []).map((a) => ({ id: a.id, label: a.label }))
        )
      }
    } catch (err: unknown) {
      setBrokerAccounts([])
      setBrokerSessionExpired(true)
      setError(err instanceof Error ? err.message : t('practice.loadAccountsFailed'))
    } finally {
      setLoadingMd(false)
    }
  }, [propFirmId, loadFirmCredentials])

  const refreshBrokerSession = useCallback(async () => {
    if (propFirmId === 'tradesea') {
      setLoadingMd(true)
      setError('')
      try {
        const refreshed = await tradeseaAPI.refreshSession()
        if (!refreshed.connected) {
          setBrokerSessionExpired(true)
          setError(refreshed.message || t('practice.refreshSessionFailed'))
          return
        }
        setSuccess(t('practice.sessionRefreshed'))
        await loadBrokerAccounts('tradesea')
      } catch (err: unknown) {
        setBrokerSessionExpired(true)
        setError(err instanceof Error ? err.message : t('practice.refreshSessionFailed'))
      } finally {
        setLoadingMd(false)
      }
      return
    }
    await loadBrokerAccounts(propFirmId)
  }, [propFirmId, loadBrokerAccounts])

  useEffect(() => {
    void (async () => {
      setLoadingHub(true)
      await reload()
      const md = getPracticeMarketDataSettings()
      await Promise.all([loadBrokerAccounts(md.propFirmId), loadFirmCredentials()])
      setLoadingHub(false)
    })()
    const onChange = () => {
      syncFromCache()
      void loadFirmCredentials()
    }
    window.addEventListener('practiceAccountsChanged', onChange)
    window.addEventListener('practiceSettingsChanged', onChange)
    window.addEventListener('refreshPropFirms', onChange)
    return () => {
      window.removeEventListener('practiceAccountsChanged', onChange)
      window.removeEventListener('practiceSettingsChanged', onChange)
      window.removeEventListener('refreshPropFirms', onChange)
    }
  }, [reload, loadBrokerAccounts, loadFirmCredentials, syncFromCache])

  useEffect(() => {
    if (activeTab !== 'market') return
    void loadBrokerAccounts(propFirmId)
  }, [activeTab, propFirmId, loadBrokerAccounts])

  useEffect(() => {
    setCustomRules(getDefaultPracticeRules(newSize, newMode))
  }, [newSize, newMode])

  const marketConnection = useMemo(
    () =>
      resolveMarketDataConnection({
        firmId: propFirmId,
        marketAccountId,
        brokerAccounts,
        brokerSessionExpired,
        firmCredentials: getCredentialsForFirm(propFirmId, credentialsByFirm),
      }),
    [propFirmId, marketAccountId, brokerAccounts, brokerSessionExpired, credentialsByFirm]
  )

  const marketConnected = marketConnection.connected
  const marketAccountLabel = marketConnection.statusLabel

  const persistMarketData = async (opts: {
    propFirmId?: string
    accountId?: string
    offlineModePositions?: boolean
  }) => {
    let md = getPracticeMarketDataSettings()
    const switchingFirm = opts.propFirmId != null && opts.propFirmId !== propFirmId
    const nextFirmId = opts.propFirmId ?? propFirmId

    if (switchingFirm) {
      md = applyActiveFirmToMarketDataSettings(md, nextFirmId)
      setPropFirmId(nextFirmId)
      void loadFirmCredentials()
      void loadBrokerAccounts(nextFirmId)
    }

    const usesBrokerAccount = firmPersistsMarketAccountId(nextFirmId)
    const accountId = usesBrokerAccount
      ? (opts.accountId ?? (switchingFirm ? md.accountId : marketAccountId))
      : ''
    const account = usesBrokerAccount
      ? brokerAccounts.find((a) => a.id === accountId)
      : undefined
    const firm = getPracticePropFirmConfig(nextFirmId)
    const savedOffline =
      opts.offlineModePositions ??
      (switchingFirm ? md.offlineModePositions : offlineModePositions)
    const offline = resolveOfflineModePositions({
      propFirmId: nextFirmId,
      accountId,
      accountLabel: usesBrokerAccount ? (account?.label ?? md.accountLabel) : '',
      offlineModePositions: savedOffline,
    })
    if (offlineModePositions && !offline) {
      try {
        await practiceAPI.stopOfflineBracketWatcher('setting_disabled')
      } catch {
        /* ignore */
      }
    }

    md = updateFirmMarketDataSelection(md, nextFirmId, {
      accountId,
      accountLabel: usesBrokerAccount ? (account?.label ?? md.accountLabel) : '',
      offlineModePositions: firm.supportsOfflineBracketWatcher ? savedOffline : false,
    })

    await savePracticeMarketDataSettings(md)
    if (opts.accountId !== undefined || switchingFirm || !usesBrokerAccount) {
      setMarketAccountId(accountId)
    }
    setOfflineModePositions(offline)
    setSuccess(t('practice.hub.marketDataSaved'))
    syncFromCache()
  }

  const runCreate = async (rules: PracticeAccountRules) => {
    if (!marketConnected) {
      setError(t('practice.notConnected'))
      return
    }
    await createPracticeAccount(newMode, newSize, rules)
    setSuccess(t('practice.hub.accountCreated'))
    syncFromCache()
  }

  const runConfirmAction = async (createRules?: PracticeAccountRules) => {
    if (!confirm || confirmLoading) return
    setConfirmLoading(true)
    setError('')
    try {
      if (confirm === 'create') {
        if (!createRules) {
          setError(t('practice.page.loadFailed'))
          return
        }
        await runCreate(createRules)
      } else if (confirm === 'reset' && confirmTargetId) {
        await resetPracticeAccount(confirmTargetId)
        setSuccess(t('practice.hub.accountReset'))
        syncFromCache()
      } else if (confirm === 'delete' && confirmTargetId) {
        await deletePracticeAccount(confirmTargetId)
        setSuccess(t('practice.hub.accountDeleted'))
        syncFromCache()
      } else if (confirm === 'resetAll') {
        await resetAllPracticeAccounts()
        setSuccess(t('practice.hub.allAccountsReset'))
        syncFromCache()
      }
      setConfirm(null)
      setConfirmTargetId(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('practice.page.loadFailed'))
    } finally {
      setConfirmLoading(false)
    }
  }

  const confirmAccountTitle =
    confirm === 'create'
      ? t('practice.hub.confirmCreateTitle')
      : confirm === 'reset'
        ? getPracticeAccountDisplayTitle(accounts.find((a) => a.id === confirmTargetId))
        : confirm === 'delete'
          ? getPracticeAccountDisplayTitle(accounts.find((a) => a.id === confirmTargetId))
          : ''

  return (
    <div className={`min-h-screen ${appPageBackground(isDark)}`}>
      <HubNav
        isDark={isDark}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'accounts' && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className={`w-5 h-5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-violet-400/90' : 'text-violet-600'
                }`}
              >
                {t('practice.hub.badge')}
              </span>
            </div>
            <h1
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {t('practice.hub.headline')}
            </h1>
            <p className={`mt-2 max-w-2xl text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('practice.hub.subtitle')}
            </p>
          </section>
        )}

        {error && (
          <div className="mb-4">
            <ErrorMessage message={error} isDark={isDark} />
          </div>
        )}
        {success && (
          <div className="mb-4">
            <SuccessMessage message={success} isDark={isDark} />
          </div>
        )}

        {loadingHub ? (
          <div className="flex justify-center py-24">
            <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
          </div>
        ) : (
          <>
            {activeTab === 'accounts' && (
              <div className="space-y-6">
                <HubStatsBar
                  accounts={accounts}
                  isDark={isDark}
                  marketConnected={marketConnected}
                  marketAccountLabel={marketAccountLabel}
                />

                <div className="grid lg:grid-cols-5 gap-6 items-start">
                  <div className="lg:col-span-2 lg:sticky lg:top-20">
                    <NewAccountSection
                      isDark={isDark}
                      newMode={newMode}
                      newSize={newSize}
                      customRules={customRules}
                      marketAccountId={firmPersistsMarketAccountId(propFirmId) ? marketAccountId : ''}
                      onModeChange={setNewMode}
                      onSizeChange={setNewSize}
                      onCreateClick={() => setConfirm('create')}
                    />
                    {!marketConnected && (
                      <p
                        className={`mt-3 text-xs rounded-lg px-3 py-2 border ${
                          isDark
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {t('practice.notConnected')}
                      </p>
                    )}
                  </div>

                  <div className="lg:col-span-3 space-y-6">
                    <AccountsList
                      accounts={accounts}
                      isDark={isDark}
                      onViewAccount={setDetailAccount}
                      onResetAccount={(id) => {
                        setConfirmTargetId(id)
                        setConfirm('reset')
                      }}
                      onDeleteAccount={(id) => {
                        setConfirmTargetId(id)
                        setConfirm('delete')
                      }}
                      onResetAll={() => setConfirm('resetAll')}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'market' && (
              <CenteredPanel maxWidth="max-w-2xl">
                <MarketDataSection
                  isDark={isDark}
                  propFirmId={propFirmId}
                  marketAccountId={marketAccountId}
                  marketConnected={marketConnected}
                  marketStatusLabel={marketAccountLabel}
                  offlineModePositions={offlineModePositions}
                  brokerAccounts={brokerAccounts}
                  brokerSessionExpired={brokerSessionExpired}
                  loadingMd={loadingMd}
                  onPropFirmChange={(id) => {
                    void persistMarketData({ propFirmId: id })
                  }}
                  onMarketAccountChange={(id) => void persistMarketData({ accountId: id })}
                  onOfflineModeChange={(enabled) => void persistMarketData({ offlineModePositions: enabled })}
                  onRefreshAccounts={() => void loadBrokerAccounts()}
                  onRefreshSession={() => void refreshBrokerSession()}
                />
              </CenteredPanel>
            )}

            {activeTab === 'settings' && <HubSettingsPanel isDark={isDark} />}
          </>
        )}
      </main>

      <HubConfirmDialogs
        confirm={confirm}
        isDark={isDark}
        newMode={newMode}
        newSize={newSize}
        customRules={customRules}
        confirmAccountTitle={confirmAccountTitle}
        confirmLoading={confirmLoading}
        onCancel={() => {
          setConfirm(null)
          setConfirmTargetId(null)
        }}
        onConfirm={(rules) => void runConfirmAction(rules)}
        onRulesChange={setCustomRules}
      />

      {detailAccount ? (
        <AccountDetailModal
          account={detailAccount}
          isDark={isDark}
          onClose={() => setDetailAccount(null)}
          onTrade={() => navigate(`${ROUTES.PRACTICE_TRADE}/${detailAccount.id}`)}
          onGoToStats={(id) => navigate(practiceTradeStatsPath(id))}
        />
      ) : null}
    </div>
  )
}
