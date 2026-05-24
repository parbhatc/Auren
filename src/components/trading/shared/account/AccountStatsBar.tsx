export function formatStatMoney(
  value: number,
  options?: { emptyAsDash?: boolean; decimals?: number }
): { text: string; cls: string } {
  const emptyAsDash = options?.emptyAsDash ?? false
  const abs = Math.abs(value)

  if (emptyAsDash && abs < 0.005) {
    return { text: '$ --', cls: 'text-[#7F838B]' }
  }

  if (abs < 0.01) {
    return { text: '$0', cls: 'text-[#7F838B]' }
  }

  const decimals =
    options?.decimals ?? (abs < 1000 && abs % 1 !== 0 ? 2 : abs < 10 ? 2 : 0)

  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: decimals > 0 ? Math.min(2, decimals) : 0,
    maximumFractionDigits: decimals,
  })

  if (value > 0) return { text: `+$${formatted}`, cls: 'text-emerald-400' }
  return { text: `-$${formatted}`, cls: 'text-red-400' }
}

export function AccountStatsBar({
  isDark,
  balance,
  rpl,
  upl,
  hasOpenPosition,
}: {
  isDark: boolean
  balance: number
  rpl: number
  upl: number
  hasOpenPosition?: boolean
}) {
  const muted = isDark ? 'text-[#7F838B]' : 'text-slate-500'
  const rplFmt = formatStatMoney(rpl, { decimals: 2 })
  const uplFmt = formatStatMoney(upl, {
    emptyAsDash: !hasOpenPosition,
    decimals: 2,
  })

  const cells = [
    {
      label: 'BAL',
      value: `$${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      cls: isDark ? 'text-white' : 'text-slate-900',
    },
    { label: 'RP&L', value: rplFmt.text, cls: rplFmt.cls },
    { label: 'UP&L', value: uplFmt.text, cls: uplFmt.cls },
  ]

  return (
    <div
      className={`shrink-0 border-b grid grid-cols-3 gap-px ${
        isDark ? 'border-slate-700 bg-slate-700/50' : 'border-slate-200 bg-slate-200'
      }`}
    >
      {cells.map((cell) => (
        <div
          key={cell.label}
          className={`px-3 py-1.5 text-center ${isDark ? 'bg-slate-950/90' : 'bg-white'}`}
        >
          <div className={`text-[10px] font-medium uppercase tracking-wider ${muted}`}>{cell.label}</div>
          <div className={`text-sm font-semibold tabular-nums ${cell.cls}`}>{cell.value}</div>
        </div>
      ))}
    </div>
  )
}
