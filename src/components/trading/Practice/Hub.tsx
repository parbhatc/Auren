import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Sparkles, Zap, Plus } from 'lucide-react'
import { ROUTES, practiceTradeStatsPath } from '../../../constants/routes'
import {
  createPracticeAccount,
  deletePracticeAccount,
  getPracticeAccountDisplayTitle,
  getPracticeAccounts,
  getPracticeMarketDataSettings,
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
import { authAPI } from '../../../api/auth.api'
import HubNav, { type HubTab } from './hub/HubNav'
import HubStatsBar from './hub/HubStatsBar'
import HubSettingsPanel from './hub/HubSettingsPanel'
import HubAdminPanel from './hub/HubAdminPanel'
import { DEFAULT_HUB_ADMIN_SECTION, resolveHubAdminSection } from './hub/hubAdminSections'
import PracticeMarketDataPanel from './hub/PracticeMarketDataPanel'
import NewAccountModal from './hub/NewAccountModal'
import HubHeroSection from './hub/HubHeroSection'
import AccountsList from './hub/AccountsList'
import HubConfirmDialogs from './hub/HubConfirmDialogs'
import HubModeSwitch from './hub/HubModeSwitch'
import LiveTradingSection from '../Live/hub/LiveTradingSection'
import { getLiveTradePropFirmId, saveLiveTradePropFirmId } from '../../../utils/liveTrade'
import AccountDetailModal from './hub/AccountDetailModal'
import { resetPageScroll } from '../../../utils/resetPageScroll'
import type { HubHomeMode } from '../../../types/practiceHub'

type HubConfirm = 'create' | 'reset' | 'delete' | 'resetAll' | null

function parseTab(value: string | null): HubTab {
  if (value === 'settings') return 'settings'
  if (value === 'admin') return 'admin'
  return 'accounts'
}

function parseHomeMode(tab: string | null, mode: string | null): HubHomeMode {
  if (mode === 'live') return 'live'
  return 'practice'
}

export default function Hub() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const modeParam = searchParams.get('mode')
  const activeTab = parseTab(tabParam)
  const homeMode = parseHomeMode(tabParam, modeParam)
  const { isDark, toggleTheme } = useTheme()

  const [accounts, setAccounts] = useState<PracticeAccount[]>([])
  const [propFirmId, setPropFirmId] = useState(getDefaultPropFirmId())
  const [livePropFirmId, setLivePropFirmId] = useState(() => getLiveTradePropFirmId())
  const [marketAccountId, setMarketAccountId] = useState('')
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
  const [createOpen, setCreateOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminResolved, setAdminResolved] = useState(false)

  const setActiveTab = (tab: HubTab) => {
    if (tab === 'accounts') {
      const mode = searchParams.get('mode')
      setSearchParams(mode === 'live' ? { mode: 'live' } : {})
    } else if (tab === 'settings') {
      setSearchParams({ tab: 'settings' })
    } else if (tab === 'admin') {
      const section = resolveHubAdminSection(searchParams.get('section'))
      setSearchParams({ tab: 'admin', section })
    }
  }

  const setHomeMode = (mode: HubHomeMode) => {
    if (mode === 'practice') {
      setSearchParams({})
    } else {
      setSearchParams({ mode: 'live' })
    }
  }

  useEffect(() => {
    if (modeParam !== 'market' && tabParam !== 'market') return
    setSearchParams({}, { replace: true })
  }, [modeParam, tabParam, setSearchParams])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setIsAdmin(false)
      setAdminResolved(true)
      return
    }
    void authAPI
      .validateToken(token)
      .then((res) => {
        setIsAdmin(Boolean(res.user?.isAdmin))
      })
      .catch(() => {
        setIsAdmin(false)
      })
      .finally(() => {
        setAdminResolved(true)
      })
  }, [])

  useEffect(() => {
    if (!adminResolved) return
    if (activeTab === 'admin' && !isAdmin) {
      setSearchParams({}, { replace: true })
      return
    }
    if (activeTab === 'admin' && isAdmin && searchParams.get('section') == null) {
      setSearchParams({ tab: 'admin', section: DEFAULT_HUB_ADMIN_SECTION }, { replace: true })
    }
  }, [activeTab, isAdmin, adminResolved, searchParams, setSearchParams])

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
    setLivePropFirmId(getLiveTradePropFirmId())
    setMarketAccountId(firmPersistsMarketAccountId(firmId) ? md.accountId : '')
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
      }
    } catch (err: unknown) {
      setBrokerAccounts([])
      setBrokerSessionExpired(true)
      setError(err instanceof Error ? err.message : t('practice.loadAccountsFailed'))
    } finally {
      setLoadingMd(false)
    }
  }, [propFirmId, loadFirmCredentials])

  const refreshBrokerSession = useCallback(async (firmId?: string) => {
    const firm = firmId ?? propFirmId
    if (firm === 'tradesea') {
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
    await loadBrokerAccounts(firm)
  }, [propFirmId, loadBrokerAccounts])

  useEffect(() => {
    resetPageScroll()
    const id = window.requestAnimationFrame(() => resetPageScroll())
    return () => window.cancelAnimationFrame(id)
  }, [])

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
    if (activeTab !== 'accounts' || homeMode !== 'practice') return
    void loadBrokerAccounts(propFirmId)
  }, [activeTab, homeMode, propFirmId, loadBrokerAccounts])

  useEffect(() => {
    if (homeMode !== 'live' || activeTab !== 'accounts') return
    void loadBrokerAccounts(livePropFirmId)
  }, [homeMode, activeTab, livePropFirmId, loadBrokerAccounts])

  const handleLivePropFirmChange = (firmId: string) => {
    saveLiveTradePropFirmId(firmId)
    setLivePropFirmId(firmId)
    void loadBrokerAccounts(firmId)
  }

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

  const liveMarketConnection = useMemo(
    () =>
      resolveMarketDataConnection({
        firmId: livePropFirmId,
        marketAccountId: firmPersistsMarketAccountId(livePropFirmId) ? marketAccountId : '',
        brokerAccounts,
        brokerSessionExpired,
        firmCredentials: getCredentialsForFirm(livePropFirmId, credentialsByFirm),
      }),
    [livePropFirmId, marketAccountId, brokerAccounts, brokerSessionExpired, credentialsByFirm]
  )

  const marketConnected = marketConnection.connected
  const marketAccountLabel = marketConnection.statusLabel

  const persistMarketData = async (opts: {
    propFirmId?: string
    accountId?: string
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

    md = updateFirmMarketDataSelection(md, nextFirmId, {
      accountId,
      accountLabel: usesBrokerAccount ? (account?.label ?? md.accountLabel) : '',
    })

    await savePracticeMarketDataSettings(md)
    if (opts.accountId !== undefined || switchingFirm || !usesBrokerAccount) {
      setMarketAccountId(accountId)
    }
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
        showAdmin={isAdmin || (!adminResolved && activeTab === 'admin')}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
            {activeTab === 'accounts' && homeMode === 'practice' && (
              <HubHeroSection
                isDark={isDark}
                icon={Sparkles}
                badge={t('practice.hub.badge')}
                headline={t('practice.hub.headline')}
                subtitle={t('practice.hub.subtitle')}
                accent="violet"
              />
            )}

            {activeTab === 'accounts' && homeMode === 'live' && (
              <HubHeroSection
                isDark={isDark}
                icon={Zap}
                badge={t('live.hub.badge')}
                headline={t('live.hub.headline')}
                subtitle={t('live.hub.subtitle')}
                accent="emerald"
              />
            )}

            {activeTab === 'accounts' && (
              <div className="mb-6">
                <HubModeSwitch mode={homeMode} onModeChange={setHomeMode} isDark={isDark} />
              </div>
            )}

            {activeTab === 'accounts' && homeMode === 'practice' && (
              <div className="space-y-6">
                <HubStatsBar accounts={accounts} isDark={isDark} />

                <PracticeMarketDataPanel
                  isDark={isDark}
                  propFirmId={propFirmId}
                  marketAccountId={marketAccountId}
                  marketConnected={marketConnected}
                  marketStatusLabel={marketAccountLabel}
                  brokerAccounts={brokerAccounts}
                  brokerSessionExpired={brokerSessionExpired}
                  loadingMd={loadingMd}
                  onPropFirmChange={(id) => {
                    void persistMarketData({ propFirmId: id })
                  }}
                  onMarketAccountChange={(id) => void persistMarketData({ accountId: id })}
                  onRefreshAccounts={() => void loadBrokerAccounts()}
                  onRefreshSession={() => void refreshBrokerSession()}
                />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2
                    className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}
                  >
                    {t('practice.hub.yourAccounts')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-violet-500/25"
                  >
                    <Plus className="w-4 h-4" aria-hidden />
                    {t('practice.hub.create')}
                  </button>
                </div>

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
                  onCreateAccount={() => setCreateOpen(true)}
                />
              </div>
            )}

            {activeTab === 'accounts' && homeMode === 'live' && (
              <LiveTradingSection
                propFirmId={livePropFirmId}
                accounts={brokerAccounts}
                isDark={isDark}
                marketConnected={liveMarketConnection.connected}
                brokerSessionExpired={brokerSessionExpired}
                loadingMd={loadingMd}
                onPropFirmChange={handleLivePropFirmChange}
                onRefreshAccounts={() => void loadBrokerAccounts(livePropFirmId)}
                onRefreshSession={() => void refreshBrokerSession(livePropFirmId)}
                onConnectMarket={() => setHomeMode('practice')}
              />
            )}

            {activeTab === 'settings' && <HubSettingsPanel isDark={isDark} />}

            {activeTab === 'admin' && adminResolved && isAdmin && <HubAdminPanel isDark={isDark} />}
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

      <NewAccountModal
        isOpen={createOpen}
        isDark={isDark}
        newMode={newMode}
        newSize={newSize}
        customRules={customRules}
        marketAccountId={firmPersistsMarketAccountId(propFirmId) ? marketAccountId : ''}
        onClose={() => setCreateOpen(false)}
        onModeChange={setNewMode}
        onSizeChange={setNewSize}
        onCreateClick={() => {
          setCreateOpen(false)
          setConfirm('create')
        }}
      />
    </div>
  )
}
