import type { PracticeAccountMode, PracticeAccountRules } from '../../../../constants/practice'
import type { PracticeAccountSize } from '../../../../services/practice/practicePlans'
import { t } from '../../../../utils/translator'
import Modal from '../../../ui/Modal'
import NewAccountSection from './NewAccountSection'
import { Plus } from 'lucide-react'

export default function NewAccountModal({
  isOpen,
  isDark,
  newMode,
  newSize,
  customRules,
  marketAccountId,
  onClose,
  onModeChange,
  onSizeChange,
  onCreateClick,
}: {
  isOpen: boolean
  isDark: boolean
  newMode: PracticeAccountMode
  newSize: PracticeAccountSize
  customRules: PracticeAccountRules
  marketAccountId: string
  onClose: () => void
  onModeChange: (mode: PracticeAccountMode) => void
  onSizeChange: (size: PracticeAccountSize) => void
  onCreateClick: () => void
}) {
  const canCreate = Boolean(marketAccountId)

  return (
    <Modal
      isOpen={isOpen}
      isDark={isDark}
      onClose={onClose}
      title={t('practice.hub.newAccount')}
      size="xl"
      bodyClassName="max-h-[min(80vh,720px)]"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-medium border ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onCreateClick}
            disabled={!canCreate}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-violet-500/25"
          >
            <Plus className="w-4 h-4" aria-hidden />
            {t('practice.hub.create')}
          </button>
        </>
      }
    >
      <NewAccountSection
        isDark={isDark}
        newMode={newMode}
        newSize={newSize}
        customRules={customRules}
        marketAccountId={marketAccountId}
        onModeChange={onModeChange}
        onSizeChange={onSizeChange}
        onCreateClick={onCreateClick}
        embedded
      />
    </Modal>
  )
}
