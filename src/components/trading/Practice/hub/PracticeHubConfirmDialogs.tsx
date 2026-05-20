import { useMemo, useRef, useState } from 'react'
import ConfirmDialog from '../../../common/ConfirmDialog'
import type { PracticeAccountMode, PracticeAccountRules } from '../../../../constants/practice'
import {
  getDefaultPracticeRules,
  getPracticePlanCardTitle,
  practicePlanCardTitleClass,
  type PracticeAccountSize,
} from '../../../../services/practice/practicePlans'
import { t } from '../../../../utils/translator'
import PracticeInlineRulesForm, {
  type PracticeInlineRulesFormHandle,
} from './PracticeInlineRulesForm'
import PracticeHubModal from './PracticeHubModal'

type HubConfirm = 'create' | 'reset' | 'delete' | 'resetAll' | null

export default function PracticeHubConfirmDialogs({
  confirm,
  isDark,
  newMode,
  newSize,
  customRules,
  confirmAccountTitle,
  confirmLoading,
  onConfirm,
  onCancel,
  onRulesChange,
}: {
  confirm: HubConfirm
  isDark: boolean
  newMode: PracticeAccountMode
  newSize: PracticeAccountSize
  customRules: PracticeAccountRules
  confirmAccountTitle: string
  confirmLoading?: boolean
  onConfirm: (rules?: PracticeAccountRules) => void
  onCancel: () => void
  onRulesChange: (rules: PracticeAccountRules) => void
}) {
  const createTitle = getPracticePlanCardTitle(newSize, newMode)
  const defaults = useMemo(() => getDefaultPracticeRules(newSize, newMode), [newSize, newMode])
  const rulesFormRef = useRef<PracticeInlineRulesFormHandle>(null)
  const [rulesValidationError, setRulesValidationError] = useState<string | null>(null)

  const handleCreateConfirm = () => {
    const committed = rulesFormRef.current?.commitPending() ?? customRules
    const err = rulesFormRef.current?.validate() ?? null
    if (err) {
      setRulesValidationError(err)
      return
    }
    setRulesValidationError(null)
    onRulesChange(committed)
    onConfirm(committed)
  }

  const handleCreateCancel = () => {
    setRulesValidationError(null)
    onCancel()
  }

  return (
    <>
      <PracticeHubModal
        isOpen={confirm === 'create'}
        isDark={isDark}
        isLoading={confirmLoading}
        title={t('practice.hub.confirmCreateTitle')}
        description={t('practice.hub.confirmCreateMessage')}
        confirmText={t('common.create')}
        cancelText={t('common.cancel')}
        onConfirm={handleCreateConfirm}
        onCancel={handleCreateCancel}
        badge={
          <span
            className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-bold tracking-wide ${practicePlanCardTitleClass(newMode, isDark)} ${
              isDark
                ? newMode === 'eval'
                  ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30'
                  : 'bg-amber-500/15 ring-1 ring-amber-500/30'
                : newMode === 'eval'
                  ? 'bg-emerald-50 ring-1 ring-emerald-200'
                  : 'bg-amber-50 ring-1 ring-amber-200'
            }`}
          >
            {createTitle}
          </span>
        }
      >
        <PracticeInlineRulesForm
          ref={rulesFormRef}
          isDark={isDark}
          mode={newMode}
          size={newSize}
          rules={customRules}
          defaults={defaults}
          validationError={rulesValidationError}
          onChange={(next) => {
            setRulesValidationError(null)
            onRulesChange(next)
          }}
          onReset={() => {
            setRulesValidationError(null)
            onRulesChange(getDefaultPracticeRules(newSize, newMode))
          }}
        />
      </PracticeHubModal>

      <PracticeHubModal
        isOpen={confirm === 'reset'}
        isDark={isDark}
        isLoading={confirmLoading}
        title={t('practice.hub.confirmResetTitle')}
        description={t('practice.hub.confirmResetMessage', { account: confirmAccountTitle })}
        confirmText={t('practice.hub.reset')}
        cancelText={t('common.cancel')}
        onConfirm={() => onConfirm()}
        onCancel={onCancel}
        confirmVariant="warning"
      />

      <ConfirmDialog
        isOpen={confirm === 'delete'}
        title={t('practice.hub.confirmDeleteTitle')}
        message={t('practice.hub.confirmDeleteMessage', { account: confirmAccountTitle })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => onConfirm()}
        onCancel={onCancel}
        variant="danger"
        isDark={isDark}
      />

      <ConfirmDialog
        isOpen={confirm === 'resetAll'}
        title={t('practice.hub.confirmResetAllTitle')}
        message={t('practice.hub.resetAllConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => onConfirm()}
        onCancel={onCancel}
        variant="danger"
        isDark={isDark}
      />
    </>
  )
}
