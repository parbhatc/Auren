import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { getThemeColors } from '../../../constants/theme'
import { propFirmRegistry, TradeseaPropFirm } from '../../../propfirms/registry'
import { ROUTES } from '../../../constants/routes'
import TradingRenderer from '../Trading/TradingRenderer'
import { t } from '../../../utils/translator'
import { getLiveTradePropFirmId } from '../../../utils/liveTrade'
import ProductHeader from '../../layout/ProductHeader'
import { getAuthToken } from '../../../api/api'
import { getTradeTradeseaAccount } from '../../../constants/trade'
import { acquireLiveTradeSession, invalidateLiveTradeSession } from '../../../services/trading/liveTradeSession'
import { LiveTradeViewActive } from '../../../contexts/LiveTradeViewContext'
import { loadAurenChartBoot } from '../../../services/chart/loadAurenChartBoot'
import { traceStartup } from '../../../services/debug/startupTrace'

export default function LiveTradePage() {
  const viewActive = useContext(LiveTradeViewActive)
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const colors = getThemeColors(isDark)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const sessionLease = useRef<ReturnType<typeof acquireLiveTradeSession> | null>(null)
  const requestGeneration = useRef(0)
  const validated = useRef(false)

  const firmId = getLiveTradePropFirmId()
  const tradeseaFirm = propFirmRegistry.find((f) => f.id === 'tradesea') as TradeseaPropFirm | undefined

  const pageBg = isDark
    ? 'bg-[#09090B]'
    : 'bg-[#FAFAFA]'

  const acquireSession = useCallback(() => {
    if (firmId !== 'tradesea' || !tradeseaFirm) {
      throw new Error(t('live.trade.firmNotSupported'))
    }
    localStorage.setItem('activePropFirm', firmId)
    tradeseaFirm.setPracticeMode(false)
    // Fetch the chart module graph while the server validates the account.
    // A failed warmup is retried by the chart's normal boot path.
    void loadAurenChartBoot().catch(() => undefined)
    return acquireLiveTradeSession({
      owner: tradeseaFirm,
      getIdentity: () => ({
        token: getAuthToken(), firmId: getLiveTradePropFirmId(),
        accountId: getTradeTradeseaAccount().accountId,
        mode: tradeseaFirm.practiceMode ? 'practice' : 'live',
      }),
      isReusable: () => !tradeseaFirm.practiceMode && tradeseaFirm.streamsReady
        && !tradeseaFirm.streamsError && Boolean(tradeseaFirm.selectedAccountId)
        && tradeseaFirm.selectedAccountId === getTradeTradeseaAccount().accountId
        && tradeseaFirm.chartServices?.accountId === tradeseaFirm.selectedAccountId,
      load: async (assertCurrent) => {
        traceStartup('account-start')
        try {
          await tradeseaFirm.initializeLiveTrade()
          assertCurrent()
          if (!tradeseaFirm.streamsReady) {
            throw new Error(tradeseaFirm.streamsError || t('practice.page.loadFailed'))
          }
          traceStartup('account-ready')
        } catch (error) {
          traceStartup('account-error')
          throw error
        }
      },
    })
  }, [firmId, tradeseaFirm])

  const runValidation = useCallback(async (force = false, preserveView = false) => {
    const generation = ++requestGeneration.current
    if (!preserveView) setIsValidating(true)
    try {
      if (force) invalidateLiveTradeSession(tradeseaFirm)
      sessionLease.current?.release()
      const lease = acquireSession()
      sessionLease.current = lease
      await lease.ready
      if (requestGeneration.current === generation) { validated.current = true; setValidationError(null) }
    } catch (error) {
      if (requestGeneration.current === generation) {
        setValidationError(error instanceof Error ? error.message : t('practice.page.loadFailed'))
      }
    } finally {
      if (requestGeneration.current === generation) {
        setIsValidating(false)
        setRefreshing(false)
      }
    }
  }, [acquireSession, tradeseaFirm])

  useEffect(() => {
    if (viewActive) void runValidation(false, validated.current)
    else {
      sessionLease.current?.release()
      sessionLease.current = null
    }
  }, [viewActive, runValidation])

  useEffect(() => {
    return () => {
      requestGeneration.current += 1
      sessionLease.current?.release()
      sessionLease.current = null
    }
  }, [])

  const handleRefresh = () => {
    if (!tradeseaFirm) return
    setRefreshing(true)
    void runValidation(true)
  }

  if (isValidating && !refreshing) {
    return (
      <div className={`auren-shell-offset min-h-screen ${pageBg}`}>
        <ProductHeader isDark={isDark} toggleTheme={toggleTheme}
          marketDataStatus={{ label: 'Connecting Tradesea…', connected: false }} />
        <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
          <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
        </main>
      </div>
    )
  }

  if (validationError) {
    return (
      <div className={`auren-shell-offset min-h-screen ${pageBg}`}>
        <ProductHeader isDark={isDark} toggleTheme={toggleTheme}
          marketDataStatus={{ label: 'Tradesea disconnected', connected: false }} />
        <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
          <div
            className={`max-w-md w-full p-6 rounded-2xl border ${
              isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-200'
            }`}
          >
            <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{validationError}</p>
            <button
              type="button"
              onClick={() => navigate(`${ROUTES.HOME}?mode=live`)}
              className={`w-full rounded-lg px-4 py-2 text-sm font-semibold ${
                isDark
                  ? 'bg-[#FAFAFA] text-[#09090B] hover:bg-[#E4E4E7]'
                  : 'bg-[#18181B] text-white hover:bg-[#27272A]'
              }`}
            >
              {t('live.trade.backToHub')}
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <TradingRenderer
      isDark={isDark}
      toggleTheme={toggleTheme}
      navigate={(path: string) => navigate(path)}
      colors={colors}
      liveMode
      viewActive={viewActive}
      practiceRefreshing={refreshing}
      onRefreshPracticeAccount={handleRefresh}
    />
  )
}
