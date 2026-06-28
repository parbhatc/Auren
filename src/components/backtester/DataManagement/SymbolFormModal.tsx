import { useEffect } from 'react'
import { Layers, Link2, Receipt, Settings2 } from 'lucide-react'
import Modal from '../../ui/Modal'
import { SymbolData } from '../../../types/backtesterDataManagement'
import { t } from '../../../utils/translator'
import {
  adminDividerClass,
  adminGhostButtonClass,
  adminInputClass,
  adminSaveButtonClass,
  adminSectionHintClass,
  adminSectionTitleClass,
  fieldLabelClass,
  settingsInputDisabledClass,
} from '../../../styles/aurenTheme'

export interface SymbolFormModalProps {
  isOpen: boolean
  isNew: boolean
  isDark: boolean
  editingData: Partial<SymbolData & { symbol?: string }>
  saving: boolean
  onUpdateEditingData: (
    field: keyof SymbolData | 'symbol' | 'tradeseaTicker' | 'tradingviewTicker',
    value: string | number
  ) => void
  onSave: (symbol: string, data: SymbolData) => void
  onCancel: () => void
}

function SectionHeader({
  isDark,
  icon: Icon,
  title,
  hint,
}: {
  isDark: boolean
  icon: typeof Layers
  title: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div
        className={`shrink-0 p-2 rounded-xl ${
          isDark ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className={adminSectionTitleClass(isDark)}>{title}</h3>
        {hint ? <p className={adminSectionHintClass(isDark)}>{hint}</p> : null}
      </div>
    </div>
  )
}

export default function SymbolFormModal({
  isOpen,
  isNew,
  isDark,
  editingData,
  saving,
  onUpdateEditingData,
  onSave,
  onCancel,
}: SymbolFormModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, saving, onCancel])

  const symbolName = (editingData.symbol ?? '').trim()
  const canSave =
    Boolean(symbolName) &&
    editingData.tickSize != null &&
    editingData.tickValue != null &&
    !saving

  const handleSave = () => {
    if (!canSave) return
    const totalFees =
      (Number(editingData.exchangeFee) || 0) +
      (Number(editingData.regulatoryFee) || 0) +
      (Number(editingData.commissionFee) || 0)

    onSave(symbolName, {
      tickSize: Number(editingData.tickSize) || 0,
      tickValue: Number(editingData.tickValue) || 0,
      exchangeFee: Number(editingData.exchangeFee) || 0,
      regulatoryFee: Number(editingData.regulatoryFee) || 0,
      commissionFee: Number(editingData.commissionFee) || 0,
      totalFees,
      description: editingData.description ?? '',
      tickers: editingData.tickers,
    })
  }

  const numInput = (
    field: 'tickSize' | 'tickValue' | 'exchangeFee' | 'regulatoryFee' | 'commissionFee',
    label: string,
    step = '0.01'
  ) => (
    <div>
      <label className={fieldLabelClass(isDark)}>{label}</label>
      <input
        type="number"
        step={step}
        value={editingData[field] ?? ''}
        onChange={(e) => {
          const val = e.target.value
          onUpdateEditingData(field, val === '' ? '' : parseFloat(val) || 0)
        }}
        className={adminInputClass(isDark)}
      />
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      isDark={isDark}
      onClose={saving ? () => {} : onCancel}
      size="xl"
      title={
        isNew
          ? t('backtesterDataManagement.symbolInfo.addNewSymbol')
          : t('backtesterDataManagement.symbolInfo.editSymbol', {}, 'Edit Symbol')
      }
      subtitle={
        isNew
          ? t('backtesterDataManagement.symbolInfo.addSymbolHint', {}, 'Configure contract specs and data source tickers.')
          : `${symbolName} — ${editingData.description || t('backtesterDataManagement.symbolInfo.noDescription', {}, 'No description')}`
      }
      bodyClassName="max-h-[min(70vh,560px)]"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={`w-full sm:w-auto sm:ml-auto ${adminGhostButtonClass(isDark)} disabled:opacity-50`}
          >
            {t('backtesterDataManagement.symbolInfo.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full sm:w-auto ${adminSaveButtonClass()}`}
          >
            {saving
              ? t('backtesterDataManagement.symbolInfo.saving', {}, 'Saving…')
              : t('backtesterDataManagement.symbolInfo.save')}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <SectionHeader
            isDark={isDark}
            icon={Layers}
            title={t('backtesterDataManagement.symbolInfo.identitySection', {}, 'Identity')}
            hint={t('backtesterDataManagement.symbolInfo.identityHint', {}, 'Short code used for CSV folders and backtests.')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={fieldLabelClass(isDark)}>
                {t('backtesterDataManagement.symbolInfo.symbol')}
              </label>
              {isNew ? (
                <input
                  type="text"
                  value={editingData.symbol ?? ''}
                  onChange={(e) => onUpdateEditingData('symbol', e.target.value.toUpperCase())}
                  placeholder={t('backtesterDataManagement.symbolInfo.symbolPlaceholder')}
                  className={adminInputClass(isDark)}
                />
              ) : (
                <input
                  type="text"
                  value={editingData.symbol ?? ''}
                  readOnly
                  className={`${settingsInputDisabledClass(isDark)} font-semibold tracking-wide`}
                />
              )}
            </div>
            <div>
              <label className={fieldLabelClass(isDark)}>
                {t('backtesterDataManagement.symbolInfo.description', {}, 'Description')}
              </label>
              <input
                type="text"
                value={editingData.description ?? ''}
                onChange={(e) => onUpdateEditingData('description', e.target.value)}
                placeholder={t('backtesterDataManagement.symbolInfo.descriptionPlaceholder', {}, 'e.g., Nasdaq, Gold')}
                className={adminInputClass(isDark)}
              />
            </div>
          </div>
        </section>

        <div className={`border-t ${adminDividerClass(isDark)}`} />

        <section>
          <SectionHeader
            isDark={isDark}
            icon={Link2}
            title={t('backtesterDataManagement.symbolInfo.tickersSection', {}, 'Data source tickers')}
            hint={t('backtesterDataManagement.symbolInfo.tickersHint', {}, 'Required for CSV download and update from Tradesea / TradingView.')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={fieldLabelClass(isDark)}>
                {t('backtesterDataManagement.symbolInfo.tradeseaTicker', {}, 'Tradesea Ticker')}
              </label>
              <input
                type="text"
                value={editingData.tickers?.tradesea ?? ''}
                onChange={(e) => onUpdateEditingData('tradeseaTicker', e.target.value)}
                placeholder="CME:NQ"
                className={`${adminInputClass(isDark)} font-mono text-xs sm:text-sm`}
              />
            </div>
            <div>
              <label className={fieldLabelClass(isDark)}>
                {t('backtesterDataManagement.symbolInfo.tradingviewTicker', {}, 'TradingView Ticker')}
              </label>
              <input
                type="text"
                value={editingData.tickers?.tradingview ?? ''}
                onChange={(e) => onUpdateEditingData('tradingviewTicker', e.target.value)}
                placeholder="CME_MINI:NQ1!"
                className={`${adminInputClass(isDark)} font-mono text-xs sm:text-sm`}
              />
            </div>
          </div>
        </section>

        <div className={`border-t ${adminDividerClass(isDark)}`} />

        <section>
          <SectionHeader
            isDark={isDark}
            icon={Settings2}
            title={t('backtesterDataManagement.symbolInfo.contractSection', {}, 'Contract')}
          />
          <div className="grid grid-cols-2 gap-4">
            {numInput('tickSize', t('backtesterDataManagement.symbolInfo.tickSize'))}
            {numInput('tickValue', t('backtesterDataManagement.symbolInfo.tickValue', {}, 'Tick Value'))}
          </div>
        </section>

        <div className={`border-t ${adminDividerClass(isDark)}`} />

        <section>
          <SectionHeader
            isDark={isDark}
            icon={Receipt}
            title={t('backtesterDataManagement.symbolInfo.feesSection', {}, 'Fees per contract')}
            hint={t('backtesterDataManagement.symbolInfo.feesHint', {}, 'Total fees are calculated automatically on save.')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {numInput('exchangeFee', t('backtesterDataManagement.symbolInfo.exchangeFee'))}
            {numInput('regulatoryFee', t('backtesterDataManagement.symbolInfo.regulatoryFee', {}, 'Regulatory Fee'))}
            {numInput('commissionFee', t('backtesterDataManagement.symbolInfo.commissionFee'))}
          </div>
          <p className={`mt-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('backtesterDataManagement.symbolInfo.totalFeesPreview', {}, 'Total')}:{' '}
            <span className={`font-semibold tabular-nums ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              {(
                (Number(editingData.exchangeFee) || 0) +
                (Number(editingData.regulatoryFee) || 0) +
                (Number(editingData.commissionFee) || 0)
              ).toFixed(4)}
            </span>
          </p>
        </section>
      </div>
    </Modal>
  )
}
