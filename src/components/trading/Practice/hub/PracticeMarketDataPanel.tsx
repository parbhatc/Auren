import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react'
import type { BrokerAccountOption } from '../../../../propfirms/marketData/types'
import { panelCardClass } from '../../../../styles/aurenTheme'
import { t } from '../../../../utils/translator'
import MarketDataSection from './MarketDataSection'

const STORAGE_KEY = 'auren-practice-market-panel-open'

function readStoredOpen(fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch {
    /* ignore */
  }
  return fallback
}

function writeStoredOpen(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(open))
  } catch {
    /* ignore */
  }
}

export default function PracticeMarketDataPanel({
  isDark,
  propFirmId,
  marketAccountId,
  marketConnected,
  marketStatusLabel,
  brokerAccounts,
  brokerSessionExpired,
  loadingMd,
  onPropFirmChange,
  onMarketAccountChange,
  onRefreshAccounts,
  onRefreshSession,
}: {
  isDark: boolean
  propFirmId: string
  marketAccountId: string
  marketConnected: boolean
  marketStatusLabel: string
  brokerAccounts: BrokerAccountOption[]
  brokerSessionExpired: boolean
  loadingMd: boolean
  onPropFirmChange: (id: string) => void
  onMarketAccountChange: (accountId: string) => void
  onRefreshAccounts: () => void
  onRefreshSession: () => void
}) {
  const needsAttention = !marketConnected || brokerSessionExpired
  const [open, setOpen] = useState(() => readStoredOpen(needsAttention))

  useEffect(() => {
    if (needsAttention) setOpen(true)
  }, [needsAttention])

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      writeStoredOpen(next)
      return next
    })
  }

  const StatusIcon = marketConnected ? Wifi : WifiOff
  const statusClass = marketConnected
    ? isDark
      ? 'text-sky-400'
      : 'text-sky-600'
    : isDark
      ? 'text-amber-400'
      : 'text-amber-600'

  const shell = panelCardClass(isDark)

  return (
    <div className="w-full">
      <div className={`${shell} !p-0 overflow-hidden`}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left transition-colors ${
            isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
          }`}
        >
          <div
            className={`shrink-0 p-2 rounded-lg ${
              marketConnected
                ? isDark
                  ? 'bg-sky-500/15'
                  : 'bg-sky-50'
                : isDark
                  ? 'bg-amber-500/15'
                  : 'bg-amber-50'
            }`}
          >
            <StatusIcon className={`w-4 h-4 ${statusClass}`} aria-hidden />
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('practice.hub.marketDataTitle')}
            </p>
            <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              {marketConnected
                ? marketStatusLabel || t('practice.hub.nav.connected')
                : t('practice.hub.nav.disconnected')}
            </p>
          </div>

          <span
            className={`hidden sm:inline text-xs font-medium shrink-0 ${
              marketConnected
                ? isDark
                  ? 'text-emerald-400'
                  : 'text-emerald-600'
                : isDark
                  ? 'text-amber-400'
                  : 'text-amber-600'
            }`}
          >
            {marketConnected ? t('practice.hub.nav.connected') : t('practice.hub.nav.disconnected')}
          </span>

          <span className={`shrink-0 p-1.5 rounded-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {open ? <ChevronUp className="w-4 h-4" aria-hidden /> : <ChevronDown className="w-4 h-4" aria-hidden />}
          </span>
        </button>

        {open ? (
          <div
            className={`px-4 sm:px-5 pb-5 pt-0 border-t ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <MarketDataSection
              isDark={isDark}
              propFirmId={propFirmId}
              marketAccountId={marketAccountId}
              marketConnected={marketConnected}
              marketStatusLabel={marketStatusLabel}
              brokerAccounts={brokerAccounts}
              brokerSessionExpired={brokerSessionExpired}
              loadingMd={loadingMd}
              onPropFirmChange={onPropFirmChange}
              onMarketAccountChange={onMarketAccountChange}
              onRefreshAccounts={onRefreshAccounts}
              onRefreshSession={onRefreshSession}
              embedded
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
