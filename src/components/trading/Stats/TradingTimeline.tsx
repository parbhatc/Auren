import { TradingTimelineProps } from '../../../types/common'
import { resolvePracticeTradeFees } from '../../../services/practice/practiceCommission'

type TimelinePoint = {
  x: number
  y: number
  netPnl: number
  cumulativePnL: number
  trade: TradingTimelineProps['trades'][0]
  entryTime: Date
  label: string
}

function tradeFees(
  trade: TradingTimelineProps['trades'][0],
  symbolData: TradingTimelineProps['symbolData']
): number {
  const stored = resolvePracticeTradeFees(trade)
  if (stored > 0) return stored
  const symbol = trade.symbol || ''
  const symbolInfo = symbolData?.[symbol]
  const perContract = symbolInfo?.totalFees || 0
  return perContract * Math.abs(trade.contracts || 0)
}

export default function TradingTimeline({
  isDark,
  trades,
  profit,
  date,
  symbolData,
  selectedTimelinePoint,
  onPointClick,
  onPointClose,
  calculateTradePnL,
  parseTradeTimestamp,
}: TradingTimelineProps) {
  const sortedTrades = [...trades].sort((a, b) => {
    const timeA = parseTradeTimestamp(a.entry_time)?.getTime() || 0
    const timeB = parseTradeTimestamp(b.entry_time)?.getTime() || 0
    return timeA - timeB
  })

  const entryTimes = sortedTrades
    .map((t) => parseTradeTimestamp(t.entry_time))
    .filter((d): d is Date => d != null)

  if (entryTimes.length === 0) return null

  const rawMinMs = Math.min(...entryTimes.map((d) => d.getTime()))
  const rawMaxMs = Math.max(...entryTimes.map((d) => d.getTime()))
  const useSequenceX = rawMaxMs - rawMinMs < 60_000

  let cumulativePnL = 0
  const points: TimelinePoint[] = []

  sortedTrades.forEach((trade, index) => {
    const entryTime = parseTradeTimestamp(trade.entry_time)
    if (!entryTime) return

    const grossPnl = calculateTradePnL(trade)
    const fees = tradeFees(trade, symbolData)
    const netPnl = grossPnl - fees
    cumulativePnL += netPnl

    const x =
      useSequenceX && sortedTrades.length > 1
        ? 8 + (index / (sortedTrades.length - 1)) * 84
        : useSequenceX
          ? 50
          : (() => {
              const padMin = rawMinMs - 30 * 60_000
              const padMax = rawMaxMs + 30 * 60_000
              const span = padMax - padMin || 1
              return 8 + ((entryTime.getTime() - padMin) / span) * 84
            })()

    points.push({
      x,
      y: cumulativePnL,
      netPnl,
      cumulativePnL,
      trade,
      entryTime,
      label: `#${index + 1}`,
    })
  })

  if (points.length === 0) return null

  const minPnL = Math.min(0, ...points.map((p) => p.y))
  const maxPnL = Math.max(0, ...points.map((p) => p.y))
  const padding = (maxPnL - minPnL || 1) * 0.12
  const yMin = minPnL - padding
  const yMax = maxPnL + padding
  const ySpan = yMax - yMin || 1

  const chartH = 100
  const toSvgY = (pnl: number) => chartH - ((pnl - yMin) / ySpan) * chartH

  const svgPoints = points.map((p) => ({
    ...p,
    svgY: toSvgY(p.y),
  }))

  const linePath = svgPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.svgY}`)
    .join(' ')

  const zeroY = toSvgY(0)
  const areaPath = `${linePath} L ${svgPoints[svgPoints.length - 1].x},${chartH} L ${svgPoints[0].x},${chartH} Z`

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  const footerLeft = useSequenceX
    ? 'By trade order'
    : `${formatTime(new Date(rawMinMs))} – ${formatTime(new Date(rawMaxMs))}`

  const stroke = profit >= 0 ? (isDark ? '#34d399' : '#059669') : isDark ? '#f87171' : '#dc2626'

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
      }`}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          Session curve
        </p>
        <p className={`text-xs tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          Cumulative net P&L
        </p>
      </div>

      <div className="px-4 pb-1">
        <div className="relative h-36 sm:h-44">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Cumulative profit and loss by trade"
          >
            <defs>
              <linearGradient id={`timelineGradient-${date}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={profit >= 0 ? 'rgba(52, 211, 153, 0.25)' : 'rgba(248, 113, 113, 0.25)'} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </linearGradient>
            </defs>

            <line
              x1="0"
              y1={zeroY}
              x2="100"
              y2={zeroY}
              stroke={isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.5)'}
              strokeWidth="0.4"
              strokeDasharray="1.5,1.5"
            />

            <path d={areaPath} fill={`url(#timelineGradient-${date})`} />
            <path
              d={linePath}
              fill="none"
              stroke={stroke}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {svgPoints.map((point) => {
              const selected = selectedTimelinePoint?.trade === point.trade
              const win = point.netPnl >= 0
              const fill = win ? (isDark ? '#34d399' : '#059669') : isDark ? '#f87171' : '#dc2626'
              return (
                <g key={point.label}>
                  {selected && (
                    <circle
                      cx={point.x}
                      cy={point.svgY}
                      r="6"
                      fill="none"
                      stroke={fill}
                      strokeWidth="1.2"
                      opacity="0.5"
                    />
                  )}
                  <circle
                    cx={point.x}
                    cy={point.svgY}
                    r={selected ? 3.2 : 2.6}
                    fill={fill}
                    stroke={isDark ? '#0f172a' : '#fff'}
                    strokeWidth="1.2"
                    className="cursor-pointer"
                    onClick={() =>
                      onPointClick({
                        trade: point.trade,
                        netPnl: point.netPnl,
                        entryTime: point.entryTime,
                        cumulativePnL: point.cumulativePnL,
                      })
                    }
                  />
                </g>
              )
            })}
          </svg>
        </div>

        <div className="flex justify-between gap-2 mt-2 mb-3">
          {svgPoints.map((point) => (
            <button
              key={point.label}
              type="button"
              onClick={() =>
                onPointClick({
                  trade: point.trade,
                  netPnl: point.netPnl,
                  entryTime: point.entryTime,
                  cumulativePnL: point.cumulativePnL,
                })
              }
              className={`flex-1 min-w-0 text-center rounded-lg py-1.5 px-1 transition-colors ${
                selectedTimelinePoint?.trade === point.trade
                  ? isDark
                    ? 'bg-slate-800 ring-1 ring-violet-500/50'
                    : 'bg-violet-50 ring-1 ring-violet-300'
                  : isDark
                    ? 'hover:bg-slate-800/80'
                    : 'hover:bg-slate-100'
              }`}
            >
              <span className={`block text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {point.label}
              </span>
              <span
                className={`block text-xs font-semibold tabular-nums ${
                  point.netPnl >= 0
                    ? isDark
                      ? 'text-emerald-400'
                      : 'text-emerald-600'
                    : isDark
                      ? 'text-red-400'
                      : 'text-red-600'
                }`}
              >
                {point.netPnl >= 0 ? '+' : ''}$
                {Math.abs(point.netPnl).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
            </button>
          ))}
        </div>

        <p className={`text-[10px] pb-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{footerLeft}</p>
      </div>

      {selectedTimelinePoint && (
        <div
          className={`mx-4 mb-4 p-3 rounded-lg border text-xs ${
            isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {selectedTimelinePoint.trade.symbol}{' '}
              {selectedTimelinePoint.trade.direction?.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={onPointClose}
              className={isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}
            >
              ×
            </button>
          </div>
          <div className={`grid grid-cols-2 gap-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <span>
              Entry {selectedTimelinePoint.trade.entry_price?.toFixed(2)} → Exit{' '}
              {selectedTimelinePoint.trade.exit_price?.toFixed(2)}
            </span>
            <span className="text-right tabular-nums">
              {selectedTimelinePoint.netPnl >= 0 ? '+' : ''}$
              {selectedTimelinePoint.netPnl.toFixed(2)} net
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
