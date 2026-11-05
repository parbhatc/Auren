import { useEffect, useRef, useState } from 'react'
import { tradeseaAPI, type TradeseaAccountRuleSettings } from '../../api/tradesea.api'
import { getAuthToken } from '../../api/api'
import type { LucidAccountProfile } from '../../services/dashboard/lucidAccountProfile'

const empty: TradeseaAccountRuleSettings = { dllEnabled: null, dllAmount: null, consistencyPercent: null, drawdownMethod: null, profitTarget: null, maxLoss: null }

export default function LucidAccountSettingsForm({ accountId, settings, profile, onSaved, onCancel }: {
  accountId: string
  settings?: TradeseaAccountRuleSettings | null
  profile: LucidAccountProfile
  onSaved: (settings: TradeseaAccountRuleSettings | null) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<TradeseaAccountRuleSettings>(() => ({ ...empty, ...settings }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const alive = useRef(true)
  const owner = useRef(getAuthToken())
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const current = () => alive.current && owner.current === getAuthToken()
  const save = async (next: TradeseaAccountRuleSettings) => {
    if (saving) return
    setSaving(true); setError('')
    try {
      const result = await tradeseaAPI.saveAccountSettings(accountId, next)
      if (!current()) return
      if (!result.success) throw new Error('Account settings could not be saved.')
      onSaved(result.ruleSettings)
    } catch (error: any) {
      if (current()) setError(error?.response?.data?.error || error?.message || 'Account settings could not be saved.')
    } finally { if (current()) setSaving(false) }
  }
  const field = 'mt-1.5 w-full rounded-lg border border-[var(--workspace-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--workspace-text)] outline-none focus:ring-2 focus:ring-violet-500/40'
  const option = (selected: boolean) => `rounded-lg border px-3 py-2 text-[11px] transition-colors ${selected ? 'border-violet-500/60 bg-violet-500/10 text-[var(--workspace-text)]' : 'border-[var(--workspace-border)] text-[var(--workspace-muted)] hover:bg-[var(--app-hover)]'}`
  return (
    <form className="mt-4 space-y-4 rounded-xl border border-[var(--workspace-border)] p-4" onSubmit={event => { event.preventDefault(); void save(draft) }}>
      <div>
        <h3 className="text-xs font-semibold">Confirm your account settings</h3>
        <p className="mt-1 text-[10px] leading-5 text-[var(--workspace-muted)]">Check your Lucid account details. Your answers are saved to this account for future visits.</p>
      </div>
      <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
        <fieldset>
          <legend className="mb-2 text-[11px]">Is daily loss limit (DLL) enabled?</legend>
          <div className="flex flex-wrap gap-2">
            {[{ label: 'Not sure', value: null }, { label: 'On', value: true }, { label: 'Off', value: false }].map(item => (
              <button type="button" key={item.label} aria-pressed={draft.dllEnabled === item.value} className={option(draft.dllEnabled === item.value)} onClick={() => setDraft({ ...draft, dllEnabled: item.value, dllAmount: item.value ? draft.dllAmount : null })}>{item.label}</button>
            ))}
          </div>
          {draft.dllEnabled === true && <label className="mt-3 block text-[11px]">Daily loss limit ($)
            <input type="number" min="0.01" max="10000000" step="0.01" required value={draft.dllAmount ?? ''} onChange={event => setDraft({ ...draft, dllAmount: event.target.value === '' ? null : Number(event.target.value) })} className={field} placeholder="Enter the limit shown by Lucid" />
          </label>}
        </fieldset>
        <label className="block text-[11px]">Consistency limit (%)
          <input type="number" min="0" max="100" step="0.01" value={draft.consistencyPercent ?? ''} onChange={event => setDraft({ ...draft, consistencyPercent: event.target.value === '' ? null : Number(event.target.value) })} placeholder="e.g. 40 or 50 · 0 for none" className={field} />
          <span className="mt-1 block text-[10px] text-[var(--workspace-muted)]">Leave blank if you have not confirmed it.</span>
        </label>
        <fieldset>
          <legend className="mb-2 text-[11px]">Drawdown method</legend>
          <div className="flex flex-wrap gap-2">
            {([{ label: 'Use reference', value: null }, { label: 'EOD', value: 'eod' }, { label: 'Intraday', value: 'intraday' }, { label: 'Static', value: 'static' }] as const).map(item => (
              <button type="button" key={item.label} aria-pressed={draft.drawdownMethod === item.value} className={option(draft.drawdownMethod === item.value)} onClick={() => setDraft({ ...draft, drawdownMethod: item.value })}>{item.label}</button>
            ))}
          </div>
        </fieldset>
        <details className="text-[11px]">
          <summary className="cursor-pointer text-[var(--workspace-muted)]">Different target or loss allowance?</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label>Profit target ($)<input type="number" min="0" max="10000000" step="0.01" value={draft.profitTarget ?? ''} onChange={event => setDraft({ ...draft, profitTarget: event.target.value === '' ? null : Number(event.target.value) })} placeholder={profile.target != null ? String(profile.target) : 'Unconfirmed'} className={field} /></label>
            <label>MLL allowance ($)<input type="number" min="0.01" max="10000000" step="0.01" value={draft.maxLoss ?? ''} onChange={event => setDraft({ ...draft, maxLoss: event.target.value === '' ? null : Number(event.target.value) })} placeholder={profile.mll != null ? String(profile.mll) : 'Unconfirmed'} className={field} /></label>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-[var(--workspace-muted)]">Blank fields use the published plan reference. MLL allowance is the permitted loss amount, not the current breach balance.</p>
        </details>
        {error && <p role="alert" className="text-[11px] text-[var(--workspace-danger)]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="rounded-lg bg-violet-500 px-3 py-2 text-[11px] font-medium text-white">{saving ? 'Saving…' : 'Save settings'}</button>
          <button type="button" className={option(false)} onClick={onCancel}>Cancel</button>
          {settings && <button type="button" className="px-2 text-[10px] text-[var(--workspace-muted)] underline" onClick={() => void save(empty)}>Clear saved settings</button>}
        </div>
      </fieldset>
    </form>
  )
}
