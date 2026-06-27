import { Component } from 'react'
import { Save } from 'lucide-react'
import Modal from '../common/Modal'
import ErrorMessage from '../common/ErrorMessage'
import { CreateSessionModalProps } from '../../types/backtester'
import {
  fieldLabelClass,
  ghostButtonClass,
  primaryButtonClass,
  settingsInputClass,
} from '../../styles/aurenTheme'
import { t } from '../../utils/translator'

class CreateSessionModal extends Component<CreateSessionModalProps> {
  render() {
    const {
      isOpen,
      isDark,
      availableSymbols,
      newSession,
      symbolsError,
      createError,
      onClose,
      onSessionChange,
      onCreate,
    } = this.props

    return (
      <Modal
        isOpen={isOpen}
        title={t('backtester.createSession')}
        onClose={onClose}
        size="md"
        isDark={isDark}
      >
        <div className="space-y-4">
          {symbolsError && <ErrorMessage message={symbolsError} isDark={isDark} />}
          {createError && <ErrorMessage message={createError} isDark={isDark} />}

          <div>
            <label className={fieldLabelClass(isDark)}>
              {t('backtester.sessionName')} *
            </label>
            <input
              type="text"
              placeholder={t('backtester.sessionNamePlaceholder')}
              value={newSession.name}
              onChange={(e) => onSessionChange({ ...newSession, name: e.target.value })}
              className={settingsInputClass(isDark)}
            />
          </div>

          {availableSymbols.length === 0 && (
            <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>
              {t('backtester.noSymbolsAvailable')}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={fieldLabelClass(isDark)}>
                {t('backtester.date')} *
              </label>
              <input
                type="date"
                value={newSession.date}
                onChange={(e) => onSessionChange({ ...newSession, date: e.target.value })}
                className={settingsInputClass(isDark)}
              />
            </div>
            <div>
              <label className={fieldLabelClass(isDark)}>
                {t('backtester.startTime')} *
              </label>
              <input
                type="time"
                value={newSession.startTime}
                onChange={(e) => onSessionChange({ ...newSession, startTime: e.target.value })}
                className={settingsInputClass(isDark)}
              />
            </div>
          </div>

          <div>
            <label className={fieldLabelClass(isDark)}>
              {t('backtester.balance', {}, 'Balance')} *
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              placeholder="50000"
              value={newSession.balance || ''}
              onChange={(e) =>
                onSessionChange({
                  ...newSession,
                  balance: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              className={settingsInputClass(isDark)}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-800/50">
            <button type="button" onClick={onClose} className={ghostButtonClass(isDark)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={availableSymbols.length === 0}
              className={`flex items-center justify-center gap-2 sm:ml-auto ${primaryButtonClass()} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              {t('common.create')}
            </button>
          </div>
        </div>
      </Modal>
    )
  }
}

export default CreateSessionModal
