import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, RefreshCw } from 'lucide-react'
import { getAuthToken } from '../../api/api'
import { loadDashboardReplaySessions } from '../../services/dashboard/dashboardReplayData'
import { saveDashboardAccountSelection } from '../../services/dashboard/dashboardAccountSelection'
import { subscribeAuthEvents } from '../../services/auth/authEvents'
import { ROUTES } from '../../constants/routes'
import type { BacktestSession } from '../../types/backtester'

export default function ReplayAccountsPanel() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<BacktestSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => subscribeAuthEvents(event => {
    if (event.kind === 'verify-current' || (event.kind === 'unauthorized' && event.token !== getAuthToken())) return
    setAccounts([]); setRevision(value => value + 1)
  }), [])
  useEffect(() => {
    let cancelled = false
    const owner = getAuthToken()
    const current = () => !cancelled && owner === getAuthToken()
    setLoading(true); setError('')
    loadDashboardReplaySessions({ force: true }).then(values => { if (current()) setAccounts(values) })
      .catch(() => { if (current()) setError('Replay accounts could not be loaded.') })
      .finally(() => { if (current()) setLoading(false) })
    return () => { cancelled = true }
  }, [revision])
  return <section id="replay-accounts-panel" role="tabpanel" aria-labelledby="replay-accounts-tab">
    <div className="practice-workspace__connected-heading"><div><h2>Replay accounts</h2><p>Your saved historical replay sessions.</p></div><div className="flex gap-2"><button disabled={loading} onClick={() => setRevision(value => value + 1)} className="practice-workspace__button practice-workspace__button--secondary"><RefreshCw size={14} /> Refresh</button><button onClick={() => navigate(ROUTES.BACKTESTER)} className="practice-workspace__button practice-workspace__button--primary"><Plus size={14} /> Manage replay</button></div></div>
    {error && <p role="alert" className="my-4 text-xs text-red-400">{error}</p>}
    {loading ? <p role="status" className="py-12 text-center text-sm text-[var(--app-muted)]">Loading replay accounts…</p> : !accounts.length ? <div className="practice-workspace__empty"><h3>No replay accounts yet</h3><p>Create a session in Replay to see it here.</p></div> : <div className="practice-workspace__account-grid">{accounts.map(account => <article key={account.id} className="practice-workspace__account-card"><div className="practice-workspace__connected-identity"><h3>{account.name}</h3><p>{account.symbol || 'Replay'} · {account.startDate} · Historical simulation</p></div><div className="practice-workspace__account-footer"><button onClick={() => { saveDashboardAccountSelection({ source: 'replay', accountId: account.id }); navigate(ROUTES.DASHBOARD) }} className="practice-workspace__button practice-workspace__button--account">View overview <ArrowRight size={14} /></button></div></article>)}</div>}
  </section>
}
