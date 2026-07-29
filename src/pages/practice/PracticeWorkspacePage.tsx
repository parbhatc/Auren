import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronRight,
  Database,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
  if (status === 'passed') return isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'blown') return isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-700'
  return isDark ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-blue-200 bg-blue-50 text-blue-700'
}

export default function PracticeWorkspacePage() {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<PracticeAccount[]>(() => getPracticeAccounts())
  const [mode, setMode] = useState<PracticeAccountMode>('eval')
  const [size, setSize] = useState<PracticeAccountSize>(25000)
  const [displayName, setDisplayName] = useState(() => generatePracticeAccountName('eval', 25000))
  const [rules, setRules] = useState<PracticeAccountRules>(() => defaultRules('eval', 25000))
  const [activeTab, setActiveTab] = useState<'accounts' | 'create'>('accounts')
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PracticeAccount | null>(null)

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

  const surface = isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'
  const muted = isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'
  const inputClass = `h-11 w-full appearance-none rounded-lg border px-3 text-base outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm ${isDark ? 'border-[#3F3F46] bg-[#09090B] text-[#FAFAFA] placeholder:text-[#71717A]' : 'border-[#D4D4D8] bg-white text-[#09090B] placeholder:text-[#A1A1AA]'}`
  const setNumberRule = (key: keyof PracticeAccountRules, value: string, nullable = false) => {
    const parsed = value === '' && nullable ? null : Number(value)
    setRules((current) => ({ ...current, [key]: Number.isFinite(parsed as number) ? parsed : nullable ? null : 0 }))
  }

  return (
    <div className={`auren-shell-offset min-h-screen ${isDark ? 'bg-[#09090B]' : 'bg-[#FAFAFA]'}`}>
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-500">Practice workspace</p>
            <h1 className={`text-2xl font-semibold tracking-tight sm:text-3xl ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Evaluation and funded accounts</h1>
            <p className={`mt-2 max-w-2xl text-sm ${muted}`}>Create a simulated account, choose its plan, then press Play to open the protected trading terminal.</p>
          </div>
          <button type="button" onClick={() => navigate(ROUTES.PROPS_SETTINGS)} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium ${surface} ${isDark ? 'text-[#FAFAFA] hover:bg-[#27272A]' : 'text-[#09090B] hover:bg-[#F4F4F5]'}`}>
            <Database className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Connection settings <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {error ? <div role="alert" className={`mb-5 flex items-start gap-2 rounded-lg border p-3 text-sm ${isDark ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />{error}</div> : null}

        <div
          role="tablist"
          aria-label="Practice account workspace"
          className={`mb-6 grid grid-cols-2 rounded-xl border p-1 sm:inline-grid sm:min-w-80 ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-[#F4F4F5]'}`}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'accounts'}
            onClick={() => setActiveTab('accounts')}
            className={`min-h-11 rounded-lg px-5 text-sm font-semibold transition-colors ${activeTab === 'accounts' ? isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-white text-[#09090B] shadow-sm' : muted}`}
          >
            Accounts <span className="ml-1 text-xs opacity-70">{accounts.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'create'}
            onClick={() => setActiveTab('create')}
            className={`min-h-11 rounded-lg px-5 text-sm font-semibold transition-colors ${activeTab === 'create' ? isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-white text-[#09090B] shadow-sm' : muted}`}
          >
            Create
          </button>
        </div>

        <PracticeMarketDataSelector
          isDark={isDark}
          onOpenConnectionSettings={() => navigate(ROUTES.PROPS_SETTINGS)}
        />

        {activeTab === 'create' ? (
        <section className={`mb-7 rounded-xl border p-4 sm:p-5 ${surface}`} aria-labelledby="create-practice-title">
          <div className="mb-4">
            <h2 id="create-practice-title" className={`text-base font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Create an account</h2>
            <p className={`mt-1 text-sm ${muted}`}>Use standard guardrails for the selected account type and balance.</p>
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
              <div className={`grid grid-cols-2 rounded-lg border p-1 ${isDark ? 'border-[#3F3F46] bg-[#09090B]' : 'border-[#E4E4E7] bg-[#F4F4F5]'}`}>
                {(['eval', 'funded'] as PracticeAccountMode[]).map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)} className={`rounded-md px-3 py-2 text-sm font-medium capitalize ${mode === item ? isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white' : muted}`}>{item === 'eval' ? 'Evaluation' : 'Funded'}</button>)}
              </div>
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-3">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Choose your practice plan</h3>
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
                    className={`relative overflow-hidden rounded-xl border transition-all ${selected ? isDark ? 'border-blue-500 bg-blue-500/[0.07] ring-1 ring-blue-500/40' : 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-500/30' : isDark ? 'border-[#27272A] bg-[#121215] hover:border-[#52525B]' : 'border-[#E4E4E7] bg-white hover:border-[#A1A1AA]'}`}
                  >
                    {selected ? <div className="absolute inset-x-0 top-0 h-1 bg-blue-500" /> : null}
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSize(item)}
                      className="w-full p-5 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-500">Practice plan</p>
                          <h4 className={`mt-2 text-2xl font-semibold tracking-tight ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{item / 1000}K {mode === 'eval' ? 'Evaluation' : 'Funded'}</h4>
                          <p className={`mt-1 text-xs ${muted}`}>{money.format(item)} simulated buying power</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${selected ? 'border-blue-500 bg-blue-500 text-white' : isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#D4D4D8] text-[#52525B]'}`}>
                          {selected ? 'Selected' : 'Select'}
                        </span>
                      </div>
                      <div className={`mt-5 border-t ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
                        {rows.map(([label, value]) => (
                          <div key={label} className={`flex min-h-11 items-center justify-between gap-4 border-b py-2.5 text-sm last:border-b-0 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
                            <span className={muted}>{label}</span>
                            <span className={`text-right font-semibold tabular-nums ${isDark ? 'text-[#E4E4E7]' : 'text-[#27272A]'}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                    {selected ? (
                      <div className={`flex items-center justify-between gap-3 border-t px-5 py-4 ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}>
                        <span className={`text-xs font-medium ${planIsCustom ? 'text-amber-500' : muted}`}>{planIsCustom ? 'Custom rules applied' : 'Standard rules'}</span>
                        <button
                          type="button"
                          aria-expanded={customizeOpen}
                          onClick={() => setCustomizeOpen((open) => !open)}
                          className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold ${surface} ${isDark ? 'text-[#FAFAFA] hover:bg-[#27272A]' : 'text-[#09090B] hover:bg-[#F4F4F5]'}`}
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 text-blue-500" strokeWidth={1.75} />
                          {customizeOpen ? 'Done editing' : 'Edit rules'}
                        </button>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </div>
          {customizeOpen ? <div className={`mt-5 rounded-xl border p-4 ${isDark ? 'border-[#3F3F46] bg-[#121215]' : 'border-[#D4D4D8] bg-[#FAFAFA]'}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h4 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Custom rules</h4>
                  <p className={`mt-0.5 text-xs ${muted}`}>Changes apply only to this new account.</p>
                </div>
                <button type="button" onClick={() => setRules(planDefaults)} disabled={!planIsCustom} className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${isDark ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-700 hover:bg-blue-50'}`}>
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
                  <span><span className={`block text-sm font-medium ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Daily discipline lockouts</span><span className={`mt-0.5 block text-xs ${muted}`}>Pause trading after a configured loss or trade count.</span></span>
                  <input type="checkbox" checked={rules.lockoutEnabled === true} onChange={(event) => setRules((current) => ({ ...current, lockoutEnabled: event.target.checked }))} className="h-5 w-5 shrink-0 accent-blue-600" />
                </label>
                {rules.lockoutEnabled ? <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2" style={{ borderColor: isDark ? '#27272A' : '#E4E4E7' }}>
                  <label className={`text-xs font-medium ${muted}`}>Daily loss limit ($)<input inputMode="decimal" type="number" min="1" step="50" placeholder="Automatic: 2% capped" value={rules.dailyLossLimit ?? ''} onChange={(event) => setNumberRule('dailyLossLimit', event.target.value, true)} className={`mt-2 ${inputClass}`} /></label>
                  <label className={`text-xs font-medium ${muted}`}>Maximum trades / day<input inputMode="numeric" type="number" min="1" step="1" placeholder="No limit" value={rules.maxTradesPerDay ?? ''} onChange={(event) => setNumberRule('maxTradesPerDay', event.target.value, true)} className={`mt-2 ${inputClass}`} /></label>
                </div> : null}
              </div>
            </div> : null}
          <div className={`mt-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}>
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{size / 1000}K {mode === 'eval' ? 'Evaluation' : 'Funded'} selected</p>
              <p className={`mt-1 text-xs ${muted}`}>Creates a simulated account immediately. No purchase or fee.</p>
            </div>
            <button type="button" onClick={() => void createAccount()} disabled={busy === 'create'} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold disabled:opacity-50 ${isDark ? 'bg-[#FAFAFA] text-[#09090B] hover:bg-[#E4E4E7]' : 'bg-[#18181B] text-white hover:bg-[#27272A]'}`}>
              {busy === 'create' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={1.75} />} Create practice account
            </button>
          </div>
        </section>
        ) : (
          <>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className={`text-base font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Your accounts <span className={`ml-1 text-sm font-normal ${muted}`}>{accounts.length}</span></h2>
        </div>

        {loading && accounts.length === 0 ? (
          <div className={`flex min-h-52 items-center justify-center rounded-xl border ${surface}`}><RefreshCw className="h-5 w-5 animate-spin text-blue-500" aria-label="Loading accounts" /></div>
        ) : accounts.length === 0 ? (
          <div className={`rounded-xl border border-dashed px-6 py-14 text-center ${isDark ? 'border-[#3F3F46] bg-[#18181B]' : 'border-[#D4D4D8] bg-white'}`}>
            <ShieldCheck className={`mx-auto h-7 w-7 ${muted}`} strokeWidth={1.5} />
            <h3 className={`mt-3 text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>No practice accounts yet</h3>
            <p className={`mt-1 text-sm ${muted}`}>Create an Evaluation or Funded account to begin practicing.</p>
            <button type="button" onClick={() => setActiveTab('create')} className={`mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>
              <Plus className="h-4 w-4" strokeWidth={1.75} /> Create account
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => {
              const rules = evaluatePracticeRules(account)
              const pnl = account.balance - account.rules.startingBalance
              const progress = account.mode === 'eval' && rules.effectiveProfitTarget ? Math.max(0, Math.min(100, (rules.totalProfit / rules.effectiveProfitTarget) * 100)) : null
              const target = account.mode === 'eval' ? rules.effectiveProfitTarget : null
              return (
                <article key={account.id} className={`rounded-xl border p-5 ${surface}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{getPracticeAccountDisplayTitle(account)}</p>
                      <p className={`mt-1 truncate text-xs ${muted}`}>{getPracticeAccountMetaLabel(account)} · {new Date(account.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusTone(account.status, isDark)}`}>{account.status}</span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div><p className={`text-xs ${muted}`}>Balance</p><p className={`mt-1 text-lg font-semibold tabular-nums ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{money.format(account.balance)}</p></div>
                    <div><p className={`text-xs ${muted}`}>Net P&amp;L</p><p className={`mt-1 text-lg font-semibold tabular-nums ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{pnl >= 0 ? '+' : ''}{money.format(pnl)}</p></div>
                    <div><p className={`text-xs ${muted}`}>Target</p><p className={`mt-1 text-lg font-semibold tabular-nums ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{target == null ? '—' : money.format(target)}</p></div>
                  </div>
                  <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}>
                    <div className="flex items-center justify-between gap-3 text-xs"><span className={muted}>{progress == null ? 'Drawdown cushion' : 'Profit target'}</span><span className={`truncate tabular-nums ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{progress == null ? money.format(rules.cushion) : `${pnl >= 0 ? '+' : ''}${money.format(pnl)} of ${money.format(target ?? 0)} · ${progress.toFixed(0)}%`}</span></div>
                    <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${isDark ? 'bg-[#27272A]' : 'bg-[#E4E4E7]'}`}><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress ?? Math.max(0, Math.min(100, (rules.cushion / account.rules.maxLoss) * 100))}%` }} /></div>
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <button type="button" onClick={() => openAccount(account)} className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${isDark ? 'bg-[#FAFAFA] text-[#09090B] hover:bg-[#E4E4E7]' : 'bg-[#18181B] text-white hover:bg-[#27272A]'}`}><Play className="h-4 w-4" fill="currentColor" strokeWidth={1.5} /> Play</button>
                    <button type="button" aria-label={`Reset ${getPracticeAccountDisplayTitle(account)}`} onClick={() => void resetAccount(account)} disabled={busy === `reset:${account.id}`} className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border disabled:opacity-50 ${surface} ${muted}`}><RotateCcw className={`h-4 w-4 ${busy === `reset:${account.id}` ? 'animate-spin' : ''}`} strokeWidth={1.75} /></button>
                    <button type="button" aria-label={`Delete ${getPracticeAccountDisplayTitle(account)}`} onClick={() => setDeleteTarget(account)} className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'}`}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
          </>
        )}
      </main>

      <ConfirmDialog isOpen={Boolean(deleteTarget)} title="Delete practice account?" message={deleteTarget ? `${getPracticeAccountDisplayTitle(deleteTarget)} and its simulated history will be removed.` : ''} confirmText={busy?.startsWith('delete:') ? 'Deleting…' : 'Delete account'} cancelText="Cancel" onConfirm={() => void removeAccount()} onCancel={() => setDeleteTarget(null)} variant="danger" isDark={isDark} />
    </div>
  )
}
