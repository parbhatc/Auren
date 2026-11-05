import { lazy, Suspense, useEffect, useState } from 'react'
import { applyLucidAccountSettings, type LucidAccountProfile } from '../../services/dashboard/lucidAccountProfile'
import type { TradeseaAccountRuleSettings } from '../../api/tradesea.api'
import type { TradeseaTradelensDashboard } from '../../services/tradesea/tradeseaTradelensStats'

const SettingsForm = lazy(() => import('./LucidAccountSettingsForm'))

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)

export default function LucidAccountDetails({ profile: reference, accountId, accountName, settings: initialSettings, dashboard, period, onSettingsSaved }: {
  profile: LucidAccountProfile
  accountId?: string
  accountName?: string
  settings?: TradeseaAccountRuleSettings | null
  dashboard?: TradeseaTradelensDashboard | null
  period?: string
  onSettingsSaved?: () => void
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => { setSettings(initialSettings) }, [initialSettings])
  const profile = applyLucidAccountSettings(reference, settings)
  const balance = dashboard?.dailyAccountBalance?.filter(row => typeof row.value === 'number' && Number.isFinite(row.value) && /^\d{4}-\d{2}-\d{2}/.test(row.date))
    .slice().sort((a, b) => b.date.localeCompare(a.date))[0]
  const calendar = dashboard?.pnlAndTradeCountCalendar
  const tradingDays = calendar ? new Set(calendar.filter(day => day.tradesCount > 0).map(day => day.date.slice(0, 10))).size : undefined
  const needsConfirmation = settings?.dllEnabled == null || /unconfirmed|confirm account|phase unconfirmed/i.test(profile.consistency)
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{profile.title}</span>
        <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] text-violet-500">{profile.phase}</span>
        {profile.size && <span className="text-xs text-[var(--workspace-muted)]">{profile.size / 1000}K balance</span>}
      </div>
      {accountName && <p className="mt-2 break-all text-[11px] font-medium text-[var(--workspace-muted)]">{accountName}</p>}
      <p className="mt-2 text-[10px] leading-5 text-[var(--workspace-muted)]">
        Platform · Tradesea {settings?.dllEnabled === true ? ' · DLL on' : settings?.dllEnabled === false ? ' · DLL off' : ''}
      </p>
      {dashboard !== undefined && <div className="mt-4 rounded-xl border border-[var(--workspace-border)] bg-[var(--app-inset)] p-4">
        <p className="text-[10px] text-[var(--workspace-muted)]">Account balance{balance ? ` · ${balance.date.slice(0, 10)}` : ''}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{balance ? money(balance.value) : '—'}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-[10px]">
          <span className="text-[var(--workspace-muted)]">Trading days{period ? ` · ${period}` : ''}</span>
          <span className="font-semibold tabular-nums">{tradingDays ?? '—'}</span>
        </div>
        <p className="mt-2 text-[9px] leading-4 text-[var(--workspace-muted)]">{balance ? 'Latest reported balance in the selected month.' : 'Balance snapshot unavailable.'} Trading days cover the selected month.</p>
      </div>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: 'Profit target', value: profile.target != null ? money(profile.target) : profile.phase === 'Sim funded' ? 'No evaluation target' : 'Unconfirmed', color: 'text-[var(--workspace-success)]', confirmed: settings?.profitTarget != null },
          { label: 'Max loss limit (MLL)', value: profile.mll != null ? money(profile.mll) : 'Unconfirmed', color: 'text-[var(--workspace-danger)]', confirmed: settings?.maxLoss != null },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-[var(--workspace-border)] bg-[var(--app-inset)] p-3">
            <p className="text-[10px] text-[var(--workspace-muted)]">{item.label}</p>
            <p className={`mt-2 text-sm font-semibold tabular-nums ${item.color}`}>{item.value}</p>
            <p className="mt-1 text-[9px] text-[var(--workspace-muted)]">{item.confirmed ? 'User confirmed' : 'Published plan reference'}</p>
          </div>
        ))}
      </div>
      <dl className="mt-4 divide-y divide-[var(--workspace-border)] text-[11px]">
        {[
          ['Drawdown method', profile.drawdown],
          ['Consistency rule', profile.consistency],
          ['Daily loss limit (DLL)', profile.dailyLoss],
          ['Current MLL balance', 'Not provided by connection'],
          ['Target balance (rule)', profile.size != null && profile.target != null ? money(profile.size + profile.target) : 'Unconfirmed'],
          ['Current consistency / amount left', 'Not provided by connection'],
        ].filter(([label]) => dashboard !== undefined || !['Current MLL balance', 'Current consistency / amount left'].includes(label)).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-3">
            <dt className="text-[var(--workspace-muted)]">{label}</dt>
            <dd className="max-w-[60%] text-right font-medium leading-5">{value}</dd>
          </div>
        ))}
      </dl>
      {accountId && !editing && <div className="mt-3">
        {needsConfirmation && <p className="mb-2 text-[10px] leading-5 text-[var(--workspace-muted)]">Is your DLL on or off? Which consistency option did you choose?</p>}
        <button type="button" className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[11px] font-medium" onClick={() => { setSaved(false); setEditing(true) }}>{needsConfirmation ? 'Confirm account settings' : 'Edit account settings'}</button>
        {saved && <p role="status" className="mt-2 text-[10px] text-[var(--workspace-success)]">Account settings saved.</p>}
      </div>}
      {editing && accountId && <Suspense fallback={<p className="mt-4 text-xs" role="status">Loading settings…</p>}>
        <SettingsForm accountId={accountId} settings={settings} profile={reference} onCancel={() => setEditing(false)} onSaved={value => { setSettings(value); setEditing(false); setSaved(true); onSettingsSaved?.() }} />
      </Suspense>}
      <details className="mt-2 text-[10px] leading-5 text-[var(--workspace-muted)]">
        <summary className="cursor-pointer">About these rules</summary>
        <p className="mt-2">{profile.inferred ? 'Plan and account size inferred from the account name. ' : ''}Published rules checked October 29, 2026. Purchase options and legacy terms may differ. MLL above is the loss allowance, not your current breach balance. Monthly results cannot determine remaining target, live drawdown or current consistency. Confirmed settings describe your account; they do not change Lucid’s rules or enforce trading limits.</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {profile.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{link.label} ↗</a>)}
        </div>
      </details>
    </div>
  )
}
