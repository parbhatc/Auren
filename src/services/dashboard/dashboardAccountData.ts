import { getAuthToken } from '../../api/api'
import { practiceAPI, type PracticeTradeRecord } from '../../api/practice.api'
import { tradeseaAPI, type TradeseaAccount } from '../../api/tradesea.api'
import {
  getPracticeAccounts, PRACTICE_STORAGE_KEYS, refreshPracticeFromApi,
  type PracticeAccount, type PracticeDayPnL,
} from '../../constants/practice'
import {
  formatLocalDate, monthDateRangeLocal, type TradeseaTradelensDashboard,
} from '../tradesea/tradeseaTradelensStats'
import { getDashboardAccountSelection, type DashboardAccountSelection } from './dashboardAccountSelection'
import type { BacktestSession } from '../../types/backtester'
import { loadDashboardReplayData, loadDashboardReplaySessions } from './dashboardReplayData'

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
  replaySession: BacktestSession | null
  replayStats: DashboardPracticeStats
  replayBalance: number | null
  replayInitialBalance: number | null
  practiceStats: DashboardPracticeStats
  tradeseaDashboard: TradeseaTradelensDashboard | null
  days: PracticeDayPnL[]
  loading: boolean
  refreshing: boolean
  error: string
}

export function emptyDashboardData(): DashboardAccountData {
  return {
    selection: null, practiceAccount: null, tradeseaAccount: null,
    practiceStats: {}, tradeseaDashboard: null, replaySession: null,
    replayStats: {}, replayBalance: null, replayInitialBalance: null, days: [],
    loading: true, refreshing: false, error: '',
  }
}

const SNAPSHOT_TTL_MS = 30_000
const snapshots = new Map<string, { data: DashboardAccountData; fetchedAt: number }>()
const requests = new Map<string, Promise<unknown>>()
type SnapshotRevisions = Record<DashboardAccountSelection['source'], number>
const snapshotRevisions: SnapshotRevisions = { practice: 0, tradesea: 0, replay: 0 }

function monthRange(month: Date) {
  const today = new Date()
  const range = monthDateRangeLocal(month.getFullYear(), month.getMonth())
  return {
    from: range.startDate,
    to: month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
      ? formatLocalDate(today) : range.endDate,
  }
}

function cacheKey(selection: DashboardAccountSelection, month: Date): string {
  const { from, to } = monthRange(month)
  return JSON.stringify([getAuthToken(), selection.source, selection.accountId,
    selection.source === 'tradesea' ? `${from}:${to}` : 'all'])
}

function requestOnce<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = requests.get(key)
  if (existing) return existing as Promise<T>
  const request = Promise.resolve().then(load).finally(() => {
    if (requests.get(key) === request) requests.delete(key)
  })
  requests.set(key, request)
  return request
}

export function getDashboardAccountSnapshot(month: Date): DashboardAccountData | null {
  const selection = getDashboardAccountSelection()
  return selection ? snapshots.get(cacheKey(selection, month))?.data ?? null : null
}

export function invalidateDashboardAccountSnapshots(source?: DashboardAccountSelection['source']): void {
  if (source) snapshotRevisions[source] += 1
  else {
    snapshotRevisions.practice += 1
    snapshotRevisions.tradesea += 1
    snapshotRevisions.replay += 1
  }
  for (const [key, snapshot] of snapshots) {
    if (!source || snapshot.data.selection?.source === source) snapshots.delete(key)
  }
}

function remember(month: Date, data: DashboardAccountData, revisions: SnapshotRevisions): DashboardAccountData {
  if (data.selection && revisions[data.selection.source] === snapshotRevisions[data.selection.source] && !data.error) {
    const key = cacheKey(data.selection, month)
    snapshots.delete(key)
    snapshots.set(key, { data: { ...data, refreshing: false }, fetchedAt: Date.now() })
    if (snapshots.size > 24) snapshots.delete(snapshots.keys().next().value)
  }
  return data
}

function practiceSelection(accounts: PracticeAccount[], saved: DashboardAccountSelection | null) {
  if (saved?.source === 'practice' && accounts.some((account) => account.id === saved.accountId)) return saved
  let activeId = ''
  try { activeId = localStorage.getItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID) || '' } catch { /* Storage is optional. */ }
  const account = accounts.find((item) => item.id === activeId) ?? accounts[0]
  return account ? { source: 'practice' as const, accountId: account.id } : null
}

