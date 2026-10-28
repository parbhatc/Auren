import JournalScreenshotView from '../../journal/JournalScreenshotView'
import { lazy, Suspense, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  LineChart,
  ShieldCheck,
  Target,
  Zap,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  journalAPI,
  type JournalEntryRecord as ManualJournalEntry,
} from '../../api/journal.api'
import { ROUTES } from '../../constants/routes'
import { useTheme } from '../../hooks/useTheme'
import {
  WorkspaceShell,
  PageHeading,
  Surface,
} from '../../components/layout/WorkspacePrimitives'
import {
  conditionsForJournalEntry,
  formatConditionResponse,
  formatRiskLeg,
  journalOutcomeLabel,
} from '../../journal/journalConditions'

const JournalReviewChart = lazy(
  () => import('../../journal/JournalReviewChart')
)

export default function JournalTradeDetailPage() {
  const { tradeId } = useParams<{ tradeId: string }>()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [entry, setEntry] = useState<ManualJournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    if (!tradeId) {
      setError('This journal trade link is incomplete.')
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    setError('')
    setEntry(null)
    void journalAPI
      .getEntry(tradeId, controller.signal)
      .then((record) => {
        if (!cancelled) setEntry(record)
      })
      .catch(() => {
        if (!cancelled)
          setError(
            'This journal trade could not be found or you do not have access to it.'
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [tradeId])

  const outcomeColor =
    Number(entry?.pnl) > 0
      ? 'text-[var(--workspace-success)]'
      : Number(entry?.pnl) < 0
        ? 'text-red-500'
        : 'text-[#A1A1AA]'

  const sweepEvidence = entry
    ? formatConditionResponse(
        'Sweep',
        entry.conditionResponses?.Sweep ??
          entry.conditionResponses?.['Liquidity sweep'] ??
          ''
      )
    : ''
  const smtEvidence = entry ? String(entry.conditionResponses?.SMT || '') : ''
  const ifvgEvidence = entry ? String(entry.conditionResponses?.IFVG || '') : ''
  const midTapEvidence = entry
    ? String(entry.conditionResponses?.['MID Tap'] || '')
    : ''
  const calendarFilterEvidence = entry
    ? String(entry.conditionResponses?.['Calendar filter'] || '')
    : ''
  const hypotheticalResultEvidence = entry
    ? String(entry.conditionResponses?.['Hypothetical result'] || '')
    : ''
  const fvgTapEvidence = entry
    ? String(entry.conditionResponses?.['FVG Tap'] || '')
    : ''
  const fvgTapValidation = entry
    ? String(entry.conditionResponses?.['FVG Tap validation'] || '')
    : ''
  const isInvalidFvgTap = /^invalid\b/i.test(fvgTapValidation)
  const alignmentEvidence = entry
    ? String(entry.conditionResponses?.['NQ / ES alignment'] || '')
    : ''
  const candleQualityEvidence = entry
    ? String(entry.conditionResponses?.['Inverse candle quality'] || '')
    : ''
  const exitRuleEvidence = entry
    ? String(entry.conditionResponses?.['Exit rule'] || '')
    : ''
  const oneMinuteContext = entry
    ? String(entry.conditionResponses?.['1m context'] || '')
    : ''
  const esConfirmationEvidence = entry
    ? String(entry.conditionResponses?.['ES confirmation'] || '')
    : ''
  const executionQualityEvidence = entry
    ? String(entry.conditionResponses?.['Execution quality'] || '')
    : ''
  const nqConfirmationEvidence = entry
    ? String(
        entry.conditionResponses?.['NQ confirmation'] ||
          entry.conditionResponses?.['Entry confirmation'] ||
          ''
      )
    : ''
  const fvgTapDetail = formatConditionResponse('FVG Tap', fvgTapEvidence)
  const fvgTapTimeframe =
    fvgTapEvidence.match(/@\s*([^@]+?)\s*@/)?.[1]?.trim() || 'HTF'
  const isFvgTapSetup = Boolean(
    entry && (/fvg\s*tap/i.test(entry.playbook) || fvgTapEvidence)
  )
  const isMidTapIfvgSetup = Boolean(
    entry &&
    (/mid\s*tap/i.test(entry.playbook) || midTapEvidence) &&
    ifvgEvidence
  )
  const isFvgTapObservation =
    isFvgTapSetup && entry?.recap?.execution === 'observation'
  const isOpenFvgSetup = Boolean(
    isFvgTapSetup &&
    entry?.outcome === 'planned' &&
    entry?.recap?.execution === 'taken'
  )
  const isWinningFvgSetup = Boolean(isFvgTapSetup && entry?.outcome === 'win')
  const isSmtFvgTapSetup = Boolean(isFvgTapSetup && smtEvidence)
  const isSweepIfvgSetup = Boolean(
    entry &&
    !isFvgTapSetup &&
    !isMidTapIfvgSetup &&
    ifvgEvidence &&
    !smtEvidence
  )
  const isWinningSweepIfvg = Boolean(
    isSweepIfvgSetup && entry?.outcome === 'win'
  )
  const isBreakevenSweepIfvg = Boolean(
    isSweepIfvgSetup && entry?.outcome === 'breakeven'
  )
  const isSweepIfvgObservation = Boolean(
    isSweepIfvgSetup && entry?.recap?.execution === 'observation'
  )
  const hasOneHourSweepEvidence = /1h\s+high/i.test(sweepEvidence)
  const isCleanSingleIfvg = /clean\s+(?:single\s+)?(?:bullish\s+)?fvg/i.test(
    ifvgEvidence
  )
  const isBullishIfvg = /invert(?:ed|s)?\s+bullish/i.test(ifvgEvidence)
  const nqMissedCe =
    /NQ.*(?:did not|didn't|without).*?(?:consequent encroachment|\bCE\b)/i.test(
      fvgTapEvidence
    )
  const nqReachedCe =
    !nqMissedCe &&
    /NQ.*(?:tapped through|reached|tapped).*?(?:consequent encroachment|\bCE\b)/i.test(
      fvgTapEvidence
    )
  const nqCeContext = /barely/i.test(fvgTapEvidence)
    ? '1h FVG CE was only barely tapped'
    : '1h FVG CE tapped before the short'
  const smtStepDetail = smtEvidence.includes(';')
    ? smtEvidence.slice(smtEvidence.indexOf(';') + 1).trim()
    : smtEvidence
  const ifvgParts = ifvgEvidence.split(/\s*@\s*/)
  const ifvgStepDetail =
    ifvgParts.length >= 4
      ? `NQ formed the bearish ${ifvgParts[1]} FVG from ${ifvgParts.slice(3).join(' · ')}, then inverted it bullish at ${ifvgParts[0]}.`
      : ifvgEvidence
  const stopPrice = entry
    ? entry.riskPlan?.stopLoss?.price ||
      entry.sourceContext?.stopLossPrice ||
      ''
    : ''
  const targetPrice = entry
    ? entry.riskPlan?.takeProfit?.price ||
      entry.sourceContext?.takeProfitPrice ||
      ''
    : ''
  const price = (value: string) => {
    if (String(value || '').trim() === '') return '—'
    const amount = Number(value)
    return Number.isFinite(amount)
      ? amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '—'
  }
  const entryTime = entry
    ? new Date(entry.dateTime).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        ...(new Date(entry.dateTime).getSeconds()
          ? { second: '2-digit' as const }
          : {}),
      })
    : ''
  const exitTime = entry?.exitDateTime
    ? new Date(entry.exitDateTime).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        ...(new Date(entry.exitDateTime).getSeconds()
          ? { second: '2-digit' as const }
          : {}),
      })
    : ''
  const setupSteps = entry
    ? isMidTapIfvgSetup
      ? [
          {
            number: '01',
            label: 'MID Tap',
            title: 'NQ retests the MID level',
            detail:
              midTapEvidence ||
              'Record the MID level and the candle that touched it.',
            color: 'blue',
            icon: Target,
          },
          {
            number: '02',
            label: 'IFVG',
            title: `NQ confirms a ${entry.side === 'short' ? 'bearish' : 'bullish'} IFVG`,
            detail: ifvgEvidence,
            color: 'emerald',
            icon: Zap,
          },
          {
            number: '03',
            label: 'Calendar filter',
            title: 'Bank-holiday setup is passed',
            detail:
              calendarFilterEvidence ||
              'The technical setup formed, but the calendar filter prevented an execution.',
            color: 'violet',
            icon: ShieldCheck,
          },
          {
            number: '04',
            label: 'Review',
            title: 'The hypothetical trade would have stopped',
            detail:
              hypotheticalResultEvidence ||
              'Record how price invalidated the setup after the decision to stay flat.',
            color: 'amber',
            icon: AlertTriangle,
          },
        ]
      : isFvgTapSetup
        ? [
            {
              number: '01',
              label: 'Sweep',
              title: hasOneHourSweepEvidence
                ? sweepEvidence.includes('ES')
                  ? 'ES sweeps the 1h high'
                  : 'NQ sweeps the 1h high'
                : '9:50:30 AM high is swept',
              detail:
                sweepEvidence ||
                'Record the source high and the candle that swept it.',
              color: 'blue',
              icon: Target,
            },
            ...(isSmtFvgTapSetup
              ? [
                  {
                    number: '02',
                    label: 'SMT',
                    title: 'NQ lower low · ES higher low',
                    detail: smtEvidence,
                    color: 'violet',
                    icon: LineChart,
                  },
                ]
              : []),
            {
              number: isSmtFvgTapSetup ? '03' : '02',
              label: 'FVG Tap',
              title: isInvalidFvgTap
                ? 'Invalid FVG Tap reaction'
                : `NQ reacts from the ${fvgTapTimeframe} FVG`,
              detail:
                [fvgTapDetail, fvgTapValidation].filter(Boolean).join('\n\n') ||
                'Record the higher-timeframe FVG reaction and CE depth.',
              color: 'violet',
              icon: BookOpenCheck,
            },
            {
              number: isSmtFvgTapSetup ? '04' : '03',
              label: 'IFVG',
              title: isBullishIfvg
                ? '30s FVG inverts bullish'
                : isCleanSingleIfvg
                  ? 'Clean 30s FVG inverses bearish'
                  : 'Two 30s FVGs invert',
              detail: ifvgEvidence,
              color: 'emerald',
              icon: Zap,
            },
            {
              number: isSmtFvgTapSetup ? '05' : '04',
              label: isFvgTapObservation
                ? 'Quality decision'
                : isOpenFvgSetup
                  ? 'Trade plan'
                  : 'Exit rule',
              title: isFvgTapObservation
                ? oneMinuteContext
                  ? 'Passed while the 1m FVG held'
                  : 'Observed, not taken'
                : isOpenFvgSetup
                  ? `${entry.side === 'long' ? 'Long' : 'Short'} ${price(entry.entryPrice)} → ${price(targetPrice)}`
                  : isWinningFvgSetup
                    ? `Target reached at ${exitTime}`
                    : `Stop reached${exitTime ? ` at ${exitTime}` : ''}`,
              detail: isFvgTapObservation
                ? [
                    candleQualityEvidence,
                    alignmentEvidence,
                    oneMinuteContext,
                    exitRuleEvidence,
                  ]
                    .filter(Boolean)
                    .join('\n\n')
                : isOpenFvgSetup
                  ? `Protection ${entry.side === 'long' ? 'below' : 'above'} ${price(stopPrice)}. ${esConfirmationEvidence || alignmentEvidence}`
                  : [exitRuleEvidence, oneMinuteContext]
                      .filter(Boolean)
                      .join('\n\n'),
              color: 'amber',
              icon: ShieldCheck,
            },
          ]
        : isSweepIfvgSetup
          ? [
              {
                number: '01',
                label: 'Sweep',
                title:
                  /london/i.test(sweepEvidence) &&
                  /(?:1h|1 hour)/i.test(sweepEvidence)
                    ? `London, 4h, and 1h ${entry.side === 'short' ? 'highs' : 'lows'} are swept`
                    : `NQ sweeps ${entry.side === 'short' ? 'high-side' : 'low-side'} liquidity`,
                detail:
                  sweepEvidence ||
                  'Record the swept dealing-range and session levels.',
                color: 'blue',
                icon: BookOpenCheck,
              },
              {
                number: '02',
                label: 'IFVG',
                title: `NQ confirms a ${entry.side === 'short' ? 'bearish' : 'bullish'} IFVG`,
                detail: ifvgEvidence,
                color: 'emerald',
                icon: Zap,
              },
              {
                number: '03',
                label: 'Confirmation',
                title: esConfirmationEvidence
                  ? `ES ${/not|partial|without|no clean/i.test(esConfirmationEvidence) ? 'does not fully confirm' : `confirms ${entry.side === 'short' ? 'bearish' : 'bullish'}`}`
                  : 'Cross-market confirmation not recorded',
                detail:
                  esConfirmationEvidence ||
                  alignmentEvidence ||
                  'No separate ES confirmation was recorded for this setup.',
                color: 'violet',
                icon: LineChart,
              },
              {
                number: '04',
                label: isSweepIfvgObservation ? 'Decision' : 'Exit',
                title: isSweepIfvgObservation
                  ? executionQualityEvidence
                    ? 'No retracement — not taken'
                    : 'Observed, not taken'
                  : isBreakevenSweepIfvg
                    ? `Breakeven exit${exitTime ? ` at ${exitTime}` : ''}`
                    : isWinningSweepIfvg
                      ? `Target reached at ${exitTime}`
                      : `${entry.side === 'long' ? 'Long' : 'Short'} ${price(entry.entryPrice)} → ${price(targetPrice)}`,
                detail: isSweepIfvgObservation
                  ? executionQualityEvidence ||
                    'The setup was studied without an execution.'
                  : exitRuleEvidence ||
                    `Protection ${entry.side === 'long' ? 'below' : 'above'} ${price(stopPrice)} with the objective at ${price(targetPrice)}.`,
                color: 'amber',
                icon: Target,
              },
            ]
          : [
              {
                number: '01',
                label: 'Liquidity sweep',
                title: 'NQ sweeps the 9:31:30 AM low',
                detail:
                  sweepEvidence ||
                  'The source low and sweep time were not recorded.',
                color: 'blue',
                icon: BookOpenCheck,
              },
              {
                number: '02',
                label: 'SMT divergence',
                title: 'NQ lower low · ES higher low',
                detail:
                  smtStepDetail ||
                  'Compare NQ with ES and record which market swept while the other held structure.',
                color: 'violet',
                icon: LineChart,
              },
              {
                number: '03',
                label: 'Entry trigger',
                title: 'Bearish FVG inverses bullish',
                detail:
                  ifvgStepDetail ||
                  'Record the source candles and the candle that confirmed inversion.',
                color: 'emerald',
                icon: Zap,
              },
              {
                number: '04',
                label: 'Trade plan',
                title: `Long ${price(entry.entryPrice)} → ${price(targetPrice)}`,
                detail: `Invalidation below ${price(stopPrice)}. Target the external high while staying aware of the bearish FVG above.`,
                color: 'amber',
                icon: Target,
              },
            ]
    : []
  const sequenceLabel = isFvgTapSetup
    ? `Sweep → ${isSmtFvgTapSetup ? 'SMT → ' : ''}${isInvalidFvgTap ? 'invalid FVG Tap' : 'FVG Tap'} → IFVG → ${isFvgTapObservation ? 'observation' : isOpenFvgSetup ? `${entry.side} open` : isWinningFvgSetup ? 'target' : 'stop'}`
    : isMidTapIfvgSetup
      ? 'MID Tap → IFVG → bank-holiday pass → hypothetical stop'
      : isSweepIfvgSetup
        ? `Sweep → IFVG → ${isSweepIfvgObservation ? 'observation' : isBreakevenSweepIfvg ? 'breakeven' : isWinningSweepIfvg ? 'target' : entry.outcome === 'loss' ? 'stop' : `${entry.side} open`}`
        : 'Sweep → SMT → IFVG → long'
  const chartHeading =
    isFvgTapSetup || isMidTapIfvgSetup || isSweepIfvgSetup
      ? `NQ and ES ${entry.sourceContext?.chartResolution || '30s'} context at ${entryTime}`
      : 'NQ 30s entry, invalidation and objective'
  const chartContextCards = isFvgTapSetup
    ? isSmtFvgTapSetup
      ? [
          ['Bullish SMT', smtEvidence],
          [
            'ES conflict',
            alignmentEvidence ||
              'ES respected 30s support while tapping an opposing bearish FVG',
          ],
        ]
      : isOpenFvgSetup || isWinningFvgSetup
        ? [
            [
              'NQ HTF reaction',
              nqMissedCe
                ? '15m FVG tap confirmed after the 1h high sweep'
                : 'Higher-timeframe FVG reaction confirmed',
            ],
            [
              'ES confirmation',
              esConfirmationEvidence ||
                alignmentEvidence ||
                'ES confirmed the bearish delivery',
            ],
          ]
        : isFvgTapObservation && !nqReachedCe
          ? [
              ['NQ HTF reaction', '1h FVG touched; CE was not reached'],
              [
                'Alignment weakness',
                oneMinuteContext || alignmentEvidence || 'Bias was not aligned',
              ],
            ]
          : [
              ['NQ HTF reaction', nqCeContext],
              [
                'Alignment weakness',
                oneMinuteContext || alignmentEvidence || 'Bias was not aligned',
              ],
            ]
    : isMidTapIfvgSetup
      ? [
          ['MID reaction', midTapEvidence],
          [
            'Why it stayed an observation',
            calendarFilterEvidence || hypotheticalResultEvidence,
          ],
        ]
      : isSweepIfvgSetup
        ? [
            ['NQ confirmation', nqConfirmationEvidence || ifvgEvidence],
            [
              'ES context',
              esConfirmationEvidence ||
                alignmentEvidence ||
                'No separate ES confirmation was recorded for this setup.',
            ],
          ]
        : [
            ['NQ side of SMT', 'Makes the lower low, then displaces'],
            ['ES side of SMT', 'Makes the higher low and reclaims its FVG'],
          ]

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 xl:px-9">
        <button
          type="button"
          onClick={() => navigate('/journal')}
          className={`mb-5 inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${isDark ? 'border-[var(--app-border)] text-[#D4D4D8] hover:bg-[var(--app-hover)]' : 'border-[var(--app-border)] text-[#3F3F46] hover:bg-[var(--app-inset)]'}`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to journal
        </button>

        {loading && (
          <Surface className="flex min-h-72 items-center justify-center p-8 text-sm text-[#71717A]">
            Loading trade review…
          </Surface>
        )}
        {!loading && error && (
          <Surface className="p-8 text-center">
            <p
              className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
            >
              Trade review unavailable
            </p>
            <p className="mt-2 text-xs text-[#71717A]">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/journal')}
              className={`mt-5 h-9 rounded-lg px-4 text-xs font-semibold ${isDark ? 'bg-[var(--app-button)] text-[var(--app-button-text)]' : 'bg-[var(--app-button)] text-[var(--app-button-text)]'}`}
            >
              Return to journal
            </button>
          </Surface>
        )}

        {!loading && entry && (
          <>
            <PageHeading
              eyebrow="Journal trade review"
              title={`${entry.symbol} setup evidence`}
              description={`${entry.playbook} · ${new Date(entry.dateTime).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`}
              actions={
                <>
                  <Link
                    to={`${ROUTES.JOURNAL}?edit=${encodeURIComponent(entry.id)}`}
                    className="rounded-lg bg-[var(--app-button)] !text-[var(--app-button-text)] px-3 py-2 text-xs font-semibold text-white"
                  >
                    Edit recap
                  </Link>
                  {entry.source && entry.source !== 'manual' && (
                    <span className="inline-flex rounded-md border border-[var(--workspace-border)] bg-[var(--workspace-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--workspace-accent)]">
                      {entry.source} capture
                    </span>
                  )}
                  {entry.source === 'replay' && entry.sourceSessionId && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `${ROUTES.BACKTESTER_CHART}?sessionId=${encodeURIComponent(entry.sourceSessionId || '')}`
                        )
                      }
                      className={`inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium ${isDark ? 'border-[var(--app-border)] text-[#D4D4D8] hover:bg-[var(--app-hover)]' : 'border-[var(--app-border)] text-[#3F3F46] hover:bg-[var(--app-inset)]'}`}
                    >
                      Open replay
                    </button>
                  )}
                  <div
                    className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${entry.outcome === 'win' ? 'border-emerald-500/30 bg-emerald-500/10 text-[var(--workspace-success)]' : entry.outcome === 'loss' ? 'border-red-500/30 bg-red-500/10 text-red-500' : isDark ? 'border-[var(--app-border)] text-[#A1A1AA]' : 'border-[var(--app-border)] text-[#52525B]'}`}
                  >
                    {journalOutcomeLabel(entry)}
                  </div>
                </>
              }
            />

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {[
                [
                  'Entry',
                  entry.entryPrice
                    ? `$${Number(entry.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : '—',
                ],
                [
                  'Close',
                  entry.closePrice
                    ? `$${Number(entry.closePrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : '—',
                ],
                [
                  entry.sourceContext?.pnlBasis === 'gross'
                    ? 'Gross P&L'
                    : 'Net P&L',
                  entry.pnl
                    ? `${Number(entry.pnl) >= 0 ? '+' : '-'}$${Math.abs(Number(entry.pnl)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : '—',
                ],
                ['Size', entry.size || '—'],
                ['Side', entry.side],
                [
                  'Duration',
                  entry.exitDateTime
                    ? `${Math.max(0, Math.round((new Date(entry.exitDateTime).getTime() - new Date(entry.dateTime).getTime()) / 60000))} min`
                    : '—',
                ],
              ].map(([label, value]) => (
                <Surface key={label} className="p-3 sm:p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#71717A]">
                    {label}
                  </p>
                  <p
                    className={`mt-1.5 truncate text-sm font-semibold capitalize ${label.endsWith('P&L') ? outcomeColor : isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                  >
                    {value}
                  </p>
                </Surface>
              ))}
            </div>

            {entry.recap && (
              <Surface className="mb-5 p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
                      Setup thesis
                    </p>
                    <h2
                      className={`mt-1 text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}
                    >
                      {entry.recap.title || 'Session recap'}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-[#A1A1AA]">
                    {entry.recap.session && (
                      <span className="rounded-md bg-zinc-500/10 px-2 py-1">
                        {entry.recap.session}
                      </span>
                    )}
                    {entry.recap.execution && (
                      <span className="rounded-md bg-zinc-500/10 px-2 py-1 capitalize">
                        {entry.recap.execution}
                      </span>
                    )}
                    {entry.recap.grade && (
                      <span className="rounded-md bg-zinc-500/10 px-2 py-1">
                        Grade {entry.recap.grade}
                      </span>
                    )}
                  </div>
                </div>
                {entry.recap.lesson && (
                  <p
                    className={`mt-4 max-w-5xl whitespace-pre-line text-sm leading-6 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                  >
                    {entry.recap.lesson}
                  </p>
                )}
                {(entry.recap.pros?.length || entry.recap.cons?.length) && (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--workspace-success)]">
                        <CheckCircle2 className="h-4 w-4" /> Pros
                      </div>
                      <ul
                        className={`mt-3 space-y-2 text-sm leading-6 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                      >
                        {(entry.recap.pros ?? []).map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="text-[var(--workspace-success)]">
                              +
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--workspace-warning)]">
                        <AlertTriangle className="h-4 w-4" /> Cons
                      </div>
                      <ul
                        className={`mt-3 space-y-2 text-sm leading-6 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                      >
                        {(entry.recap.cons ?? []).map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="text-[var(--workspace-warning)]">
                              −
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </Surface>
            )}

            <Surface className="mb-5 p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
                    Setup sequence
                  </p>
                  <h2
                    className={`mt-1 text-base font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}
                  >
                    How the trade developed
                  </h2>
                </div>
                <p className="text-xs text-[#71717A]">{sequenceLabel}</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {setupSteps.map((step, index) => {
                  const Icon = step.icon
                  const accent =
                    step.color === 'violet'
                      ? 'border-[var(--workspace-border)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]'
                      : step.color === 'emerald'
                        ? 'border-zinc-500/25 bg-zinc-500/5 text-[var(--workspace-accent)]'
                        : step.color === 'amber'
                          ? 'border-zinc-500/25 bg-zinc-500/5 text-[var(--workspace-accent)]'
                          : 'border-[var(--workspace-border)] bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]'
                  return (
                    <div key={step.number} className="relative flex min-h-44">
                      <div className={`w-full rounded-xl border p-4 ${accent}`}>
                        <div className="flex items-center justify-between">
                          <Icon className="h-4 w-4" />
                          <span className="text-[10px] font-bold tracking-[0.12em] opacity-70">
                            {step.number}
                          </span>
                        </div>
                        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] opacity-80">
                          {step.label}
                        </p>
                        <h3
                          className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}
                        >
                          {step.title}
                        </h3>
                        <p
                          className={`mt-2 text-[11px] leading-5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}
                        >
                          {step.detail}
                        </p>
                      </div>
                      {index < setupSteps.length - 1 && (
                        <ArrowRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-[#52525B] xl:block" />
                      )}
                    </div>
                  )
                })}
              </div>
            </Surface>

            <Surface className="p-2 sm:p-4">
              <div className="mb-3 flex flex-col gap-3 px-2 pt-1 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--workspace-accent)]">
                    Annotated trade picture
                  </p>
                  <h2
                    className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}
                  >
                    {chartHeading}
                  </h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {chartContextCards.map(([label, detail]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-accent-soft)] px-3 py-2"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--workspace-accent)]">
                        {label}
                      </p>
                      <p
                        className={`mt-1 text-[11px] ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}
                      >
                        {detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <Suspense
                fallback={
                  <div
                    className="flex min-h-80 items-center justify-center text-sm text-zinc-500"
                    role="status"
                  >
                    Loading review chart…
                  </div>
                }
              >
                <JournalReviewChart entry={entry} isDark={isDark} />
              </Suspense>
              <p className="px-2 pb-1 pt-3 text-[10px] leading-4 text-[#71717A]">
                Drag to pan and scroll to zoom. BWC-native boxes mark the saved
                HTF PDA and IFVG zones; bounded level segments connect each
                source high or low to its sweep.
              </p>
            </Surface>

            {!!entry.recap?.screenshots?.length && (
              <details
                className={`mt-4 rounded-xl border ${isDark ? 'border-[var(--app-border)] bg-[var(--app-inset)]' : 'border-[var(--app-border)] bg-white'}`}
              >
                <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-[#A1A1AA]">
                  Original replay capture · {entry.recap.screenshots.length}{' '}
                  {entry.recap.screenshots.length === 1 ? 'image' : 'images'}
                </summary>
                <div className="space-y-4 border-t border-zinc-500/20 p-4">
                  {entry.recap.screenshots.map((image, index) => (
                    <figure key={image.id}>
                      <JournalScreenshotView image={image} />
                      <figcaption className="mt-2 text-xs text-[#71717A]">
                        {image.caption || `Chart ${index + 1}`}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </details>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
              <Surface className="p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="h-4 w-4 text-[var(--workspace-accent)]" />
                  <h2
                    className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                  >
                    Playbook building blocks
                  </h2>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {conditionsForJournalEntry(entry).map(({ label }) => (
                    <div
                      key={label}
                      className={`rounded-lg border p-3 ${isDark ? 'border-[var(--app-border)] bg-[var(--app-inset)]' : 'border-[var(--app-border)] bg-[var(--app-inset)]'}`}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#71717A]">
                        {label}
                      </p>
                      <p
                        className={`mt-2 whitespace-pre-line text-xs leading-5 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                      >
                        {formatConditionResponse(
                          label,
                          entry.conditionResponses[label] ?? ''
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </Surface>
              <Surface className="p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-[var(--workspace-accent)]" />
                  <h2
                    className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                  >
                    Execution notes
                  </h2>
                </div>
                <p
                  className={`mt-4 whitespace-pre-line text-xs leading-6 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                >
                  {entry.notes || 'No notes recorded.'}
                </p>
                {entry.riskPlan && (
                  <div
                    className={`mt-5 border-t pt-4 ${isDark ? 'border-[var(--app-border)]' : 'border-[var(--app-border)]'}`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-[var(--workspace-accent)]" />
                      <h3
                        className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                      >
                        Risk and exit plan
                      </h3>
                    </div>
                    <div className="mt-3 space-y-2 text-[11px]">
                      <div className="flex justify-between gap-3">
                        <span className="text-[#71717A]">Stop loss</span>
                        <span
                          className={`text-right ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                        >
                          {formatRiskLeg(entry.riskPlan.stopLoss)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#71717A]">Breakeven</span>
                        <span
                          className={`text-right ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                        >
                          {entry.riskPlan.breakEven?.enabled
                            ? formatRiskLeg(entry.riskPlan.breakEven)
                            : 'Not used'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#71717A]">Take profit</span>
                        <span
                          className={`text-right ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}
                        >
                          {formatRiskLeg(entry.riskPlan.takeProfit)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {entry.source && entry.source !== 'manual' && (
                  <div
                    className={`mt-5 border-t pt-4 text-[11px] ${isDark ? 'border-[var(--app-border)]' : 'border-[var(--app-border)]'}`}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="text-[#71717A]">Captured from</span>
                      <span
                        className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}
                      >
                        {entry.sourceContext?.sessionName ||
                          entry.sourceSessionId ||
                          entry.source}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between gap-3">
                      <span className="text-[#71717A]">Chart context</span>
                      <span
                        className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}
                      >
                        {entry.sourceContext?.chartResolution || '—'} ·{' '}
                        {entry.sourceContext?.snapshotKind?.replace('_', ' ') ||
                          'cursor'}
                      </span>
                    </div>
                  </div>
                )}
                <div
                  className={`mt-5 border-t pt-4 text-[11px] ${isDark ? 'border-[var(--app-border)]' : 'border-[var(--app-border)]'}`}
                >
                  <div className="flex justify-between gap-3">
                    <span className="text-[#71717A]">Entry time</span>
                    <span
                      className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}
                    >
                      {new Date(entry.dateTime).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="text-[#71717A]">Exit time</span>
                    <span
                      className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}
                    >
                      {entry.exitDateTime
                        ? new Date(entry.exitDateTime).toLocaleString()
                        : 'Not recorded'}
                    </span>
                  </div>
                </div>
              </Surface>
            </div>
          </>
        )}
      </main>
    </WorkspaceShell>
  )
}
