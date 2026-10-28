import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getAuthToken } from '../../api/api'
import { registerAurenChartIndicators } from '../../chart/aurenChartBoot'
import TradePage, { TerminalBootScreen } from '../../components/trading/Practice/TradePage'
import {
  getPracticeAccounts, PRACTICE_STORAGE_KEYS, refreshPracticeFromApi,
} from '../../constants/practice'
import { ROUTES } from '../../constants/routes'
import { useTheme } from '../../hooks/useTheme'
import { selectPracticeTerminalAccount } from '../../services/practice/practiceTerminalSelection'
import { traceStartup } from '../../services/debug/startupTrace'

export default function PracticeTerminalPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [accountId, setAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const selectedAccountId = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    let ready = false
    selectedAccountId.current = null
    const owner = getAuthToken()
    const isCurrent = () => active && owner === getAuthToken()
    const syncAccount = () => {
      if (!ready || !isCurrent()) return
      const accounts = getPracticeAccounts()
      let savedId: string | null = null
      try { savedId = localStorage.getItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID) } catch { /* Storage is optional. */ }
      // Let the mounted terminal display its passed/blown modal. Only a new
      // visit or an explicit selection chooses another active account.
      const current = selectedAccountId.current
      if (current && current === savedId && accounts.some((account) => account.id === current)) return
      const selected = selectPracticeTerminalAccount(accounts, savedId)
      if (selected && selected.id !== savedId) {
        try { localStorage.setItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID, selected.id) } catch { /* Storage is optional. */ }
      }
      selectedAccountId.current = selected?.id ?? null
      if (selected) void registerAurenChartIndicators().catch(() => undefined)
      setAccountId(selectedAccountId.current)
    }
    setLoading(true)
    setError('')
    traceStartup('practice-account-start')
    void refreshPracticeFromApi({ strict: true }).then(() => {
      if (!isCurrent()) return
      ready = true
      syncAccount()
      setLoading(false)
      traceStartup('practice-account-ready')
    }).catch((caught) => {
      if (!isCurrent()) return
      setError('Your practice accounts could not be loaded. Please try again.')
      setLoading(false)
      traceStartup('practice-account-error')
    })
    window.addEventListener('practiceAccountsChanged', syncAccount)
    return () => {
      active = false
      window.removeEventListener('practiceAccountsChanged', syncAccount)
    }
  }, [attempt])

  if (loading) return <TerminalBootScreen isDark={isDark} />
  if (error) return (
    <div className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-[#09090B] text-[#FAFAFA]' : 'bg-[#FAFAFA] text-[#09090B]'}`}>
      <div className="max-w-sm space-y-4 rounded-xl border border-zinc-500/30 p-6">
        <p role="alert" className="text-sm">{error}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setAttempt((current) => current + 1)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Try again</button>
          <button type="button" onClick={() => navigate(ROUTES.PRACTICE_ACCOUNTS)} className="rounded-lg border border-zinc-500/30 px-4 py-2 text-sm font-semibold">Manage accounts</button>
        </div>
      </div>
    </div>
  )
  if (!accountId) return <Navigate to={ROUTES.PRACTICE_ACCOUNTS} replace />
  return <TradePage key={accountId} practiceAccountId={accountId} accountCatalogReady />
}
