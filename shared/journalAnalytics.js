export function journalPeriod(kind, start) {
  if (!['daily', 'weekly'].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(start))
    throw new Error('Choose a valid review period.')
  const date = new Date(`${start}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start)
    throw new Error('Choose a valid review date.')
  if (kind === 'weekly' && date.getUTCDay() !== 1)
    throw new Error('Weekly reviews start on Monday.')
  date.setUTCDate(date.getUTCDate() + (kind === 'weekly' ? 7 : 1))
  return { start, end: date.toISOString().slice(0, 10) }
}

const number = (value) =>
  value != null && String(value).trim() !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : null
const sum = (values) => values.reduce((a, b) => a + b, 0)
export function journalAnalytics(entries) {
  const taken = entries.filter((e) => (e.recap?.execution ?? 'taken') === 'taken')
  const closed = taken.filter((e) => e.exitDateTime || e.outcome !== 'planned')
  // Gross-only provider snapshots must not silently masquerade as net results.
  const measured = closed.filter(
    (e) => number(e.pnl) !== null && e.sourceContext?.pnlBasis !== 'gross'
  )
  const metrics = (rows) => {
    const pnl = rows.map((e) => Number(e.pnl))
    const gains = sum(pnl.filter((n) => n > 0)),
      losses = -sum(pnl.filter((n) => n < 0))
    const r = rows.flatMap((e) =>
      number(e.recap?.riskDollars) > 0 ? [Number(e.pnl) / Number(e.recap.riskDollars)] : []
    )
    return {
      count: rows.length,
      netPnl: sum(pnl),
      wins: pnl.filter((n) => n > 0).length,
      winRate: rows.length ? (pnl.filter((n) => n > 0).length / rows.length) * 100 : null,
      expectancy: rows.length ? sum(pnl) / rows.length : null,
      profitFactor: losses ? gains / losses : null,
      rCount: r.length,
      averageR: r.length ? sum(r) / r.length : null,
      rDistribution: [
        r.filter((n) => n < -1).length,
        r.filter((n) => n >= -1 && n < 0).length,
        r.filter((n) => n === 0).length,
        r.filter((n) => n > 0 && n < 1).length,
        r.filter((n) => n >= 1 && n < 2).length,
        r.filter((n) => n >= 2).length,
      ],
    }
  }
  const group = (keys) => {
    const groups = new Map()
    for (const row of measured)
      for (const key of new Set(keys(row))) groups.set(key, [...(groups.get(key) ?? []), row])
    return [...groups]
      .map(([label, rows]) => ({ label, ...metrics(rows) }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }
  return {
    ...metrics(measured),
    total: entries.length,
    open: taken.length - closed.length,
    missed: entries.filter((e) => e.recap?.execution === 'missed').length,
    observations: entries.filter((e) => e.recap?.execution === 'observation').length,
    missingPnl: closed.length - measured.length,
    mistakeLoss: -sum(
      measured
        .filter((e) => e.recap?.mistakeTags?.length && Number(e.pnl) < 0)
        .map((e) => Number(e.pnl))
    ),
    byPlaybook: group((e) => [e.playbook || 'Unspecified']),
    bySession: group((e) => [e.recap?.session || 'Unspecified']),
    byGrade: group((e) => [e.recap?.grade || 'Not graded']),
    bySource: group((e) => [e.source || 'manual']),
    byTimeframe: group((e) => [e.sourceContext?.chartResolution || 'Not recorded']),
    byMistake: group((e) => e.recap?.mistakeTags ?? []),
    byCondition: group((e) =>
      [
        ...new Set([
          ...(e.recap?.setupConditions ?? []).map((c) => c.label),
          ...Object.keys(e.conditionResponses ?? {}),
        ]),
      ].map((label) => {
        const value = e.conditionResponses?.[label]
        return `${label}: ${value === true ? 'Yes' : value === false ? 'No' : value == null || value === '' ? 'Not reviewed' : 'Recorded'}`
      })
    ),
  }
}
