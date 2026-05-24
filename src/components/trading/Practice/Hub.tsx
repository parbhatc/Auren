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
  savePracticeMarketDataSettings,
  type PracticeAccount,
  type PracticeAccountMode,
  type PracticeAccountRules,
} from '../../../constants/practice'
import { getDefaultPracticeRules, type PracticeAccountSize } from '../../../services/practice/practicePlans'
import { practiceAPI } from '../../../api/practice.api'
import { tradeseaAPI, TradeseaAccount } from '../../../api/tradesea.api'
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
  const [propFirmId, setPropFirmId] = useState('tradesea')
  const [marketAccountId, setMarketAccountId] = useState('')
  const [offlineModePositions, setOfflineModePositions] = useState(true)
  const [tradeseaAccounts, setTradeseaAccounts] = useState<TradeseaAccount[]>([])
  const [tradeseaSessionExpired, setTradeseaSessionExpired] = useState(false)
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

  const syncFromCache = useCallback(() => {
    const md = getPracticeMarketDataSettings()
    setAccounts(getPracticeAccounts())
    setPropFirmId(md.propFirmId || 'tradesea')
    setMarketAccountId(md.accountId)
    setOfflineModePositions(resolveOfflineModePositions(md))
  }, [])

  const reload = useCallback(async () => {
    await refreshPracticeFromApi()
    syncFromCache()
  }, [syncFromCache])

  const refreshTradeseaSession = useCallback(async () => {
    setLoadingMd(true)
    setError('')
    try {
      const refreshed = await tradeseaAPI.refreshSession()
      if (!refreshed.connected) {
        setTradeseaSessionExpired(true)
        setError(refreshed.message || t('practice.refreshSessionFailed'))
        return
      }
      setSuccess(t('practice.sessionRefreshed'))
      const result = await tradeseaAPI.getAccounts()
      if (result.connected) {
        setTradeseaSessionExpired(false)
        setTradeseaAccounts(result.accounts || [])
        return
      }
      setTradeseaSessionExpired(Boolean(result.sessionExpired))
      setTradeseaAccounts([])
      setError(result.message || t('practice.refreshSessionFailed'))
    } catch (err: unknown) {
      setTradeseaSessionExpired(true)
      setError(err instanceof Error ? err.message : t('practice.refreshSessionFailed'))
    } finally {
      setLoadingMd(false)
    }
  }, [])

  const loadTradesea = useCallback(async () => {
    setLoadingMd(true)
    setError('')
    try {
      let result = await tradeseaAPI.getAccounts()
      if (!result.connected && result.sessionExpired) {
        const refreshed = await tradeseaAPI.refreshSession()
        if (refreshed.connected) {
          result = await tradeseaAPI.getAccounts()
        }
      }
      if (!result.connected) {
        setTradeseaAccounts([])
        setTradeseaSessionExpired(Boolean(result.sessionExpired))
        setError(result.message || t('practice.notConnected'))
        return
      }
      setTradeseaSessionExpired(false)
      setTradeseaAccounts(result.accounts || [])
    } catch (err: unknown) {
      setTradeseaAccounts([])
      setTradeseaSessionExpired(true)
      setError(err instanceof Error ? err.message : t('practice.loadAccountsFailed'))
    } finally {
      setLoadingMd(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      setLoadingHub(true)
      await reload()
      await loadTradesea()
      setLoadingHub(false)
    })()
    const onChange = () => syncFromCache()
    window.addEventListener('practiceAccountsChanged', onChange)
    window.addEventListener('practiceSettingsChanged', onChange)
    return () => {
      window.removeEventListener('practiceAccountsChanged', onChange)
      window.removeEventListener('practiceSettingsChanged', onChange)
    }
  }, [reload, loadTradesea, syncFromCache])

  useEffect(() => {
    setCustomRules(getDefaultPracticeRules(newSize, newMode))
  }, [newSize, newMode])

  const marketAccountLabel = useMemo(() => {
    const fromList = tradeseaAccounts.find((a) => a.id === marketAccountId)?.label
    const md = getPracticeMarketDataSettings()
    return fromList || md.accountLabel
  }, [tradeseaAccounts, marketAccountId])

  const marketConnected = Boolean(marketAccountId) && !tradeseaSessionExpired && tradeseaAccounts.length > 0

  const persistMarketData = async (opts: {
    propFirmId?: string
    accountId?: string
    offlineModePositions?: boolean
  }) => {
    const nextFirmId = opts.propFirmId ?? propFirmId
    const accountId = opts.accountId ?? marketAccountId
    const account = tradeseaAccounts.find((a) => a.id === accountId)
    const md = getPracticeMarketDataSettings()
    const firm = getPracticePropFirmConfig(nextFirmId)
    const savedOffline =
      opts.offlineModePositions ??
      (opts.propFirmId != null ? firm.defaultOfflineModePositions : offlineModePositions)
    const offline = resolveOfflineModePositions({
      propFirmId: nextFirmId,
      accountId,
      accountLabel: account?.label ?? md.accountLabel,
      offlineModePositions: savedOffline,
    })
    if (offlineModePositions && !offline) {
      try {
        await practiceAPI.stopOfflineBracketWatcher('setting_disabled')
      } catch {
        /* ignore */
      }
    }
    if (opts.propFirmId != null && opts.propFirmId !== propFirmId) {
      setPropFirmId(nextFirmId)
    }
    await savePracticeMarketDataSettings({
      propFirmId: nextFirmId,
      accountId,
      accountLabel: account?.label ?? md.accountLabel,
      offlineModePositions: firm.supportsOfflineBracketWatcher ? savedOffline : false,
    })
    if (opts.accountId !== undefined) setMarketAccountId(accountId)
    setOfflineModePositions(offline)
    setSuccess(t('practice.hub.marketDataSaved'))
    syncFromCache()
  }

  const runCreate = async (rules: PracticeAccountRules) => {
    if (!marketAccountId) {
      setError(t('practice.page.noAccountSelected'))
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
        syncFromCache()
      } else if (confirm === 'resetAll') {
        await resetAllPracticeAccounts()
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

  const closeConfirm = () => {
    if (confirmLoading) return
    setConfirm(null)
    setConfirmTargetId(null)
  }

  const confirmAccount = accounts.find((a) => a.id === confirmTargetId)
  const confirmAccountTitle = confirmAccount ? getPracticeAccountDisplayTitle(confirmAccount) : ''

  return (
    <div
      className={appPageBackground(isDark)}
    >
      <HubNav
        isDark={isDark}
        toggleTheme={toggleTheme}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'accounts' && (
          <section className="mb-8">
            <p
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full mb-4 ${
                isDark ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/20' : 'bg-violet-100 text-violet-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('practice.hub.badge')}
            </p>
            <h1
              className={`text-2xl sm:text-3xl font-bold tracking-tight max-w-2xl ${
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
                      marketAccountId={marketAccountId}
                      onModeChange={setNewMode}
                      onSizeChange={setNewSize}
                      onCreateClick={() => setConfirm('create')}
                    />
                    {!marketAccountId && (
                      <p
                        className={`mt-3 text-xs rounded-lg px-3 py-2 border ${
                          isDark
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {t('practice.hub.nav.connectMarketHint')}
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
                  offlineModePositions={offlineModePositions}
                  tradeseaAccounts={tradeseaAccounts}
                  tradeseaSessionExpired={tradeseaSessionExpired}
                  loadingMd={loadingMd}
                  onPropFirmChange={(id) => {
                    void persistMarketData({
                      propFirmId: id,
                      accountId: '',
                      offlineModePositions: getPracticePropFirmConfig(id).defaultOfflineModePositions,
                    })
                  }}
                  onMarketAccountChange={(id) => void persistMarketData({ accountId: id })}
                  onOfflineModeChange={(enabled) => void persistMarketData({ offlineModePositions: enabled })}
                  onRefreshAccounts={() => void loadTradesea()}
                  onRefreshSession={() => void refreshTradeseaSession()}
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
        onConfirm={(rules) => void runConfirmAction(rules)}
        onCancel={closeConfirm}
        onRulesChange={setCustomRules}
      />

      {detailAccount && (
        <AccountDetailModal
          account={detailAccount}
          isDark={isDark}
          onClose={() => setDetailAccount(null)}
          onTrade={() => {
            const id = detailAccount.id
            setDetailAccount(null)
            navigate(`${ROUTES.PRACTICE_TRADE}/${id}`)
          }}
          onGoToStats={(id) => {
            setDetailAccount(null)
            navigate(practiceTradeStatsPath(id))
          }}
        />
      )}
    </div>
  )
}
