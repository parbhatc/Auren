import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Play, TrendingDown, TrendingUp } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { backtesterAPI } from '../../../api/backtester.api'
import { authAPI } from '../../../api/auth.api'
import { ROUTES } from '../../../constants/routes'
import type { BacktestSession } from '../../../types/backtester'
import BacktesterPageShell from '../shared/BacktesterPageShell'
import HubHeroSection from '../../trading/Practice/hub/HubHeroSection'
import Loading from '../../common/Loading'
import {
  emptyStateClass,
  panelCardClass,
  primaryButtonClass,
  selectInputClass,
} from '../../../styles/aurenTheme'
import { t } from '../../../utils/translator'

type BacktestTrade = {
  id: string
  session_id: string
  symbol: string
  direction: string
  entry_price: number
  exit_price: number | null
  contracts: number
  entry_time: string
  exit_time: string | null
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTradeTime(ts: string | number): string {
  const n = typeof ts === 'string' ? Number(ts) : ts
  if (!n) return '—'
  const ms = n < 1e12 ? n * 1000 : n
  return new Date(ms).toLocaleString()
}

export default function BacktesterStatsPage() {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<BacktestSession[]>([])
  const [trades, setTrades] = useState<BacktestTrade[]>([])
  const [sessionStats, setSessionStats] = useState<{
    balance: number
    realizedPnL: number
    initialBalance: number
  } | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)

  const sessionId = searchParams.get('sessionId') || sessions[0]?.id || ''
  const currentSession = sessions.find((s) => s.id === sessionId) ?? null

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate(ROUTES.LOGIN)
          return
        }
        const userRes = await authAPI.validateToken(token)
        setShowAdmin(Boolean(userRes.user?.isAdmin))

        const sessionsRes = await backtesterAPI.getSessions()
        if (sessionsRes.success) {
          setSessions(sessionsRes.sessions)
          if (!searchParams.get('sessionId') && sessionsRes.sessions[0]) {
            setSearchParams({ sessionId: sessionsRes.sessions[0].id }, { replace: true })
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [navigate, searchParams, setSearchParams])

  useEffect(() => {
    if (!sessionId) return
    const loadSessionData = async () => {
      try {
        const [statsRes, tradesRes] = await Promise.all([
          backtesterAPI.getSessionStats(sessionId),
          backtesterAPI.getTrades({ sessionId }),
        ])
        if (statsRes.success) {
          setSessionStats({
            balance: statsRes.balance,
            realizedPnL: statsRes.realizedPnL,
            initialBalance: statsRes.initialBalance,
          })
        }
        if (tradesRes.success) {
          setTrades(tradesRes.trades as BacktestTrade[])
        }
      } catch {
        setSessionStats(null)
        setTrades([])
      }
    }
    loadSessionData()
  }, [sessionId])

  const computed = useMemo(() => {
    const closed = trades.filter((tr) => tr.exit_price != null)
    const wins = closed.filter((tr) => {
      if (tr.direction?.toLowerCase() === 'short') {
        return tr.exit_price! < tr.entry_price
      }
      return tr.exit_price! > tr.entry_price
    })
    const winRate = closed.length ? (wins.length / closed.length) * 100 : 0
    return { closed: closed.length, open: trades.length - closed.length, winRate }
  }, [trades])

  if (loading) return <Loading isDark={isDark} />

  return (
    <BacktesterPageShell
      isDark={isDark}
      toggleTheme={toggleTheme}
      navigate={navigate}
      activeTab="stats"
      showAdmin={showAdmin}
    >
      <HubHeroSection
        isDark={isDark}
        icon={BarChart3}
        badge={t('backtester.stats.badge', {}, 'Performance')}
        headline={t('backtester.stats.title', {}, 'Backtest Statistics')}
        subtitle={t(
          'backtester.stats.subtitle',
          {},
          'Review trade history, win rate, and P/L for each replay session.'
        )}
        accent="sky"
      />

      {sessions.length === 0 ? (
        <div className={emptyStateClass(isDark)}>
          <p className={`text-lg font-medium mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {t('backtester.noSessions')}
          </p>
          <button type="button" onClick={() => navigate(ROUTES.BACKTESTER)} className={primaryButtonClass()}>
            {t('backtester.createSession')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('backtester.session', {}, 'Session')}
              </label>
              <select
                value={sessionId}
                onChange={(e) => setSearchParams({ sessionId: e.target.value })}
                className={selectInputClass(isDark)}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.symbol}
                  </option>
                ))}
              </select>
            </div>
            {currentSession && (
              <button
                type="button"
                onClick={() => navigate(`${ROUTES.BACKTESTER_CHART}?sessionId=${currentSession.id}`)}
                className={`inline-flex items-center gap-2 shrink-0 ${primaryButtonClass()}`}
              >
                <Play className="w-4 h-4" />
                {t('backtester.resumeReplay', {}, 'Resume replay')}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {[
              {
                label: t('backtester.balance', {}, 'Balance'),
                value: `$${formatMoney(sessionStats?.balance ?? currentSession?.currentBalance ?? 50000)}`,
                icon: TrendingUp,
                accent: isDark ? 'text-violet-400' : 'text-violet-600',
                bg: isDark ? 'bg-violet-500/10' : 'bg-violet-50',
              },
              {
                label: t('backtester.stats.realizedPnl', {}, 'Realized P/L'),
                value: `${(sessionStats?.realizedPnL ?? 0) >= 0 ? '+' : ''}$${formatMoney(Math.abs(sessionStats?.realizedPnL ?? 0))}`,
                icon: (sessionStats?.realizedPnL ?? 0) >= 0 ? TrendingUp : TrendingDown,
                accent: (sessionStats?.realizedPnL ?? 0) >= 0
                  ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                  : isDark ? 'text-red-400' : 'text-red-600',
                bg: (sessionStats?.realizedPnL ?? 0) >= 0
                  ? isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                  : isDark ? 'bg-red-500/10' : 'bg-red-50',
              },
              {
                label: t('backtester.winRate', {}, 'Win rate'),
                value: `${computed.winRate.toFixed(1)}%`,
                icon: BarChart3,
                accent: isDark ? 'text-sky-400' : 'text-sky-600',
                bg: isDark ? 'bg-sky-500/10' : 'bg-sky-50',
              },
              {
                label: t('backtester.totalTrades', {}, 'Trades'),
                value: `${computed.closed} closed · ${computed.open} open`,
                icon: BarChart3,
                accent: isDark ? 'text-slate-300' : 'text-slate-600',
                bg: isDark ? 'bg-slate-700/50' : 'bg-slate-100',
              },
            ].map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.label}
                  className={`rounded-xl border p-3 sm:p-4 ${
                    isDark ? 'border-slate-800/80 bg-slate-900/50' : 'border-slate-200/90 bg-white/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-[10px] sm:text-xs font-medium uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {card.label}
                      </p>
                      <p className={`text-sm sm:text-lg font-bold mt-1 tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {card.value}
                      </p>
                    </div>
                    <div className={`p-1.5 rounded-lg shrink-0 ${card.bg}`}>
                      <Icon className={`w-4 h-4 ${card.accent}`} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <section className={panelCardClass(isDark)}>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('backtester.tradeHistory', {}, 'Trade history')}
            </h2>
            {trades.length === 0 ? (
              <p className={`text-sm py-8 text-center ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {t('backtester.noTrades', {}, 'No trades recorded for this session yet.')}
              </p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left text-xs uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      <th className="pb-3 pr-4 font-medium">Symbol</th>
                      <th className="pb-3 pr-4 font-medium">Side</th>
                      <th className="pb-3 pr-4 font-medium">Qty</th>
                      <th className="pb-3 pr-4 font-medium">Entry</th>
                      <th className="pb-3 pr-4 font-medium">Exit</th>
                      <th className="pb-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                    {trades.map((trade) => (
                      <tr key={trade.id} className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                        <td className="py-2.5 pr-4 font-medium">{trade.symbol}</td>
                        <td className="py-2.5 pr-4 capitalize">{trade.direction}</td>
                        <td className="py-2.5 pr-4 tabular-nums">{trade.contracts}</td>
                        <td className="py-2.5 pr-4 tabular-nums">{trade.entry_price}</td>
                        <td className="py-2.5 pr-4 tabular-nums">{trade.exit_price ?? '—'}</td>
                        <td className="py-2.5 tabular-nums text-xs">{formatTradeTime(trade.entry_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </BacktesterPageShell>
  )
}
