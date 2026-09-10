import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { journalAPI } from '../api/journal.api'
import type { JournalAnalytics, JournalGroup } from '../../shared/journalAnalytics.js'
import { handleApiError } from '../utils/errorHandler'

export const journalMoney = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value)
export default function JournalAnalyticsPanel() {
  const [data, setData] = useState<JournalAnalytics | null>(null)
  const [source, setSource] = useState('all'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('')
  const [group, setGroup] = useState('byPlaybook'),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError('')
    void journalAPI
      .analytics({ source, from, to }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(handleApiError(e))
      })
    return () => controller.abort()
  }, [source, from, to, reload])
  const groups: [string, string][] = [
    ['byPlaybook', 'Playbook'],
    ['bySession', 'Session'],
    ['byGrade', 'Process grade'],
    ['byTimeframe', 'Timeframe'],
    ['byCondition', 'Confirmation'],
    ['byMistake', 'Mistake'],
    ['bySource', 'Source'],
  ]
  return (
    <section
      aria-label="Journal analytics"
      className="mt-4 rounded-xl border border-zinc-500/25 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Journal performance</h2>
        <Link className="text-sm text-blue-500" to="/journal/reviews">
          Daily / weekly reviews →
        </Link>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Recorded USD results only. Missed setups and observations are not executed trades.
        Gross-only or missing P&L is excluded. All sources combines manual, simulated and live
        entries.
      </p>
      <div className="my-4 flex flex-wrap gap-3 text-sm">
        <label>
          Source{' '}
          <select
            aria-label="Analytics source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded border border-zinc-500/30 bg-transparent p-2"
          >
            {['all', 'manual', 'practice', 'live', 'replay'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          From{' '}
          <input
            aria-label="Analytics from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-zinc-500/30 bg-transparent p-2"
          />
        </label>
        <label>
          To{' '}
          <input
            aria-label="Analytics to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-zinc-500/30 bg-transparent p-2"
          />
        </label>
        <button type="button" onClick={() => setReload((n) => n + 1)} className="text-blue-500">
          Refresh
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      ) : !data ? (
        <p role="status">Loading journal analytics…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Measured trades', data.count],
              ['Recorded net P&L', journalMoney(data.count ? data.netPnl : null)],
              ['Win rate', data.winRate == null ? '—' : `${data.winRate.toFixed(1)}%`],
              ['Expectancy / trade', journalMoney(data.expectancy)],
              [
                'Average R',
                data.averageR == null
                  ? '—'
                  : `${data.averageR.toFixed(2)}R (${data.rCount} trades)`,
              ],
              ['Open / planned', data.open],
              ['Missed / observations', `${data.missed} / ${data.observations}`],
              ['Missing / gross P&L', data.missingPnl],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-zinc-500/5 p-3">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="mt-1 font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <p className="my-4 text-sm">
            Loss on mistake-tagged trades: <strong>{journalMoney(data.mistakeLoss)}</strong>. Each
            losing trade counts once here; breakdown tags overlap. This is associated loss, not
            proven causal cost.
          </p>
          <label className="text-sm">
            Break down by{' '}
            <select
              aria-label="Analytics breakdown"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="mb-3 rounded border border-zinc-500/30 bg-transparent p-2"
            >
              {groups.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr>
                  {['Group', 'Trades', 'Win %', 'Net P&L', 'Expectancy', 'Avg R', 'R samples'].map(
                    (h) => (
                      <th key={h} className="p-2">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {(data[group as keyof JournalAnalytics] as JournalGroup[]).map((row) => (
                  <tr key={row.label} className="border-t border-zinc-500/20">
                    <td className="p-2">{row.label}</td>
                    <td>{row.count}</td>
                    <td>{row.winRate?.toFixed(1) ?? '—'}</td>
                    <td>{journalMoney(row.netPnl)}</td>
                    <td>{journalMoney(row.expectancy)}</td>
                    <td>{row.averageR?.toFixed(2) ?? '—'}</td>
                    <td>{row.rCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.count && (
            <p className="mt-3 text-sm text-zinc-500">
              No closed taken trades with recorded net P&L match these filters.
            </p>
          )}
          <details className="mt-4 text-sm">
            <summary>R distribution ({data.rCount} trades with recorded initial risk)</summary>
            <div className="mt-2 flex flex-wrap gap-3">
              {['Below −1R', '−1R to <0', '0R', '>0 to <1R', '1R to <2R', '2R+'].map((label, i) => (
                <span key={label}>
                  {label}: {data.rDistribution[i]}
                </span>
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  )
}
