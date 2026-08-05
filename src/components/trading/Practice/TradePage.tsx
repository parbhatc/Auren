import { Component, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { getThemeColors } from '../../../constants/theme'
import { propFirmRegistry } from '../../../propfirms'
import { ROUTES, practiceTradeStatsPath } from '../../../constants/routes'
import { BarChart3, RefreshCw, ShieldCheck } from 'lucide-react'
import TradingRenderer from '../Trading/TradingRenderer'
import { t } from '../../../utils/translator'
import { publishAccountStats } from '../../../services/trading/accountStatsStore'
import {
  getPracticeAccountById,
  getPracticeAccountDisplayTitle,
  getPracticeMarketDataSettings,
  normalizePracticePropFirmId,
  refreshPracticeFromApi,
  type PracticeAccount,
} from '../../../constants/practice'
import {
  computeDrawdownFloor,
  evaluatePracticeRules,
} from '../../../services/practice/practiceRules'
import { getPracticePlanFromAccount } from '../../../services/practice/practicePlans'
import BlownAccountModal from '../shared/modals/BlownAccountModal'
import PassedAccountModal from '../shared/modals/PassedAccountModal'

class TradePage extends Component {
  render() {
    return <TradePageInner />
  }
}

function TradePageInner() {
  const { practiceAccountId } = useParams<{ practiceAccountId: string }>()
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const colors = getThemeColors(isDark)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [practiceAccount, setPracticeAccount] = useState<PracticeAccount | null>(null)
  const [showBlownModal, setShowBlownModal] = useState(false)
  const [showPassedModal, setShowPassedModal] = useState(false)
  const [, setUpdateTrigger] = useState(0)

  const marketFirmRef = useRef<any>(null)
  const marketFirm = marketFirmRef.current

  const runValidation = useCallback(async () => {
    const id = practiceAccountId || ''
    const account = getPracticeAccountById(id)
    if (!account) {
      setValidationError(t('practice.trade.accountNotFound'))
      return
    }
    if (account.status === 'passed') {
      setPracticeAccount(account)
      setValidationError(null)
      setShowPassedModal(true)
      return
    }
    if (account.status === 'blown') {
      setPracticeAccount(account)
      setValidationError(null)
      setShowBlownModal(true)
      return
    }
    if (account.status !== 'active') {
      setValidationError(t('practice.trade.accountNotActive'))
      return
    }

    const md = getPracticeMarketDataSettings()
    const marketFirmId = normalizePracticePropFirmId(md.propFirmId)
    const activeMarketFirm = propFirmRegistry.find((firm) => firm.id === marketFirmId) as any
    if (!activeMarketFirm) {
      setValidationError(t('practice.page.loadFailed'))
      return
    }

    setPracticeAccount(account)
    setValidationError(null)

    try {
      marketFirmRef.current = activeMarketFirm
      const firmId = marketFirmId
      localStorage.setItem('activePropFirm', firmId)

      let marketAccountId = md.accountId
      let marketAccountLabel = md.accountLabel

      const validationResult = await activeMarketFirm.validate()
      if (!validationResult.success) {
        setValidationError(validationResult.message || t('practice.page.loadFailed'))
        return
      }

      activeMarketFirm.setPracticeMode(true, marketAccountId, marketAccountLabel, id)

      activeMarketFirm.setOnDataReady(() => {
        setPracticeAccount(getPracticeAccountById(practiceAccountId || '') || null)
        setUpdateTrigger((n) => n + 1)
      })
      await activeMarketFirm.onValidateSuccess()
      if (activeMarketFirm.practiceTradeHandler) {
        activeMarketFirm.practiceTradeHandler.onAccountUpdated = undefined
        activeMarketFirm.practiceTradeHandler.onUnrealizedPnLUpdate = () => {
          const h = activeMarketFirm.practiceTradeHandler
          if (!h) return
          const info = h.getAccountInfo()
          publishAccountStats({
            balance: info.balance,
            rpl: info.rpl,
            upl: info.upl,
            hasOpenPosition: h.hasAnyOpenPosition?.() ?? false,
          })
        }
        activeMarketFirm.practiceTradeHandler.onAccountBlown = () => {
          setShowBlownModal(true)
          void refreshPracticeFromApi().then(() => {
            setPracticeAccount(getPracticeAccountById(practiceAccountId || '') || null)
            setUpdateTrigger((n) => n + 1)
          })
        }
        activeMarketFirm.practiceTradeHandler.onAccountPassed = () => {
          setShowPassedModal(true)
          void refreshPracticeFromApi().then(() => {
            setPracticeAccount(getPracticeAccountById(practiceAccountId || '') || null)
            setUpdateTrigger((n) => n + 1)
          })
        }
      }
    } catch (error: unknown) {
      setValidationError(error instanceof Error ? error.message : t('practice.page.loadFailed'))
    }
  }, [practiceAccountId])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      setIsValidating(true)
      try {
        await refreshPracticeFromApi()
        await runValidation()
      } catch (error: unknown) {
        if (!cancelled) {
          setValidationError(error instanceof Error ? error.message : t('practice.page.loadFailed'))
        }
      } finally {
        if (!cancelled) {
          setIsValidating(false)
          setRefreshing(false)
          setPracticeAccount(getPracticeAccountById(practiceAccountId || '') || null)
          setUpdateTrigger((n) => n + 1)
        }
      }
    }

    void bootstrap()

    const onAccountsChanged = () => {
      const acc = getPracticeAccountById(practiceAccountId || '')
      if (acc?.status === 'blown') {
        setPracticeAccount(acc)
        setShowBlownModal(true)
      } else if (acc?.status === 'passed') {
        setPracticeAccount(acc)
        setShowPassedModal(true)
        setValidationError(null)
      } else {
        // Position mutations already patch the shared account cache. Keep the
        // trading workspace mounted when only ordinary account fields change;
        // its header and trade pad subscribe to that cache independently.
        setPracticeAccount((current) =>
          current?.id === acc?.id && current?.status === acc?.status
            ? current
            : acc
        )
      }
    }
    window.addEventListener('practiceAccountsChanged', onAccountsChanged)

    return () => {
      cancelled = true
      window.removeEventListener('practiceAccountsChanged', onAccountsChanged)
      marketFirmRef.current?.cleanup()
    }
  }, [runValidation, practiceAccountId])

  const handleRefresh = () => {
    const activeMarketFirm = marketFirmRef.current
    if (!activeMarketFirm) return
    setRefreshing(true)
    if ('accountsFetched' in activeMarketFirm) activeMarketFirm.accountsFetched = false
    void (async () => {
      setIsValidating(true)
      try {
        await runValidation()
      } finally {
        setIsValidating(false)
        setRefreshing(false)
      }
    })()
  }

  if (isValidating && !refreshing) {
    return <TerminalBootScreen isDark={isDark} />
  }

  if (validationError) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-4 ${
          isDark
            ? 'bg-[#09090B]'
            : 'bg-[#FAFAFA]'
        }`}
      >
        <div
          className={`max-w-md w-full p-6 rounded-2xl border ${
            isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-200'
          }`}
        >
          <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{validationError}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(ROUTES.PRACTICE)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${
                isDark
                  ? 'bg-blue-500 text-white hover:bg-blue-400'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              Change market data
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.PRACTICE)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${
                isDark
                  ? 'bg-[#FAFAFA] text-[#09090B] hover:bg-[#E4E4E7]'
                  : 'bg-[#18181B] text-white hover:bg-[#27272A]'
              }`}
            >
              {t('practice.trade.backToHub')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!practiceAccount) {
    return <TerminalBootScreen isDark={isDark} />
  }

  const displayName = getPracticeAccountDisplayTitle(practiceAccount)
  const plan = getPracticePlanFromAccount(practiceAccount)
  const rules = evaluatePracticeRules(practiceAccount)
  const goToStats = () => {
    marketFirm?.cleanup()
    navigate(practiceTradeStatsPath(practiceAccount.id))
  }
  const pageBg = isDark
    ? 'bg-[#09090B]'
    : 'bg-[#FAFAFA]'

  if (practiceAccount.status === 'blown') {
    return (
      <div className={`h-screen ${pageBg}`}>
        <BlownAccountModal
          isDark={isDark}
          isOpen={showBlownModal || practiceAccount.status === 'blown'}
          drawdownFloor={computeDrawdownFloor(practiceAccount)}
          balance={practiceAccount.balance}
          onGoToHub={() => {
            setShowBlownModal(false)
            marketFirm?.cleanup()
            navigate(ROUTES.PRACTICE)
          }}
          onGoToStats={goToStats}
        />
      </div>
    )
  }

  if (practiceAccount.status === 'passed') {
    return (
      <div className={`h-screen ${pageBg}`}>
        <PassedAccountModal
          isDark={isDark}
          isOpen={showPassedModal}
          balance={practiceAccount.balance}
          profitTarget={plan.profitTarget}
          totalProfit={rules.totalProfit}
          onGoToHub={() => {
            setShowPassedModal(false)
            marketFirm?.cleanup()
            navigate(ROUTES.PRACTICE)
          }}
          onGoToStats={goToStats}
        />
      </div>
    )
  }

  return (
    <>
      <TradingRenderer
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={(path: string) => navigate(path)}
        colors={colors}
        accounts={[
          {
            accountId: 1,
            displayName,
            templateName: 'Practice',
            accountName: displayName,
            isIneligible: false,
            isCombine: false,
            isExpress: false,
            account: { id: practiceAccount.id },
          },
        ]}
        selectedAccount={displayName}
        practiceMode
        practiceAccountId={practiceAccount.id}
        practiceRefreshing={refreshing}
        onRefreshPracticeAccount={handleRefresh}
      />
      <BlownAccountModal
        isDark={isDark}
        isOpen={showBlownModal}
        drawdownFloor={computeDrawdownFloor(practiceAccount)}
        balance={practiceAccount.balance}
        onGoToHub={() => {
          setShowBlownModal(false)
          marketFirm?.cleanup()
          navigate(ROUTES.PRACTICE)
        }}
        onGoToStats={goToStats}
      />
      <PassedAccountModal
        isDark={isDark}
        isOpen={showPassedModal}
        balance={practiceAccount.balance}
        profitTarget={plan.profitTarget}
        totalProfit={rules.totalProfit}
        onGoToHub={() => {
          setShowPassedModal(false)
          marketFirm?.cleanup()
          navigate(ROUTES.PRACTICE)
        }}
        onGoToStats={goToStats}
      />
    </>
  )
}

