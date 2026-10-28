import { useEffect, useRef, useState } from 'react'
import { getAuthToken } from '../api/api'
import {
  emptyDashboardData,
  getDashboardAccountSnapshot,
  invalidateDashboardAccountSnapshots,
  loadDashboardAccountData,
  type DashboardAccountData,
} from '../services/dashboard/dashboardAccountData'
import {
  DASHBOARD_ACCOUNT_CHANGED_EVENT,
  getDashboardAccountSelection,
  saveDashboardAccountSelection,
} from '../services/dashboard/dashboardAccountSelection'

export type { DashboardAccountData, DashboardPracticeStats } from '../services/dashboard/dashboardAccountData'

export function useDashboardAccountData(calendarMonth: Date): DashboardAccountData {
  const year = calendarMonth.getFullYear()
  const month = calendarMonth.getMonth()
  const [data, setData] = useState<DashboardAccountData>(() =>
    getDashboardAccountSnapshot(calendarMonth) ?? emptyDashboardData()
  )
  const initialized = useRef(false)
  const persistingSelection = useRef(false)

  useEffect(() => {
    let cancelled = false
    let requestId = 0
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const selectedMonth = new Date(year, month, 1)

    const load = async (refreshPractice: boolean, force = false) => {
      clearTimeout(refreshTimer)
      const currentRequest = ++requestId
      const owner = getAuthToken()
      const isCurrent = () => !cancelled && currentRequest === requestId && owner === getAuthToken()
      const publish = (result: DashboardAccountData) => {
        if (!isCurrent()) return
        if (result.selection) {
          // Notify the header about an automatic fallback without recursively
          // starting another copy of this dashboard request.
          persistingSelection.current = true
          try { saveDashboardAccountSelection(result.selection) } finally { persistingSelection.current = false }
        }
        initialized.current = true
        setData(result)
      }
      const snapshot = getDashboardAccountSnapshot(selectedMonth)
      const saved = getDashboardAccountSelection()
      setData((current) => {
        if (snapshot) return { ...snapshot, refreshing: true }
        const sameAccount = current.selection?.source === saved?.source && current.selection?.accountId === saved?.accountId
        return sameAccount && current.selection
          ? { ...current, refreshing: true, error: '' }
          : { ...emptyDashboardData(), refreshing: true }
      })
      try {
        const result = await loadDashboardAccountData(selectedMonth, {
          refreshPractice, force,
          onProgress: publish,
        })
        publish(result)
      } catch {
        if (isCurrent()) setData((current) => ({
          ...current, loading: false, refreshing: false, error: 'Account statistics could not be loaded.',
        }))
      }
    }

    const selectionChanged = () => {
      if (!persistingSelection.current) void load(false)
    }
    const practiceChanged = () => {
      invalidateDashboardAccountSnapshots('practice')
      if (getDashboardAccountSelection()?.source === 'tradesea') return
      // The practice cache already contains the changed account. Coalesce bursts
      // of updates instead of refetching the account lists for both providers.
      clearTimeout(refreshTimer)
      requestId += 1
      refreshTimer = setTimeout(() => { void load(false, true) }, 100)
    }
    const connectionsChanged = () => {
      invalidateDashboardAccountSnapshots()
      void load(true, true)
    }
    const refreshPractice = !initialized.current
    // Revalidate a revisit even when a recent snapshot is immediately visible:
    // executions placed in Live may have changed P&L since the last visit.
    void load(refreshPractice, refreshPractice)
    window.addEventListener(DASHBOARD_ACCOUNT_CHANGED_EVENT, selectionChanged)
    window.addEventListener('practiceAccountsChanged', practiceChanged)
    window.addEventListener('refreshPropFirms', connectionsChanged)
    return () => {
      cancelled = true
      clearTimeout(refreshTimer)
      window.removeEventListener(DASHBOARD_ACCOUNT_CHANGED_EVENT, selectionChanged)
      window.removeEventListener('practiceAccountsChanged', practiceChanged)
      window.removeEventListener('refreshPropFirms', connectionsChanged)
    }
  }, [year, month])

  return data
}
