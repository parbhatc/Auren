import { Lock } from 'lucide-react'
import { usePracticeLockout } from '../../../hooks/usePracticeLockout'
import { t } from '../../../utils/translator'

/** Slim lockout strip under the header when trading is locked. */
export default function PracticeLockoutCard({
  practiceAccountId,
  isDark,
}: {
  practiceAccountId: string
  isDark: boolean
}) {
  const { status, countdown, isActiveAccount } = usePracticeLockout(practiceAccountId)

  if (!isActiveAccount || !status?.locked) return null

  const timerLabel =
    countdown ||
    (status.reason === 'daily_loss' || status.reason === 'max_trades'
      ? status.untilLabel
      : null)

  return (
    <div
      className={`flex items-center justify-center gap-1.5 border-b h-6 px-2 shrink-0 text-[11px] leading-none tabular-nums ${
        isDark
          ? 'border-red-500/25 bg-red-950/25 text-red-300/90'
          : 'border-red-200/80 bg-red-50/90 text-red-700'
      }`}
      role="status"
    >
      <Lock className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
      <span className="font-medium">{t('practice.lockout.lockedShort')}</span>
      {timerLabel ? (
        <>
          <span className="opacity-40" aria-hidden>
            ·
          </span>
          <span className="font-semibold">{timerLabel}</span>
        </>
      ) : null}
    </div>
  )
}