function TerminalBootScreen({ isDark }: { isDark: boolean }) {
  const surface = isDark ? 'border-[#27272A] bg-[#09090B]' : 'border-[#E4E4E7] bg-white'
  const muted = isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'
  const skeleton = isDark ? 'bg-white/[0.055]' : 'bg-black/[0.055]'

  return (
    <div
      className={`flex h-screen h-[100dvh] flex-col overflow-hidden ${isDark ? 'bg-[#09090B]' : 'bg-[#FAFAFA]'}`}
      role="status"
      aria-live="polite"
      aria-label="Preparing trading workspace"
    >
      <div className={`flex h-10 shrink-0 items-center gap-2 border-b px-3 ${surface}`}>
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-500">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden />
        </div>
        <span className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Auren Terminal</span>
        <div className={`ml-auto h-5 w-20 animate-pulse rounded ${skeleton}`} aria-hidden />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className={`hidden w-16 shrink-0 border-r lg:block ${surface}`} aria-hidden />
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="auren-terminal-boot-grid absolute inset-0 opacity-70" aria-hidden />
          <div className="absolute inset-0 flex items-center justify-center p-5">
            <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${surface}`}>
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-500">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                  <RefreshCw className="absolute -bottom-1 -right-1 h-4 w-4 animate-spin rounded-full bg-blue-500 p-0.5 text-white" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Preparing your trading workspace</p>
                  <p className={`mt-0.5 text-xs ${muted}`}>Verifying account rules and connecting market data...</p>
                </div>
              </div>
              <div className={`mt-4 h-1 overflow-hidden rounded-full ${skeleton}`} aria-hidden>
                <span className="auren-terminal-boot-progress block h-full w-1/3 rounded-full bg-blue-500" />
              </div>
              <p className={`mt-3 text-[10px] font-medium uppercase tracking-[0.14em] ${muted}`}>Secure practice environment</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TradePage
