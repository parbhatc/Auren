import { useEffect, useState } from 'react'
import { practiceAPI, type PracticeTradeRecord } from '../api/practice.api'
import {
  getPracticeAccounts,
  PRACTICE_STORAGE_KEYS,
  refreshPracticeFromApi,
  type PracticeAccount,
} from '../constants/practice'

type PracticeStats = {
  trades?: (PracticeTradeRecord & { id?: string })[]
  totalTrades?: number
  winRate?: number
  totalPnl?: number
}

export function useActivePracticeData() {
  const [account, setAccount] = useState<PracticeAccount | null>(() => {
    const accounts = getPracticeAccounts()
    try {
      const activeId = localStorage.getItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID)
      return accounts.find((item) => item.id === activeId) ?? accounts[0] ?? null
    } catch {
      return accounts[0] ?? null
    }
  })
  const [stats, setStats] = useState<PracticeStats>({})

  useEffect(() => {
    const sync = () => {
      const accounts = getPracticeAccounts()
      let activeId = ''
      try {
        activeId = localStorage.getItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID) || ''
      } catch {
        // Storage is optional.
      }
      setAccount(accounts.find((item) => item.id === activeId) ?? accounts[0] ?? null)
    }
    void refreshPracticeFromApi().then(sync).catch(sync)
    window.addEventListener('practiceAccountsChanged', sync)
    return () => {
      window.removeEventListener('practiceAccountsChanged', sync)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!account) {
      setStats({})
      return
    }
    void practiceAPI
      .getStats(account.id)
      .then((response) => {
        if (!cancelled) setStats(response as PracticeStats)
      })
      .catch(() => {
        if (!cancelled) setStats({})
      })
    return () => {
      cancelled = true
    }
  }, [account])

  return { account, stats }
}
