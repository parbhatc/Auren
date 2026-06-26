import { Component, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { getThemeColors } from '../../../constants/theme'
import { propFirmRegistry, TradeseaPropFirm } from '../../../propfirms'
import { ROUTES, practiceTradeStatsPath } from '../../../constants/routes'
import { RefreshCw } from 'lucide-react'
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
import { firmUsesBrokerAccounts } from '../../../propfirms/MarketDataConnection'
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

  const tradeseaFirm = propFirmRegistry.find((f) => f.id === 'tradesea') as TradeseaPropFirm | undefined

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
    if (firmUsesBrokerAccounts(marketFirmId) && !md.accountId) {
      setValidationError(t('practice.page.noAccountSelected'))
      return
    }

    if (!tradeseaFirm) {
      setValidationError(t('practice.page.loadFailed'))
      return
    }

    setPracticeAccount(account)
    setValidationError(null)

    try {
      const firmId = marketFirmId
      localStorage.setItem('activePropFirm', firmId)

      let marketAccountId = md.accountId
      let marketAccountLabel = md.accountLabel

      const validationResult = await tradeseaFirm.validate()
      if (!validationResult.success) {
        setValidationError(validationResult.message || t('practice.page.loadFailed'))
        return
      }

      tradeseaFirm.setPracticeMode(true, marketAccountId, marketAccountLabel, id)

      await tradeseaFirm.onValidateSuccess()
      if (tradeseaFirm.practiceTradeHandler) {
        tradeseaFirm.practiceTradeHandler.onAccountUpdated = () => {
          void refreshPracticeFromApi().then(() => {
            const acc = getPracticeAccountById(practiceAccountId || '') || null
            setPracticeAccount(acc)
            if (acc?.status === 'blown') setShowBlownModal(true)
            else if (acc?.status === 'passed') setShowPassedModal(true)
            setUpdateTrigger((n) => n + 1)
          })
        }
        tradeseaFirm.practiceTradeHandler.onUnrealizedPnLUpdate = () => {
          const h = tradeseaFirm.practiceTradeHandler
          if (!h) return
          const info = h.getAccountInfo()
          publishAccountStats({
            balance: info.balance,
            rpl: info.rpl,
            upl: info.upl,
            hasOpenPosition: h.hasAnyOpenPosition?.() ?? false,
          })
        }
        tradeseaFirm.practiceTradeHandler.onAccountBlown = () => {
          setShowBlownModal(true)
          void refreshPracticeFromApi().then(() => {
            setPracticeAccount(getPracticeAccountById(practiceAccountId || '') || null)
            setUpdateTrigger((n) => n + 1)
          })
        }
        tradeseaFirm.practiceTradeHandler.onAccountPassed = () => {
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
  }, [practiceAccountId, tradeseaFirm])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      setIsValidating(true)
      await refreshPracticeFromApi()
      await runValidation()
      if (!cancelled) {
        setIsValidating(false)
        setRefreshing(false)
        setPracticeAccount(getPracticeAccountById(practiceAccountId || '') || null)
        setUpdateTrigger((n) => n + 1)
      }
    }

    void bootstrap()

    const onAccountsChanged = () => {
      const acc = getPracticeAccountById(practiceAccountId || '')
      setPracticeAccount(acc)
      if (acc?.status === 'blown') {
        setShowBlownModal(true)
      } else if (acc?.status === 'passed') {
        setShowPassedModal(true)
        setValidationError(null)
      }
      setUpdateTrigger((n) => n + 1)
    }
    window.addEventListener('practiceAccountsChanged', onAccountsChanged)

    if (tradeseaFirm) {
      tradeseaFirm.setOnDataReady(() => {
        setPracticeAccount(getPracticeAccountById(practiceAccountId || '') || null)
        setUpdateTrigger((n) => n + 1)
      })
    }

    return () => {
      cancelled = true
      window.removeEventListener('practiceAccountsChanged', onAccountsChanged)
      tradeseaFirm?.cleanup()
    }
  }, [runValidation, tradeseaFirm, practiceAccountId])

  const handleRefresh = () => {
    if (!tradeseaFirm) return
    setRefreshing(true)
    tradeseaFirm.accountsFetched = false
    void (async () => {
      setIsValidating(true)
      await runValidation()
      setIsValidating(false)
      setRefreshing(false)
    })()
  }

  if (isValidating && !refreshing) {
    return (
      <div
        className={`h-screen flex items-center justify-center ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950'
            : 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60'
        }`}
      >
        <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
      </div>
    )
  }

  if (validationError) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-4 ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950'
            : 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60'
        }`}
      >
        <div
          className={`max-w-md w-full p-6 rounded-2xl border ${
            isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-200'
          }`}
        >
          <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{validationError}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(ROUTES.PRACTICE)}
              className="flex-1 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold"
            >
              {t('practice.trade.backToHub')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!practiceAccount) {
    return (
      <div
        className={`h-screen flex items-center justify-center ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950'
            : 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60'
        }`}
      >
        <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
      </div>
    )
  }

  const displayName = getPracticeAccountDisplayTitle(practiceAccount)
  const plan = getPracticePlanFromAccount(practiceAccount)
  const rules = evaluatePracticeRules(practiceAccount)
  const goToStats = () => {
    tradeseaFirm?.cleanup()
    navigate(practiceTradeStatsPath(practiceAccount.id))
  }
  const pageBg = isDark
    ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950'
    : 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60'

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
            tradeseaFirm?.cleanup()
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
            tradeseaFirm?.cleanup()
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
          tradeseaFirm?.cleanup()
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
          tradeseaFirm?.cleanup()
          navigate(ROUTES.PRACTICE)
        }}
        onGoToStats={goToStats}
      />
    </>
  )
}

export default TradePage
