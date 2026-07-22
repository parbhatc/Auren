import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import { propFirmRegistry, TradeseaPropFirm } from '../../../propfirms'
import {
  getPracticeAccountById,
  refreshPracticeFromApi,
} from '../../../constants/practice'
import { ROUTES } from '../../../constants/routes'
import { t } from '../../../utils/translator'
import TradingNav from '../../common/TradingNav'
import { TradeHeader } from '../Trading/TradeHeader'
import { EconomicNewsView } from '../shared/news/EconomicNewsView'
import {
  getInitialPracticeShowNav,
  savePracticeShowNav,
} from '../../../utils/practiceTradePreferences'
import { practiceTradePanelClass } from './practiceTradeTheme'

export default function NewsPage() {
  const { practiceAccountId } = useParams<{ practiceAccountId: string }>()
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [showNav, setShowNav] = useState(() =>
    practiceAccountId ? getInitialPracticeShowNav(practiceAccountId) : true
  )
  const tradeseaFirm = propFirmRegistry.find((f) => f.id === 'tradesea') as TradeseaPropFirm | undefined

  const runValidation = useCallback(async () => {
    const id = practiceAccountId || ''
    if (!getPracticeAccountById(id)) {
      setValidationError(t('practice.trade.accountNotFound'))
      return
    }
    if (!tradeseaFirm) {
      setValidationError(t('practice.page.loadFailed'))
      return
    }
    setValidationError(null)
    try {
      localStorage.setItem('activePropFirm', 'tradesea')
    } catch {
      /* ignore */
    }
  }, [practiceAccountId, tradeseaFirm])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsValidating(true)
      await refreshPracticeFromApi()
      await runValidation()
      if (!cancelled) setIsValidating(false)
    })()
    return () => {
      cancelled = true
    }
  }, [runValidation])

  if (isValidating) {
    return (
      <div
        className={`h-screen flex items-center justify-center ${
          isDark
            ? 'bg-[#09090B]'
            : 'bg-[#FAFAFA]'
        }`}
      >
        <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-[#7d8590]' : 'text-slate-600'}`} />
      </div>
    )
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
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <p className={isDark ? 'text-[#adbac7]' : 'text-slate-700'}>{validationError}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(ROUTES.PRACTICE)}
            className={`w-full rounded-lg px-4 py-2 text-sm font-semibold ${
              isDark
                ? 'bg-[#FAFAFA] text-[#09090B] hover:bg-[#E4E4E7]'
                : 'bg-[#18181B] text-white hover:bg-[#27272A]'
            }`}
          >
            {t('practice.trade.backToHub')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`h-screen max-h-screen overflow-hidden flex ${
        isDark
          ? 'bg-[#09090B]'
          : 'bg-[#FAFAFA]'
      }`}
    >
      <div
        className={`hidden lg:block transition-all duration-300 ease-in-out ${
          showNav ? 'w-11 opacity-100' : 'w-0 opacity-0 overflow-hidden'
        }`}
      >
        {showNav && (
          <TradingNav
            compact
            isDark={isDark}
            navigate={(path) => navigate(path)}
            currentPath={window.location.pathname}
            onToggleNav={() => {
              setShowNav(false)
              if (practiceAccountId) savePracticeShowNav(practiceAccountId, false)
            }}
            showDesktopNav
            showMobileNav={false}
          />
        )}
      </div>

      <div className={`lg:hidden fixed bottom-0 left-0 right-0 transition-all duration-300 z-50 ${
        showNav ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}>
        {showNav && (
          <TradingNav
            compact
            isDark={isDark}
            navigate={(path) => navigate(path)}
            currentPath={window.location.pathname}
            onToggleNav={() => {
              setShowNav(false)
              if (practiceAccountId) savePracticeShowNav(practiceAccountId, false)
            }}
            showDesktopNav={false}
            showMobileNav
          />
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <TradeHeader
          isDark={isDark}
          navigate={(path) => navigate(path)}
          toggleTheme={toggleTheme}
          practiceAccountId={practiceAccountId}
          showNav={showNav}
          onShowNav={() => {
            setShowNav(true)
            if (practiceAccountId) savePracticeShowNav(practiceAccountId, true)
          }}
          showStatsBar={false}
          showAccountSelector={false}
        />

        <main className="flex-1 min-h-0 flex flex-col px-2 py-2 pb-20 lg:pb-2 overflow-hidden">
          <div className={`flex-1 min-h-0 overflow-auto p-3 sm:p-4 ${practiceTradePanelClass(isDark)}`}>
            <EconomicNewsView isDark={isDark} />
          </div>
        </main>
      </div>
    </div>
  )
}
