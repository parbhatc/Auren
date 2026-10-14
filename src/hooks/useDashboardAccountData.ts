import { useEffect, useState } from 'react'
import { practiceAPI, type PracticeTradeRecord } from '../api/practice.api'
import { tradeseaAPI, type TradeseaAccount } from '../api/tradesea.api'
import {
  getPracticeAccounts,
  PRACTICE_STORAGE_KEYS,
  refreshPracticeFromApi,
  type PracticeAccount,
  type PracticeDayPnL,
} from '../constants/practice'
import {
  type TradeseaTradelensDashboard,
  type TradeseaCalendarDay,
  formatLocalDate,
  monthDateRangeLocal,
} from '../services/tradesea/tradeseaTradelensStats'
import {
  DASHBOARD_ACCOUNT_CHANGED_EVENT,
  getDashboardAccountSelection,
  saveDashboardAccountSelection,
  type DashboardAccountSelection,
} from '../services/dashboard/dashboardAccountSelection'

export interface DashboardPracticeStats {
  trades?: (PracticeTradeRecord & { id?: string })[]
  totalTrades?: number
  winRate?: number
  totalPnl?: number
}

export interface DashboardAccountData {
  selection: DashboardAccountSelection | null
  practiceAccount: PracticeAccount | null
  tradeseaAccount: TradeseaAccount | null
  practiceStats: DashboardPracticeStats
  tradeseaDashboard: TradeseaTradelensDashboard | null
  days: PracticeDayPnL[]
  loading: boolean
  error: string
}

function resolveSelection(
  practiceAccounts: PracticeAccount[],
  tradeseaAccounts: TradeseaAccount[]
): DashboardAccountSelection | null {
  const saved = getDashboardAccountSelection()
  if (
    saved?.source === 'practice' &&
    practiceAccounts.some((account) => account.id === saved.accountId)
  ) return saved
  if (
    saved?.source === 'tradesea' &&
    tradeseaAccounts.some((account) => account.id === saved.accountId && !account.isArchived)
  ) return saved

  let activePracticeId = ''
  try {
    activePracticeId = localStorage.getItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID) || ''
  } catch {
    // Storage is optional.
  }
  const practice = practiceAccounts.find((account) => account.id === activePracticeId) ?? practiceAccounts[0]
  if (practice) return { source: 'practice', accountId: practice.id }
  const tradesea = tradeseaAccounts.find((account) => !account.isArchived)
  return tradesea ? { source: 'tradesea', accountId: tradesea.id } : null
}

function dashboardMonthRange(month: Date) {
  const today = new Date()
  const range = monthDateRangeLocal(month.getFullYear(), month.getMonth())
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  return { from: range.startDate, to: isCurrentMonth ? formatLocalDate(today) : range.endDate }
}

export function useDashboardAccountData(calendarMonth: Date): DashboardAccountData {
  const [data, setData] = useState<DashboardAccountData>({
    selection: null,
    practiceAccount: null,
    tradeseaAccount: null,
    practiceStats: {},
    tradeseaDashboard: null,
    days: [],
    loading: true,
    error: '',
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setData((current) => ({ ...current, loading: true, error: '' }))
      await refreshPracticeFromApi()
      const practiceAccounts = getPracticeAccounts()
      let tradeseaAccounts: TradeseaAccount[] = []
      try {
        const response = await tradeseaAPI.getAccounts()
        if (response.connected && Array.isArray(response.accounts)) {
          tradeseaAccounts = response.accounts
        }
      } catch {
        // The dashboard still works with Auren practice accounts when Tradesea is unavailable.
      }

      const selection = resolveSelection(practiceAccounts, tradeseaAccounts)
      if (!selection) {
        if (!cancelled) {
          setData((current) => ({ ...current, selection: null, loading: false, error: 'No account is available.' }))
        }
        return
      }

      const saved = getDashboardAccountSelection()
      if (!saved || saved.source !== selection.source || saved.accountId !== selection.accountId) {
        saveDashboardAccountSelection(selection)
      }

      if (selection.source === 'practice') {
        const practiceAccount = practiceAccounts.find((account) => account.id === selection.accountId) ?? null
        if (!practiceAccount) return
        try {
          const practiceStats = await practiceAPI.getStats(practiceAccount.id) as DashboardPracticeStats
          if (!cancelled) {
            setData({
              selection,
              practiceAccount,
              tradeseaAccount: null,
              practiceStats,
              tradeseaDashboard: null,
              days: practiceAccount.dayPnL ?? [],
              loading: false,
              error: '',
            })
          }
        } catch {
          if (!cancelled) {
            setData({
              selection,
              practiceAccount,
              tradeseaAccount: null,
              practiceStats: {},
              tradeseaDashboard: null,
              days: practiceAccount.dayPnL ?? [],
              loading: false,
              error: 'Practice statistics could not be loaded.',
            })
          }
        }
        return
      }

      const tradeseaAccount = tradeseaAccounts.find((account) => account.id === selection.accountId) ?? null
      if (!tradeseaAccount) return
      const { from, to } = dashboardMonthRange(calendarMonth)
      try {
        const [dashboardResponse, calendarResponse] = await Promise.all([
          tradeseaAPI.getTradelensDashboard({ accountId: tradeseaAccount.id, from, to }),
          tradeseaAPI.getTradelensCalendar({ accountId: tradeseaAccount.id, from, to }),
        ])
        const dashboard = dashboardResponse.s === 'success'
          ? dashboardResponse.d as TradeseaTradelensDashboard
          : null
        const calendarDays = calendarResponse.s === 'success' && Array.isArray(calendarResponse.d?.pnlAndTradeCountCalendar)
          ? calendarResponse.d.pnlAndTradeCountCalendar as TradeseaCalendarDay[]
          : dashboard?.pnlAndTradeCountCalendar ?? []
        if (!cancelled) {
          setData({
            selection,
            practiceAccount: null,
            tradeseaAccount,
            practiceStats: {},
            tradeseaDashboard: dashboard,
            days: calendarDays.map((day) => ({
              date: String(day.date || '').split('T')[0],
              pnl: Number(day.pnl) || 0,
            })),
            loading: false,
            error: dashboard ? '' : dashboardResponse.error || 'Tradesea statistics could not be loaded.',
          })
        }
      } catch {
        if (!cancelled) {
          setData({
            selection,
            practiceAccount: null,
            tradeseaAccount,
            practiceStats: {},
            tradeseaDashboard: null,
            days: [],
            loading: false,
            error: 'Tradesea statistics could not be loaded.',
          })
        }
      }
    }

    void load()
    window.addEventListener(DASHBOARD_ACCOUNT_CHANGED_EVENT, load)
    window.addEventListener('practiceAccountsChanged', load)
    window.addEventListener('refreshPropFirms', load)
    return () => {
      cancelled = true
      window.removeEventListener(DASHBOARD_ACCOUNT_CHANGED_EVENT, load)
      window.removeEventListener('practiceAccountsChanged', load)
      window.removeEventListener('refreshPropFirms', load)
    }
  }, [calendarMonth])

  return data
}
