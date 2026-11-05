import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Database,
  Layers3,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  createPracticeAccount,
  deletePracticeAccount,
  evaluatePracticeRules,
  generatePracticeAccountName,
  getPracticeAccounts,
  getPracticeAccountDisplayTitle,
  getPracticeAccountMetaLabel,
  PRACTICE_STORAGE_KEYS,
  refreshPracticeFromApi,
  resetPracticeAccount,
  type PracticeAccount,
  type PracticeAccountMode,
  type PracticeAccountSize,
} from '../../constants/practice'
import { practiceSessionPath, ROUTES } from '../../constants/routes'
import { useTheme } from '../../hooks/useTheme'
import {
  getDefaultPracticeRules,
  PRACTICE_ACCOUNT_SIZES,
  resolvePracticePlanLimits,
  type PracticeAccountRules,
} from '../../services/practice/practicePlans'
import ProductHeader from '../../components/layout/ProductHeader'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import PracticeMarketDataSelector from '../../components/trading/Practice/PracticeMarketDataSelector'
import PlatformLogo from '../../components/common/PlatformLogo'
import { workspaceThemeStyle } from '../../components/layout/WorkspacePrimitives'
import './PracticeWorkspacePage.css'

const SavedTradeseaAccountsPanel = lazy(() => import('../../components/dashboard/SavedTradeseaAccountsPanel'))
const ReplayAccountsPanel = lazy(() => import('../../components/dashboard/ReplayAccountsPanel'))

type AccountManagerTab = 'accounts' | 'connected' | 'replay' | 'create'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function defaultRules(mode: PracticeAccountMode, size: PracticeAccountSize): PracticeAccountRules {
  return {
    ...getDefaultPracticeRules(size, mode),
    ...resolvePracticePlanLimits(size),
  }
}

