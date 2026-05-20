import type { PracticeAccountMode, PracticeAccountRules } from '../../../../constants/practice'
import {
  PRACTICE_ACCOUNT_SIZES,
  type PracticeAccountSize,
} from '../../../../services/practice/practicePlans'
import { t } from '../../../../utils/translator'
import PracticePlanSizeCard from '../PracticePlanSizeCard'
import { PracticeHubCard } from './PracticeHubCard'
import { practiceModePillClass } from './practiceHubStyles'
import { Plus } from 'lucide-react'

export default function PracticeNewAccountSection({
  isDark,
  newMode,
  newSize,
  customRules,
  marketAccountId,
  onModeChange,
  onSizeChange,
  onCreateClick,
}: {
  isDark: boolean
  newMode: PracticeAccountMode
  newSize: PracticeAccountSize
  customRules: PracticeAccountRules
  marketAccountId: string
  onModeChange: (mode: PracticeAccountMode) => void
  onSizeChange: (size: PracticeAccountSize) => void
  onCreateClick: () => void
}) {
  return (
    <PracticeHubCard isDark={isDark} title={t('practice.hub.newAccount')}>
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
          <PracticePlanSizeCard
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

      <button
        type="button"
        onClick={onCreateClick}
        disabled={!marketAccountId}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-violet-500/25"
      >
        <Plus className="w-4 h-4" />
        {t('practice.hub.create')}
      </button>
    </PracticeHubCard>
  )
}