export async function loadDashboardAccountData(
  month: Date,
  options: {
    refreshPractice?: boolean
    force?: boolean
    onProgress?: (data: DashboardAccountData) => void
  } = {}
): Promise<DashboardAccountData> {
  const owner = getAuthToken()
  const revisions = { ...snapshotRevisions }
  const saved = getDashboardAccountSelection()
  let accounts: TradeseaAccount[] | null = null
  let replaySessions: BacktestSession[] | null = null
  const loadReplaySessions = async () => {
    // Catalog invalidation has its own event/TTL. A forced financial refresh
    // must not cancel the header's simultaneous read of this shared catalog.
    if (!replaySessions) replaySessions = await loadDashboardReplaySessions()
    return replaySessions
  }
  const loadTradeseaAccounts = async () => {
    if (accounts) return accounts
    try {
      const response = await tradeseaAPI.getAccounts()
      accounts = response.connected && Array.isArray(response.accounts) ? response.accounts : []
    } catch { accounts = [] }
    return accounts
  }

  // A disconnected provider must not sit in front of an available practice
  // account's statistics. Only discover the other provider for a fallback.
  let selection: DashboardAccountSelection | null = null
  if (saved?.source === 'replay') {
    try {
      const sessions = await loadReplaySessions()
      if (sessions.some((session) => session.id === saved.accountId)) selection = saved
    } catch {
      // A failed catalog read is not evidence that the selected session was
      // removed. Preserve selection rather than silently choosing an account.
      return { ...emptyDashboardData(), selection: saved, loading: false, error: 'Replay sessions could not be loaded.' }
    }
  }
  if (saved?.source === 'tradesea') {
    const live = await loadTradeseaAccounts()
    if (live.some((account) => account.id === saved.accountId && !account.isArchived)) selection = saved
  }
  if (!selection) {
    if (options.refreshPractice !== false) await refreshPracticeFromApi()
    selection = practiceSelection(getPracticeAccounts(), saved)
    if (!selection) {
      const live = (await loadTradeseaAccounts()).find((account) => !account.isArchived)
      if (live) selection = { source: 'tradesea', accountId: live.id }
    }
    if (!selection) {
      try {
        const session = (await loadReplaySessions())[0]
        if (session) selection = { source: 'replay', accountId: session.id }
      } catch {
        return { ...emptyDashboardData(), loading: false, error: 'Replay sessions could not be loaded.' }
      }
    }
  }
  if (!selection) return { ...emptyDashboardData(), loading: false, error: 'No account is available.' }

  const key = cacheKey(selection, month)
  const cached = snapshots.get(key)
  const practiceAccount = selection.source === 'practice'
    ? getPracticeAccounts().find((account) => account.id === selection.accountId) ?? null : null
  const cacheMatchesAccount = !practiceAccount || cached?.data.practiceAccount?.updatedAt === practiceAccount.updatedAt
  if (!options.force && cached && Date.now() - cached.fetchedAt < SNAPSHOT_TTL_MS && cacheMatchesAccount) {
    return { ...cached.data, ...(practiceAccount ? { practiceAccount, days: practiceAccount.dayPnL ?? [] } : {}) }
  }

  if (selection.source === 'replay') {
    const replaySession = replaySessions?.find((session) => session.id === selection.accountId) ?? null
    const data = { ...emptyDashboardData(), selection, replaySession, loading: false }
    if (!replaySession) return { ...data, error: 'The replay session is no longer available.' }
    try {
      const replay = await requestOnce(
        JSON.stringify([owner, 'replay-stats', replaySession.id, revisions.replay]),
        () => loadDashboardReplayData(replaySession),
      )
      const result = {
        ...data, replayStats: replay.stats, replayBalance: replay.balance,
        replayInitialBalance: replay.initialBalance, days: replay.days, error: replay.message ?? '',
      }
      return owner === getAuthToken() ? remember(month, result, revisions) : data
    } catch {
      return { ...data, error: 'Replay statistics could not be loaded.' }
    }
  }

  if (practiceAccount) {
    const data = {
      ...emptyDashboardData(), selection, practiceAccount,
      days: practiceAccount.dayPnL ?? [], loading: false,
    }
    try {
      const practiceStats = await requestOnce(
        JSON.stringify([owner, 'stats', practiceAccount.id, practiceAccount.updatedAt, revisions.practice]),
        () => practiceAPI.getStats(practiceAccount.id)
      ) as DashboardPracticeStats
      return owner === getAuthToken() ? remember(month, { ...data, practiceStats }, revisions) : data
    } catch {
      return { ...data, error: 'Practice statistics could not be loaded.' }
    }
  }

  const tradeseaAccount = accounts?.find((account) => account.id === selection.accountId) ?? null
  if (!tradeseaAccount) return { ...emptyDashboardData(), loading: false, error: 'No account is available.' }
  const { from, to } = monthRange(month)
  const body = { accountId: tradeseaAccount.id, from, to }
  const data = { ...emptyDashboardData(), selection, tradeseaAccount, loading: false }
  // Publish the dashboard as soon as it is ready. A slow calendar endpoint
  // must not prevent the statistics cards and navigation from being usable.
  const calendarRequest = requestOnce(`${key}:calendar:${revisions.tradesea}`, () => tradeseaAPI.getTradelensCalendar(body))
    .then((response) => response.s === 'success' ? response.d?.pnlAndTradeCountCalendar : undefined)
    .catch(() => undefined)
  try {
    const response = await requestOnce(`${key}:dashboard:${revisions.tradesea}`, () => tradeseaAPI.getTradelensDashboard(body))
    const dashboard = response.s === 'success' ? response.d as TradeseaTradelensDashboard : null
    const dashboardDays = dashboard?.pnlAndTradeCountCalendar ?? []
    const toDays = (days: typeof dashboardDays) => days.map((day) => ({
      date: String(day.date || '').split('T')[0], pnl: Number(day.pnl) || 0,
    }))
    const result = {
      ...data, tradeseaDashboard: dashboard, days: toDays(dashboardDays),
      error: dashboard ? '' : response.error || 'Tradesea statistics could not be loaded.',
    }
    if (owner === getAuthToken()) {
      // A route return must reuse the visible cards even while the independent
      // calendar is still pending. The completed calendar updates this snapshot.
      remember(month, result, revisions)
      options.onProgress?.({ ...result, refreshing: true })
    }
    const calendarDays = await calendarRequest
    const completed = { ...result, days: toDays(calendarDays ?? dashboardDays) }
    return owner === getAuthToken() ? remember(month, completed, revisions) : completed
  } catch {
    return { ...data, error: 'Tradesea statistics could not be loaded.' }
  }
}
