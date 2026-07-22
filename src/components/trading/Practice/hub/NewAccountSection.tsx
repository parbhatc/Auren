import type { PracticeAccountMode, PracticeAccountRules } from '../../../../constants/practice'
import {
  PRACTICE_ACCOUNT_SIZES,
  type PracticeAccountSize,
} from '../../../../services/practice/practicePlans'
import { t } from '../../../../utils/translator'
import PlanSizeCard from '../PlanSizeCard'
import { HubCard } from './HubCard'
import { practiceModePillClass } from './practiceHubStyles'
import { Plus } from 'lucide-react'

export default function NewAccountSection({
  isDark,
  newMode,
  newSize,
  customRules,
  marketAccountId,
  onModeChange,
  onSizeChange,
  onCreateClick,
  embedded = false,
}: {
  isDark: boolean
  newMode: PracticeAccountMode
  newSize: PracticeAccountSize
  customRules: PracticeAccountRules
  marketAccountId: string
  onModeChange: (mode: PracticeAccountMode) => void
  onSizeChange: (size: PracticeAccountSize) => void
  onCreateClick: () => void
  /** When true, omits card chrome and create button (used inside NewAccountModal). */
  embedded?: boolean
}) {
  const form = (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {(['eval', 'funded'] as PracticeAccountMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={practiceModePillClass(isDark, m, newMode === m)}
          >
            {m === 'eval' ? t('practice.hub.eval') : t('practice.hub.funded')}
          </button>
        ))}
      </div>

      {newMode === 'eval' && (
        <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
          {t('practice.hub.evalRulesHint')}
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        {PRACTICE_ACCOUNT_SIZES.map((s) => (
          <PlanSizeCard
            key={s}
            size={s}
            mode={newMode}
            selected={newSize === s}
            isDark={isDark}
            onSelect={() => onSizeChange(s)}
            customRules={newSize === s ? customRules : undefined}
          />
        ))}
      </div>

      {!embedded && (
        <button
          type="button"
          onClick={onCreateClick}
          disabled={!marketAccountId}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-50 sm:w-auto ${
            isDark
              ? 'bg-[#FAFAFA] text-[#09090B] hover:bg-[#E4E4E7]'
              : 'bg-[#18181B] text-white hover:bg-[#27272A]'
          }`}
        >
          <Plus className="w-4 h-4" />
          {t('practice.hub.create')}
        </button>
      )}
    </>
  )

  if (embedded) return form

  return <HubCard isDark={isDark} title={t('practice.hub.newAccount')}>{form}</HubCard>
}
