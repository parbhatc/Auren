import { useCallback, useEffect, useState } from 'react'

import { useNavigate, useParams } from 'react-router-dom'

import { AlertCircle, RefreshCw } from 'lucide-react'

import { useTheme } from '../../../hooks/useTheme'

import { propFirmRegistry } from '../../../services/propfirms'

import { TradeseaPropFirm } from '../../../services/propfirms/TradeseaPropFirm'

import {

  getPracticeAccountById,

  getPracticeAccountDisplayTitle,

  getPracticeMarketDataSettings,

  refreshPracticeFromApi,

} from '../../../constants/practice'

import { ROUTES } from '../../../constants/routes'

import StatsRenderer from '../Stats/StatsRenderer'

import { t } from '../../../utils/translator'



const practicePageBg = (isDark: boolean) =>

  isDark

    ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950'

    : 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60'



export default function PracticeStatsWrapper() {

  const { practiceAccountId } = useParams<{ practiceAccountId: string }>()

  const navigate = useNavigate()

  const { isDark, toggleTheme } = useTheme()

  const [validationError, setValidationError] = useState<string | null>(null)

  const [isValidating, setIsValidating] = useState(true)

  const [displayName, setDisplayName] = useState('')



  const tradeseaFirm = propFirmRegistry.find((f) => f.id === 'tradesea') as TradeseaPropFirm | undefined



  const runValidation = useCallback(async () => {

    const id = practiceAccountId || ''

    const account = getPracticeAccountById(id)

    if (!account) {

      setValidationError(t('practice.trade.accountNotFound'))

      return

    }



    const md = getPracticeMarketDataSettings()

    if (!md.accountId) {

      setValidationError(t('practice.page.noAccountSelected'))

      return

    }



    if (!tradeseaFirm) {

      setValidationError(t('practice.page.loadFailed'))

      return

    }



    setDisplayName(getPracticeAccountDisplayTitle(account))

    setValidationError(null)



    try {

      localStorage.setItem('activePropFirm', 'tradesea')

      tradeseaFirm.setPracticeMode(true, md.accountId, md.accountLabel, id)

      const validationResult = await tradeseaFirm.validate()

      if (!validationResult.success) {

        setValidationError(validationResult.message || t('practice.page.loadFailed'))

        return

      }

      await tradeseaFirm.onValidateSuccess({ skipStreams: true })

    } catch (error: unknown) {

      setValidationError(error instanceof Error ? error.message : t('practice.page.loadFailed'))

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

      tradeseaFirm?.cleanup()

    }

  }, [runValidation, tradeseaFirm])



  if (isValidating) {

    return (

      <div className={`h-screen flex items-center justify-center ${practicePageBg(isDark)}`}>

        <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />

      </div>

    )

  }



  if (validationError) {

    return (

      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${practicePageBg(isDark)}`}>

        <div

          className={`max-w-md w-full p-6 rounded-2xl border ${

            isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-200'

          }`}

        >

          <div className="flex items-center gap-2 mb-3">

            <AlertCircle className="w-5 h-5 text-amber-500" />

            <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{validationError}</p>

          </div>

          <button

            type="button"

            onClick={() => navigate(ROUTES.PRACTICE)}

            className="w-full px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"

          >

            {t('practice.trade.backToHub')}

          </button>

        </div>

      </div>

    )

  }



  return (

    <StatsRenderer

      isDark={isDark}

      toggleTheme={toggleTheme}

      navigate={(path: string) => navigate(path)}

      selectedAccount={displayName}

      accounts={[

        {

          accountId: 1,

          displayName,

          templateName: 'Practice',

          accountName: displayName,

          isIneligible: false,

          isCombine: false,

          isExpress: false,

          account: { id: practiceAccountId },

        },

      ]}

      showAccountDropdown={false}

      title={t('practice.page.panelTitle')}

      practiceMode

      practiceAccountId={practiceAccountId}

    />

  )

}

