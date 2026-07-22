import { useCallback, useEffect, useRef, useState } from 'react'

import { useNavigate, useParams } from 'react-router-dom'

import { AlertCircle, RefreshCw } from 'lucide-react'

import { useTheme } from '../../../hooks/useTheme'

import { propFirmRegistry } from '../../../propfirms'

import { firmUsesBrokerAccounts } from '../../../propfirms/MarketDataConnection'

import {

  getPracticeAccountById,

  getPracticeAccountDisplayTitle,

  getPracticeMarketDataSettings,

  normalizePracticePropFirmId,

  refreshPracticeFromApi,

} from '../../../constants/practice'

import { ROUTES } from '../../../constants/routes'

import StatsRenderer from '../Stats/StatsRenderer'

import { t } from '../../../utils/translator'



const practicePageBg = (isDark: boolean) =>

  isDark

    ? 'bg-[#09090B]'

    : 'bg-[#FAFAFA]'



export default function StatsPage() {

  const { practiceAccountId } = useParams<{ practiceAccountId: string }>()

  const navigate = useNavigate()

  const { isDark, toggleTheme } = useTheme()

  const [validationError, setValidationError] = useState<string | null>(null)

  const [isValidating, setIsValidating] = useState(true)

  const [displayName, setDisplayName] = useState('')



  const marketFirmRef = useRef<any>(null)



  const runValidation = useCallback(async () => {

    const id = practiceAccountId || ''

    const account = getPracticeAccountById(id)

    if (!account) {

      setValidationError(t('practice.trade.accountNotFound'))

      return

    }



    const md = getPracticeMarketDataSettings()

    const selectedFirmId = normalizePracticePropFirmId(md.propFirmId)

    const marketFirm = propFirmRegistry.find((firm) => firm.id === selectedFirmId) as any

    if (firmUsesBrokerAccounts(selectedFirmId) && !md.accountId) {

      setValidationError(t('practice.page.noAccountSelected'))

      return

    }



    if (!marketFirm) {

      setValidationError(t('practice.page.loadFailed'))

      return

    }



    setDisplayName(getPracticeAccountDisplayTitle(account))

    setValidationError(null)



    try {

      marketFirmRef.current = marketFirm

      localStorage.setItem('activePropFirm', selectedFirmId)

      marketFirm.setPracticeMode(true, md.accountId, md.accountLabel, id)

      const validationResult = await marketFirm.validate()

      if (!validationResult.success) {

        setValidationError(validationResult.message || t('practice.page.loadFailed'))

        return

      }

      await marketFirm.onValidateSuccess({ skipStreams: true })

    } catch (error: unknown) {

      setValidationError(error instanceof Error ? error.message : t('practice.page.loadFailed'))

    }

  }, [practiceAccountId])



  useEffect(() => {

    let cancelled = false

    void (async () => {

      setIsValidating(true)

      try {

        await refreshPracticeFromApi()

        await runValidation()

      } finally {

        if (!cancelled) setIsValidating(false)

      }

    })()

    return () => {

      cancelled = true

      marketFirmRef.current?.cleanup()

    }

  }, [runValidation])



  if (isValidating) {

    return (

      <div className={`h-screen flex items-center justify-center ${practicePageBg(isDark)}`}>

        <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />

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

    <StatsRenderer

      isDark={isDark}

      toggleTheme={toggleTheme}

      navigate={(path: string) => navigate(path)}

      selectedAccount={displayName}

      accounts={[displayName]}

      showAccountDropdown={false}

      title={t('practice.page.panelTitle')}

      practiceMode

      practiceAccountId={practiceAccountId}

    />

  )

}