function statusTone(status: PracticeAccount['status'], isDark: boolean) {
  if (status === 'blown') return isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-700'
  return isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export default function PracticeWorkspacePage() {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [accounts, setAccounts] = useState<PracticeAccount[]>(() => getPracticeAccounts())
  const [mode, setMode] = useState<PracticeAccountMode>('eval')
  const [size, setSize] = useState<PracticeAccountSize>(25000)
  const [displayName, setDisplayName] = useState(() => generatePracticeAccountName('eval', 25000))
  const [rules, setRules] = useState<PracticeAccountRules>(() => defaultRules('eval', 25000))
  const requestedTab = searchParams.get('tab')
  const activeTab: AccountManagerTab = requestedTab === 'connected' || requestedTab === 'replay' || requestedTab === 'create' ? requestedTab : 'accounts'
  const [accountType, setAccountType] = useState<'all' | PracticeAccountMode>('all')
  const [accountStatus, setAccountStatus] = useState<'all' | PracticeAccount['status']>('all')
  const [query, setQuery] = useState('')
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PracticeAccount | null>(null)
  const setActiveTab = (tab: AccountManagerTab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'accounts') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const filteredAccounts = useMemo(() => accounts.filter((account) =>
    (accountType === 'all' || account.mode === accountType) &&
    (accountStatus === 'all' || account.status === accountStatus) &&
    `${getPracticeAccountDisplayTitle(account)} ${getPracticeAccountMetaLabel(account)}`
      .toLowerCase().includes(query.trim().toLowerCase()),
  ), [accounts, accountType, accountStatus, query])

  const planDefaults = useMemo(() => defaultRules(mode, size), [mode, size])
  const planIsCustom = useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(planDefaults),
    [planDefaults, rules],
  )

  const sync = () => setAccounts(getPracticeAccounts())

  useEffect(() => {
    setRules(defaultRules(mode, size))
    setDisplayName(generatePracticeAccountName(mode, size))
  }, [mode, size])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        await refreshPracticeFromApi()
        if (mounted) sync()
      } catch {
        if (mounted) setError('Practice accounts could not be refreshed. Your saved accounts are still shown.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    window.addEventListener('practiceAccountsChanged', sync)
    return () => {
      mounted = false
      window.removeEventListener('practiceAccountsChanged', sync)
    }
  }, [])

  const createAccount = async () => {
    setBusy('create')
    setError('')
    try {
      if (rules.maxLoss <= 0 || (mode === 'eval' && (rules.profitTarget ?? 0) <= 0)) {
        throw new Error('Profit target and maximum loss must be greater than zero.')
      }
      if (!displayName.trim()) throw new Error('Enter an account name.')
      const account = await createPracticeAccount(mode, size, rules, displayName)
      localStorage.setItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID, account.id)
      sync()
      setCustomizeOpen(false)
      setAccountType('all')
      setAccountStatus('all')
      setQuery('')
      setActiveTab('accounts')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the practice account.')
    } finally {
      setBusy(null)
    }
  }

  const openAccount = (account: PracticeAccount) => {
    localStorage.setItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID, account.id)
    window.dispatchEvent(new Event('practiceAccountsChanged'))
    navigate(practiceSessionPath(account.id))
  }

  const resetAccount = async (account: PracticeAccount) => {
    setBusy(`reset:${account.id}`)
    setError('')
    try {
      await resetPracticeAccount(account.id)
      sync()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reset the account.')
    } finally {
      setBusy(null)
    }
  }

  const removeAccount = async () => {
    if (!deleteTarget) return
    setBusy(`delete:${deleteTarget.id}`)
    setError('')
    try {
      await deletePracticeAccount(deleteTarget.id)
      setDeleteTarget(null)
      sync()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete the account.')
    } finally {
      setBusy(null)
    }
  }

  const surface = 'border-[var(--app-border)] bg-[var(--app-panel)]'
  const muted = 'text-[var(--app-muted)]'
  const inputClass = 'h-11 w-full appearance-none rounded-lg border border-[var(--app-border)] bg-[var(--app-inset)] px-3 text-base text-[var(--app-text)] outline-none transition-colors placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent-soft)] sm:text-sm'
  const setNumberRule = (key: keyof PracticeAccountRules, value: string, nullable = false) => {
    const parsed = value === '' && nullable ? null : Number(value)
    setRules((current) => ({ ...current, [key]: Number.isFinite(parsed as number) ? parsed : nullable ? null : 0 }))
  }

  return (
    <div style={workspaceThemeStyle(isDark)} className={`auren-shell-offset practice-workspace min-h-screen ${isDark ? 'practice-workspace--dark' : ''}`}>
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
      <main className="practice-workspace__main">
        <header className="practice-workspace__heading">
          <div>
            <h1>Accounts</h1>
            <p>Manage your practice, Tradesea and replay accounts in one place.</p>
          </div>
        </header>

        <div className="practice-workspace__section-nav">
          <div role="tablist" aria-label="Accounts" className="practice-workspace__tabs">
            <button id="practice-accounts-tab" type="button" role="tab" aria-controls={activeTab === 'create' ? 'practice-create-panel' : 'practice-accounts-panel'} aria-selected={activeTab === 'accounts' || activeTab === 'create'} onClick={() => setActiveTab('accounts')} className={activeTab === 'accounts' || activeTab === 'create' ? 'is-active' : ''}>Practice <span>{accounts.length}</span></button>
            <button id="connected-accounts-tab" type="button" role="tab" aria-label="Tradesea" aria-controls="connected-accounts-panel" aria-selected={activeTab === 'connected'} onClick={() => setActiveTab('connected')} className={activeTab === 'connected' ? 'is-active' : ''}><div aria-hidden="true"><PlatformLogo brand="tradesea" isDark={isDark} className="h-8 w-28" /></div></button>
            <button id="replay-accounts-tab" type="button" role="tab" aria-controls="replay-accounts-panel" aria-selected={activeTab === 'replay'} onClick={() => setActiveTab('replay')} className={activeTab === 'replay' ? 'is-active' : ''}>Replay</button>
          </div>
          <button type="button" onClick={() => navigate(ROUTES.PROPS_SETTINGS)} className="practice-workspace__text-button"><Database size={14} aria-hidden /> Connections <ArrowUpRight size={14} aria-hidden /></button>
        </div>

        {error && (activeTab === 'accounts' || activeTab === 'create') ? <div role="alert" className={`mb-5 flex items-start gap-2 rounded-lg border p-3 text-sm ${isDark ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />{error}</div> : null}



        {(activeTab === 'accounts' || activeTab === 'create') ? <div className="practice-workspace__data-source">
          <PracticeMarketDataSelector isDark={isDark} onOpenConnectionSettings={() => navigate(ROUTES.PROPS_SETTINGS)} />
          <span className="practice-workspace__data-note"><ShieldCheck size={13} aria-hidden /> Simulated accounts. Real market data.</span>
        </div> : null}

        {activeTab === 'connected' ? (
          <Suspense fallback={<p role="status" className="py-12 text-center text-sm">Loading Tradesea accounts…</p>}><SavedTradeseaAccountsPanel isDark={isDark} /></Suspense>
        ) : activeTab === 'replay' ? (
          <Suspense fallback={<p role="status" className="py-12 text-center text-sm">Loading replay accounts…</p>}><ReplayAccountsPanel /></Suspense>
        ) : activeTab === 'create' ? (
        <section id="practice-create-panel" role="tabpanel" aria-labelledby="practice-accounts-tab" className={`practice-workspace__create mb-7 rounded-xl border p-4 sm:p-6 ${surface}`}>
          <div className="practice-workspace__create-heading mb-5">
            <div>
              <p className="practice-workspace__eyebrow">A FRESH START</p>
              <h2 id="create-practice-title" className="mt-2 text-xl font-semibold tracking-tight text-[var(--app-text)]">Make room for your next milestone.</h2>
              <p className={`mt-2 text-sm ${muted}`}>Choose an account, set your guardrails, and make every session count.</p>
            </div>
            <span className="practice-workspace__creation-note"><ShieldCheck size={16} aria-hidden /> Free to practice</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)] lg:items-end">
            <label className={`block text-xs font-medium ${muted}`}>
              Account name
              <span className={`ml-2 font-normal ${muted}`}>Shown in the terminal account selector</span>
              <input
                type="text"
                value={displayName}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setDisplayName(event.target.value)}
                className={`mt-2 ${inputClass}`}
              />
            </label>
            <div>
              <span className={`mb-2 block text-xs font-medium ${muted}`}>Account type</span>
              <div className="grid grid-cols-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-inset)] p-1">
                {(['eval', 'funded'] as PracticeAccountMode[]).map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)} className={`rounded-md px-3 py-2 text-sm font-medium capitalize ${mode === item ? 'bg-[var(--app-button)] text-[var(--app-button-text)]' : muted}`}>{item === 'eval' ? 'Evaluation' : 'Funded'}</button>)}
              </div>
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-[var(--app-text)]">Choose your practice plan</h3>
              <p className={`mt-1 text-xs ${muted}`}>No fees or payments—just select the limits you want to practice with.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {PRACTICE_ACCOUNT_SIZES.map((item) => {
                const selected = size === item
                const cardRules = selected ? rules : defaultRules(mode, item)
                const rows = [
                  ['Profit target', mode === 'eval' ? money.format(cardRules.profitTarget ?? 0) : 'No target'],
                  ['Maximum loss', money.format(cardRules.maxLoss)],
                  ['Drawdown type', cardRules.drawdownType === 'eod' ? 'End of day' : 'Intraday'],
                  ['Consistency', mode === 'eval' && cardRules.consistencyPct != null ? `${cardRules.consistencyPct}%` : 'None'],
                  ['Daily loss limit', cardRules.lockoutEnabled ? money.format(cardRules.dailyLossLimit ?? 0) : 'None'],
                  ['Maximum size', `${cardRules.maxMinis} minis / ${cardRules.maxMicros} micros`],
                ]

                return (
                  <article
                    key={item}
                    className={`relative overflow-hidden rounded-xl border transition-all ${selected ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] ring-1 ring-[var(--app-accent-soft)]' : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:border-[var(--app-accent)]'}`}
                  >
                    {selected ? <div className="absolute inset-x-0 top-0 h-1 bg-[var(--app-accent)]" /> : null}
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSize(item)}
                      className="w-full p-5 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)]">Practice plan</p>
                          <h4 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-text)]">{item / 1000}K {mode === 'eval' ? 'Evaluation' : 'Funded'}</h4>
                          <p className={`mt-1 text-xs ${muted}`}>{money.format(item)} simulated buying power</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${selected ? 'border-[var(--app-button)] bg-[var(--app-button)] text-[var(--app-button-text)]' : 'border-[var(--app-border)] text-[var(--app-muted)]'}`}>
                          {selected ? 'Selected' : 'Select'}
                        </span>
                      </div>
                      <div className="mt-5 border-t border-[var(--app-border)]">
                        {rows.map(([label, value]) => (
                          <div key={label} className="flex min-h-11 items-center justify-between gap-4 border-b border-[var(--app-border)] py-2.5 text-sm last:border-b-0">
                            <span className={muted}>{label}</span>
                            <span className="text-right font-semibold tabular-nums text-[var(--app-secondary)]">{value}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                    {selected ? (
                      <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] bg-[var(--app-inset)] px-5 py-4">
                        <span className={`text-xs font-medium ${muted}`}>{planIsCustom ? 'Custom rules applied' : 'Standard rules'}</span>
                        <button
                          type="button"
                          aria-expanded={customizeOpen}
                          onClick={() => setCustomizeOpen((open) => !open)}
                          className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-hover)] ${surface}`}
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {customizeOpen ? 'Done editing' : 'Edit rules'}
                        </button>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </div>
          {customizeOpen ? <div className="mt-5 rounded-xl border border-[var(--app-border)] bg-[var(--app-inset)] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--app-text)]">Custom rules</h4>
                  <p className={`mt-0.5 text-xs ${muted}`}>Changes apply only to this new account.</p>
                </div>
                <button type="button" onClick={() => setRules(planDefaults)} disabled={!planIsCustom} className="rounded-lg px-3 py-2 text-xs font-semibold text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] disabled:opacity-40">
                  Restore defaults
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {mode === 'eval' ? <label className={`text-xs font-medium ${muted}`}>Profit target ($)<input inputMode="decimal" type="number" min="1" step="50" value={rules.profitTarget ?? ''} onChange={(event) => setNumberRule('profitTarget', event.target.value)} className={`mt-2 ${inputClass}`} /></label> : null}
                <label className={`text-xs font-medium ${muted}`}>Maximum loss ($)<input inputMode="decimal" type="number" min="1" step="50" value={rules.maxLoss} onChange={(event) => setNumberRule('maxLoss', event.target.value)} className={`mt-2 ${inputClass}`} /></label>
                {mode === 'eval' ? <label className={`text-xs font-medium ${muted}`}>Consistency limit (%)<input inputMode="decimal" type="number" min="1" max="100" step="1" value={rules.consistencyPct ?? ''} onChange={(event) => setNumberRule('consistencyPct', event.target.value, true)} className={`mt-2 ${inputClass}`} /></label> : null}
                <label className={`text-xs font-medium ${muted}`}>Drawdown calculation<select value={rules.drawdownType} onChange={(event) => setRules((current) => ({ ...current, drawdownType: event.target.value as PracticeAccountRules['drawdownType'] }))} className={`mt-2 ${inputClass}`}><option value="eod">End of day</option><option value="intraday">Intraday trailing</option></select></label>
                <label className={`text-xs font-medium ${muted}`}>Maximum minis<input inputMode="numeric" type="number" min="1" step="1" value={rules.maxMinis ?? ''} onChange={(event) => setNumberRule('maxMinis', event.target.value)} className={`mt-2 ${inputClass}`} /></label>
                <label className={`text-xs font-medium ${muted}`}>Maximum micros<input inputMode="numeric" type="number" min="1" step="1" value={rules.maxMicros ?? ''} onChange={(event) => setNumberRule('maxMicros', event.target.value)} className={`mt-2 ${inputClass}`} /></label>
                <label className={`text-xs font-medium ${muted}`}>Commission / fill ($)<input inputMode="decimal" type="number" min="0" step="0.01" placeholder="Instrument default" value={rules.commissionPerContract ?? ''} onChange={(event) => setNumberRule('commissionPerContract', event.target.value, true)} className={`mt-2 ${inputClass}`} /></label>
              </div>
              <div className={`mt-5 rounded-lg border p-3 ${surface}`}>
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
                  <span><span className="block text-sm font-medium text-[var(--app-text)]">Daily discipline lockouts</span><span className={`mt-0.5 block text-xs ${muted}`}>Pause trading after a configured loss or trade count.</span></span>
                  <input type="checkbox" checked={rules.lockoutEnabled === true} onChange={(event) => setRules((current) => ({ ...current, lockoutEnabled: event.target.checked }))} className="h-5 w-5 shrink-0 accent-[var(--app-accent)]" />
                </label>
                {rules.lockoutEnabled ? <div className="mt-4 grid gap-4 border-t border-[var(--app-border)] pt-4 sm:grid-cols-2">
                  <label className={`text-xs font-medium ${muted}`}>Daily loss limit ($)<input inputMode="decimal" type="number" min="1" step="50" placeholder="Automatic: 2% capped" value={rules.dailyLossLimit ?? ''} onChange={(event) => setNumberRule('dailyLossLimit', event.target.value, true)} className={`mt-2 ${inputClass}`} /></label>
                  <label className={`text-xs font-medium ${muted}`}>Maximum trades / day<input inputMode="numeric" type="number" min="1" step="1" placeholder="No limit" value={rules.maxTradesPerDay ?? ''} onChange={(event) => setNumberRule('maxTradesPerDay', event.target.value, true)} className={`mt-2 ${inputClass}`} /></label>
                </div> : null}
              </div>
            </div> : null}
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-inset)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text)]">{size / 1000}K {mode === 'eval' ? 'Evaluation' : 'Funded'} selected</p>
              <p className={`mt-1 text-xs ${muted}`}>Creates a simulated account immediately. No purchase or fee.</p>
            </div>
            <button type="button" onClick={() => void createAccount()} disabled={busy === 'create'} className="practice-workspace__button practice-workspace__button--primary min-h-11 px-5 disabled:opacity-50">
              {busy === 'create' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={1.75} />} Create practice account
            </button>
          </div>
        </section>
        ) : (
          <section id="practice-accounts-panel" role="tabpanel" aria-labelledby="practice-accounts-tab">
        {accounts.length > 0 && <div className="mt-5 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Practice accounts</h2>
          <button type="button" onClick={() => setActiveTab('create')} className="practice-workspace__button practice-workspace__button--primary"><Plus size={15} aria-hidden /> Create practice</button>
        </div>}
        <div className="practice-workspace__account-toolbar">
          <div className="practice-workspace__type-filter" role="group" aria-label="Filter by account type">
            {(['all', 'eval', 'funded'] as const).map((type) => (
              <button key={type} type="button" aria-pressed={accountType === type} onClick={() => setAccountType(type)} className={accountType === type ? 'is-active' : ''}>
                {type === 'all' ? 'All accounts' : type === 'eval' ? 'Evaluation' : 'Funded'}
                <span>{accounts.filter((account) => type === 'all' || account.mode === type).length}</span>
              </button>
            ))}
          </div>
          <div className="practice-workspace__search-filters">
            <label className="practice-workspace__search"><Search size={15} aria-hidden /><input aria-label="Search practice accounts" placeholder="Search accounts…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <select aria-label="Filter by account status" value={accountStatus} onChange={(event) => setAccountStatus(event.target.value as typeof accountStatus)} className="practice-workspace__status-filter">
              <option value="all">All statuses</option><option value="active">Active</option><option value="passed">Passed</option><option value="blown">Blown</option>
            </select>
          </div>
        </div>

        {loading && accounts.length === 0 ? (
          <div className="practice-workspace__empty"><RefreshCw className="h-5 w-5 animate-spin" aria-label="Loading accounts" /><p>Loading your practice accounts…</p></div>
        ) : accounts.length === 0 ? (
          <div className="practice-workspace__empty">
            <div className="practice-workspace__empty-icon"><Layers3 size={24} strokeWidth={1.4} aria-hidden /></div>
            <h3>Your next chapter starts here.</h3>
            <p>Create an Evaluation or Funded account and practice with the rules that fit your goals.</p>
            <button type="button" onClick={() => setActiveTab('create')} className="practice-workspace__button practice-workspace__button--primary">
              <Plus size={16} aria-hidden /> Create your first account
            </button>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="practice-workspace__empty">
            <Search size={24} strokeWidth={1.5} aria-hidden /><h3>No accounts match your filters.</h3><p>Try another name, account type, or status.</p>
            <button type="button" className="practice-workspace__button practice-workspace__button--secondary" onClick={() => { setQuery(''); setAccountType('all'); setAccountStatus('all') }}>Clear filters</button>
          </div>
        ) : (
          <div className="practice-workspace__account-grid">
            {filteredAccounts.map((account) => {
              const accountRules = evaluatePracticeRules(account)
              const pnl = account.balance - account.rules.startingBalance
              const progress = account.mode === 'eval' && accountRules.effectiveProfitTarget ? Math.max(0, Math.min(100, (accountRules.totalProfit / accountRules.effectiveProfitTarget) * 100)) : null
              const target = account.mode === 'eval' ? accountRules.effectiveProfitTarget : null
              const cushionProgress = account.rules.maxLoss > 0 ? Math.max(0, Math.min(100, (accountRules.cushion / account.rules.maxLoss) * 100)) : 0
              const limits = resolvePracticePlanLimits(account.size, account.rules)
              return (
                <article key={account.id} className="practice-workspace__account-card">
                  <div className="practice-workspace__account-top">
                    <div className={`practice-workspace__account-symbol ${account.mode === 'funded' ? 'is-funded' : ''}`} aria-hidden>{account.mode === 'funded' ? <ShieldCheck size={20} strokeWidth={1.5} /> : <Layers3 size={20} strokeWidth={1.5} />}</div>
                    <div className="practice-workspace__account-title">
                      <h3 title={getPracticeAccountDisplayTitle(account)}>{getPracticeAccountDisplayTitle(account)}</h3>
                      <p>{getPracticeAccountMetaLabel(account)}</p>
                    </div>
                    <span className={`practice-workspace__account-status inline-flex rounded-full border ${statusTone(account.status, isDark)}`}>{account.status === 'passed' ? <Check size={11} aria-hidden /> : <span />}{account.status}</span>
                  </div>
                  <div className="practice-workspace__account-balance">
                    <div><p className="practice-workspace__metric-label">Account balance</p><p className="practice-workspace__balance-value">{money.format(account.balance)}</p></div>
                    <div className={`practice-workspace__pnl ${pnl > 0 ? 'practice-workspace__positive' : pnl < 0 ? 'practice-workspace__negative' : ''}`}>
                      <p>{pnl < 0 ? <ArrowDownRight size={16} aria-hidden /> : <ArrowUpRight size={16} aria-hidden />}{pnl > 0 ? '+' : ''}{money.format(pnl)}</p><span>Net P&amp;L</span>
                    </div>
                  </div>
                  <div className="practice-workspace__account-progress">
                    <div className="practice-workspace__progress-label"><span>{progress == null ? 'Drawdown cushion' : 'Profit target progress'}</span><strong>{progress == null ? money.format(accountRules.cushion) : `${progress.toFixed(0)}%`}</strong></div>
                    <div className="practice-workspace__progress-track" role="progressbar" aria-label={progress == null ? 'Drawdown cushion remaining' : 'Profit target progress'} aria-valuenow={Math.round(progress ?? cushionProgress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress ?? cushionProgress}%` }} /></div>
                    <div className="practice-workspace__progress-caption"><span>{progress == null ? `${money.format(account.rules.maxLoss)} maximum loss` : `${money.format(Math.max(0, pnl))} of ${money.format(target ?? 0)}`}</span><span>{account.rules.drawdownType === 'eod' ? 'EOD drawdown' : 'Intraday drawdown'}</span></div>
                  </div>
                  <div className="practice-workspace__account-details">
                    <div><span>Loss cushion</span><strong className={accountRules.cushion <= 0 ? 'practice-workspace__negative' : ''}>{money.format(accountRules.cushion)}</strong></div>
                    <div><span>Profitable days</span><strong>{accountRules.profitableDaysCount}{account.mode === 'eval' && accountRules.minProfitableDaysRequired > 0 ? <small> / {accountRules.minProfitableDaysRequired}</small> : null}</strong></div>
                    <div><span>Max contracts</span><strong>{limits.maxMinis} <small>minis</small></strong></div>
                  </div>
                  {accountRules.consistencyMessage ? <p className="practice-workspace__account-notice"><AlertTriangle size={12} aria-hidden />{accountRules.consistencyMessage}</p> : null}
                  <div className="practice-workspace__account-footer">
                    <button type="button" onClick={() => openAccount(account)} className="practice-workspace__button practice-workspace__button--account">Open account <ArrowRight size={16} aria-hidden /></button>
                    <span className="practice-workspace__account-actions">
                      <button type="button" title="Reset account" aria-label={`Reset ${getPracticeAccountDisplayTitle(account)}`} onClick={() => void resetAccount(account)} disabled={busy === `reset:${account.id}`}><RotateCcw size={15} className={busy === `reset:${account.id}` ? 'animate-spin' : ''} strokeWidth={1.7} /></button>
                      <button type="button" title="Delete account" aria-label={`Delete ${getPracticeAccountDisplayTitle(account)}`} onClick={() => setDeleteTarget(account)} className="is-danger"><Trash2 size={15} strokeWidth={1.7} /></button>
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
        <p className="practice-workspace__footnote"><ShieldCheck size={13} aria-hidden /> All balances and results are simulated. Practice accounts do not involve real capital.</p>
          </section>
        )}
      </main>

      <ConfirmDialog isOpen={Boolean(deleteTarget)} title="Delete practice account?" message={deleteTarget ? `${getPracticeAccountDisplayTitle(deleteTarget)} and its simulated history will be removed.` : ''} confirmText={busy?.startsWith('delete:') ? 'Deleting…' : 'Delete account'} cancelText="Cancel" onConfirm={() => void removeAccount()} onCancel={() => setDeleteTarget(null)} variant="danger" isDark={isDark} />
    </div>
  )
}
