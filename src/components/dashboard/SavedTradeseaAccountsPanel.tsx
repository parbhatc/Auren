import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCw, Trash2 } from 'lucide-react'
import { getAuthToken } from '../../api/api'
import { tradeseaAPI, type TradeseaAccount } from '../../api/tradesea.api'
import { ROUTES } from '../../constants/routes'
import { getLucidAccountProfile } from '../../services/dashboard/lucidAccountProfile'
import { saveDashboardAccountSelection } from '../../services/dashboard/dashboardAccountSelection'
import { invalidateDashboardAccountSnapshots } from '../../services/dashboard/dashboardAccountData'
import { subscribeAuthEvents } from '../../services/auth/authEvents'
import LucidAccountDetails from './LucidAccountDetails'
import PlatformLogo from '../common/PlatformLogo'
import ConfirmDialog from '../common/ConfirmDialog'

export default function SavedTradeseaAccountsPanel({ isDark }: { isDark: boolean }) {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<TradeseaAccount[]>([])
  const [live, setLive] = useState<TradeseaAccount[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [remove, setRemove] = useState<TradeseaAccount | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => subscribeAuthEvents(event => {
    if (event.kind === 'verify-current' || (event.kind === 'unauthorized' && event.token !== getAuthToken())) return
    setAccounts([]); setLive([]); setExpanded(null); setRemove(null); setConnected(false); setRevision(value => value + 1)
  }), [])
  useEffect(() => {
    let cancelled = false
    const owner = getAuthToken()
    const current = () => !cancelled && owner === getAuthToken()
    setLoading(true); setError('')
    void (async () => {
      let warning = ''
      try {
        const response = await tradeseaAPI.getAccounts()
        if (!current()) return
        setConnected(response.connected === true)
        setLive(response.connected ? response.accounts || [] : [])
        if (!response.connected) warning = 'Tradesea is disconnected. Your saved accounts and settings are still available.'
      } catch {
        if (!current()) return
        setConnected(false); setLive([])
        warning = 'Tradesea could not be refreshed. Showing your saved accounts.'
      }
      try {
        const response = await tradeseaAPI.getSavedAccounts()
        if (!response.success) throw new Error('Saved accounts could not be loaded.')
        if (current()) { setAccounts(response.accounts); setError(warning) }
      } catch { if (current()) setError('Saved accounts could not be loaded. Try refreshing.') }
      finally { if (current()) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [revision])
  const refresh = () => { invalidateDashboardAccountSnapshots('tradesea'); setRevision(value => value + 1) }
  const removeAccount = async () => {
    if (!remove || busy) return
    const owner = getAuthToken()
    setBusy(true)
    try {
      const response = await tradeseaAPI.removeSavedAccount(remove.id)
      if (owner !== getAuthToken()) return
      if (!response.success) throw new Error()
      setAccounts(values => values.filter(account => account.id !== remove.id)); setRemove(null); refresh()
    } catch { if (owner === getAuthToken()) setError('The saved account could not be removed.') }
    finally { if (owner === getAuthToken()) setBusy(false) }
  }
  const addAccount = async (account: TradeseaAccount) => {
    const owner = getAuthToken()
    setBusy(true)
    try {
      const response = await tradeseaAPI.saveAccountSettings(account.id, { dllEnabled: null, dllAmount: null, consistencyPercent: null, drawdownMethod: null, profitTarget: null, maxLoss: null })
      if (owner !== getAuthToken()) return
      if (!response.success) throw new Error()
      refresh()
    } catch { if (owner === getAuthToken()) setError('The account could not be added.') }
    finally { if (owner === getAuthToken()) setBusy(false) }
  }
  const unsaved = live.filter(account => !account.isArchived && !accounts.some(saved => saved.id === account.id))
  return <section id="connected-accounts-panel" role="tabpanel" aria-labelledby="connected-accounts-tab">
    <div className="practice-workspace__connected-heading">
      <div><h2>Tradesea accounts</h2><p>Accounts and confirmed rules are saved until you remove them.</p></div>
      <button type="button" disabled={loading || busy} onClick={refresh} className="practice-workspace__button practice-workspace__button--secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
    </div>
    {error && <p role="status" className="my-4 text-xs text-[var(--app-muted)]">{error}</p>}
    {loading ? <p role="status" className="py-12 text-center text-sm text-[var(--app-muted)]">Loading saved accounts…</p> : <>
      {!accounts.length && <div className="practice-workspace__empty"><h3>No saved Tradesea accounts</h3><p>Connect Tradesea to import your accounts.</p><button onClick={() => navigate(ROUTES.PROPS_SETTINGS)} className="practice-workspace__button practice-workspace__button--primary">Manage connection</button></div>}
      <div className="practice-workspace__account-grid">
        {accounts.map(account => {
          const profile = getLucidAccountProfile(account)
          const available = connected && account.providerAvailable && !account.isArchived
          return <article key={account.id} className="practice-workspace__account-card practice-workspace__connected-card">
            <div className="practice-workspace__connected-brand-row"><PlatformLogo brand="tradesea" isDark={isDark} className="h-10 w-24" /><span className={available ? 'practice-workspace__positive text-xs' : 'text-xs text-[var(--app-muted)]'}>{available ? 'Available' : account.isArchived ? 'Archived · saved' : 'Saved · offline'}</span></div>
            <div className="practice-workspace__connected-identity"><h3>{account.name || account.label}</h3><p>{profile ? `${profile.title} · ${profile.phase}${profile.size ? ` · ${profile.size / 1000}K balance` : ''}` : account.propFirmDisplayName || account.propFirm || 'Tradesea'}</p></div>
            <div className="mt-4 flex flex-wrap gap-2 px-5 pb-4">
              <button type="button" disabled={!available} onClick={() => { saveDashboardAccountSelection({ source: 'tradesea', accountId: account.id }); navigate(ROUTES.DASHBOARD) }} className="practice-workspace__button practice-workspace__button--secondary">Overview <ArrowRight size={14} /></button>
              {profile && <button type="button" onClick={() => setExpanded(expanded === account.id ? null : account.id)} className="practice-workspace__button practice-workspace__button--secondary">{expanded === account.id ? 'Hide details' : 'Rules & settings'}</button>}
              <button type="button" onClick={() => setRemove(account)} disabled={busy} aria-label={`Remove saved ${account.name || account.label}`} className="ml-auto p-2 text-red-400"><Trash2 size={16} /></button>
            </div>
            {expanded === account.id && profile && <div className="px-5 pb-5"><LucidAccountDetails profile={profile} accountId={account.id} settings={account.ruleSettings} onSettingsSaved={refresh} /></div>}
          </article>
        })}
      </div>
      {unsaved.length > 0 && <details className="mt-5 text-xs text-[var(--app-muted)]"><summary className="cursor-pointer">Add a previously removed account</summary><div className="mt-3 flex flex-wrap gap-2">{unsaved.map(account => <button key={account.id} disabled={busy} className="practice-workspace__button practice-workspace__button--secondary" onClick={() => void addAccount(account)}>Add {account.name || account.label}</button>)}</div></details>}
    </>}
    <ConfirmDialog isOpen={Boolean(remove)} title="Remove saved account?" message="This removes its saved details and confirmed rules from Auren. It does not delete the account at Tradesea or Lucid." confirmText={busy ? 'Removing…' : 'Remove saved account'} onConfirm={() => void removeAccount()} onCancel={() => setRemove(null)} variant="danger" isDark={isDark} />
  </section>
}
