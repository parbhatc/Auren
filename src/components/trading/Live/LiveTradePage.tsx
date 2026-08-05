import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { getThemeColors } from '../../../constants/theme'
import { propFirmRegistry, TradeseaPropFirm } from '../../../propfirms'
import { ROUTES } from '../../../constants/routes'
import TradingRenderer from '../Trading/TradingRenderer'
import { t } from '../../../utils/translator'
import { getLiveTradePropFirmId } from '../../../utils/liveTrade'
import ProductHeader from '../../layout/ProductHeader'

export default function LiveTradePage() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const colors = getThemeColors(isDark)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const firmId = getLiveTradePropFirmId()
  const tradeseaFirm = propFirmRegistry.find((f) => f.id === 'tradesea') as TradeseaPropFirm | undefined

  const pageBg = isDark
    ? 'bg-[#09090B]'
    : 'bg-[#FAFAFA]'

  const runValidation = useCallback(async () => {
    if (firmId !== 'tradesea' || !tradeseaFirm) {
      setValidationError(t('live.trade.firmNotSupported'))
      return
    }

    try {
      localStorage.setItem('activePropFirm', firmId)
      tradeseaFirm.setPracticeMode(false)

      const validationResult = await tradeseaFirm.validate()
      if (!validationResult.success) {
        setValidationError(validationResult.message || t('practice.page.loadFailed'))
        return
      }

      tradeseaFirm.accountsFetched = false
      await tradeseaFirm.onValidateSuccess()
      setValidationError(null)
    } catch (error: unknown) {
      setValidationError(error instanceof Error ? error.message : t('practice.page.loadFailed'))
    }
  }, [firmId, tradeseaFirm])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      setIsValidating(true)
      await runValidation()
      if (!cancelled) {
        setIsValidating(false)
        setRefreshing(false)
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
      tradeseaFirm?.cleanup()
    }
  }, [runValidation, tradeseaFirm])

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
      <div className={`auren-shell-offset min-h-screen ${pageBg}`}>
        <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
        <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
          <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
        </main>
      </div>
    )
  }

  if (validationError) {
    return (
      <div className={`auren-shell-offset min-h-screen ${pageBg}`}>
        <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
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
      practiceRefreshing={refreshing}
      onRefreshPracticeAccount={handleRefresh}
    />
  )
}
