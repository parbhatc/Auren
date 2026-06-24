import { useNavigate } from 'react-router-dom'

import { RefreshCw, TrendingUp } from 'lucide-react'

import {

  PRACTICE_PROP_FIRMS,

  getPracticePropFirmConfig,

} from '../../../../constants/practice'

import { ROUTES } from '../../../../constants/routes'

import type { BrokerAccountOption } from '../../../../propfirms/marketData/types'

import { selectInputClass } from '../../../../styles/aurenTheme'

import { PanelCard, PanelField } from '../../../ui/PanelCard'

import { t } from '../../../../utils/translator'



export default function LiveTradingSection({

  propFirmId,

  accounts,

  isDark,

  marketConnected,

  brokerSessionExpired,

  loadingMd,

  onPropFirmChange,

  onRefreshAccounts,

  onRefreshSession,

  onConnectMarket,

}: {

  propFirmId: string

  accounts: BrokerAccountOption[]

  isDark: boolean

  marketConnected: boolean

  brokerSessionExpired: boolean

  loadingMd: boolean

  onPropFirmChange: (firmId: string) => void

  onRefreshAccounts: () => void

  onRefreshSession: () => void

  onConnectMarket: () => void

}) {

  const navigate = useNavigate()

  const selectClass = selectInputClass(isDark)

  const firm = getPracticePropFirmConfig(propFirmId)



  return (

    <div className="space-y-6">

      {!marketConnected && (

        <div

          className={`rounded-2xl border px-4 py-4 sm:px-5 ${

            isDark

              ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'

              : 'border-amber-200 bg-amber-50 text-amber-900'

          }`}

        >

          <p className="text-sm font-medium">

            {brokerSessionExpired ? t('practice.sessionExpired') : t('practice.notConnected')}

          </p>

          <p className={`mt-1 text-xs ${isDark ? 'text-amber-200/80' : 'text-amber-800'}`}>

            {t('live.hub.connectHint')}

          </p>

          <div className="mt-3 flex flex-wrap gap-2">

            <button

              type="button"

              onClick={onConnectMarket}

              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"

            >

              {t('live.hub.connectCta')}

            </button>

            {brokerSessionExpired ? (

              <button

                type="button"

                onClick={onRefreshSession}

                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${

                  isDark

                    ? 'border-amber-400/40 text-amber-100 hover:bg-amber-500/10'

                    : 'border-amber-300 text-amber-900 hover:bg-amber-100'

                }`}

              >

                {t('practice.refreshSession')}

              </button>

            ) : null}

          </div>

        </div>

      )}



      <PanelCard

        isDark={isDark}

        title={t('live.hub.propFirmTitle')}

        description={t('live.hub.propFirmHint')}

      >

        <div className="grid sm:grid-cols-2 gap-5 items-end">

          <PanelField label={t('practice.propFirmLabel')} isDark={isDark}>

            <select

              value={propFirmId}

              onChange={(e) => onPropFirmChange(e.target.value)}

              className={selectClass}

            >

              {PRACTICE_PROP_FIRMS.map((f) => (

                <option key={f.id} value={f.id}>

                  {f.displayName}

                </option>

              ))}

            </select>

          </PanelField>



          <div className="flex flex-col gap-2">

            <div

              className={`rounded-xl border px-4 py-3 ${

                isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'

              }`}

            >

              <div className="flex items-center gap-2">

                <TrendingUp className={`h-4 w-4 shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />

                <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>

                  {firm.displayName}

                </p>

              </div>

              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>

                {loadingMd

                  ? t('live.hub.loadingAccounts')

                  : accounts.length > 0

                    ? t('live.hub.accountsReady', { count: accounts.length })

                    : t('live.hub.empty')}

              </p>

            </div>



            <div className="flex gap-2">

              <button

                type="button"

                onClick={onRefreshAccounts}

                disabled={loadingMd}

                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${

                  isDark

                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'

                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'

                } disabled:opacity-50`}

              >

                <RefreshCw className={`h-3.5 w-3.5 ${loadingMd ? 'animate-spin' : ''}`} />

                {t('practice.refreshAccounts')}

              </button>

              <button

                type="button"

                disabled={!marketConnected}

                onClick={() => navigate(ROUTES.TRADE)}

                className="flex-1 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed"

              >

                {t('live.hub.openTerminal')}

              </button>

            </div>

          </div>

        </div>

      </PanelCard>



      <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>

        {t('live.hub.riskHint')}{' '}

        <button

          type="button"

          onClick={() => navigate(ROUTES.HOME)}

          className={`underline-offset-2 hover:underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}

        >

          {t('practice.hub.nav.market')}

        </button>

      </p>

    </div>

  )

}

