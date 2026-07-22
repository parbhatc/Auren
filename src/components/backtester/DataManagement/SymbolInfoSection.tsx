import { Edit2, Plus, Trash2 } from 'lucide-react'
import { SymbolData } from '../../../types/backtesterDataManagement'
import { t } from '../../../utils/translator'
import {
  adminBadgeClass,
  adminIconButtonClass,
  adminListCardClass,
  adminPrimaryButtonClass,
  panelCardClass,
  panelCardDescClass,
  panelCardTitleClass,
} from '../../../styles/aurenTheme'

export interface SymbolInfoSectionProps {
  isDark: boolean
  symbols: Record<string, SymbolData>
  onAdd: () => void
  onEdit: (symbol: string) => void
  onDelete: (symbol: string) => void
}

function TickerPill({ isDark, label, value }: { isDark: boolean; label: string; value?: string }) {
  return (
    <div className={`rounded-lg px-2.5 py-1.5 ${isDark ? 'bg-slate-900/60 ring-1 ring-slate-800' : 'bg-slate-50 ring-1 ring-slate-200'}`}>
      <span className={`block text-[10px] uppercase tracking-wide font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        {label}
      </span>
      <span className={`font-mono text-xs ${value ? (isDark ? 'text-slate-200' : 'text-slate-800') : 'text-slate-500'}`}>
        {value || '—'}
      </span>
    </div>
  )
}

function FeeCell({ isDark, label, value }: { isDark: boolean; label: string; value: number }) {
  return (
    <div>
      <span className={`block text-[10px] uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        {label}
      </span>
      <span className={`text-sm tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
        {value.toFixed(4)}
      </span>
    </div>
  )
}

export default function SymbolInfoSection({
  isDark,
  symbols,
  onAdd,
  onEdit,
  onDelete,
}: SymbolInfoSectionProps) {
  const symbolEntries = Object.entries(symbols)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`${panelCardClass(isDark)} !p-4 sm:!p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className={panelCardTitleClass(isDark)}>
              {t('backtesterDataManagement.tabs.symbolInfo')}
            </h2>
            <p className={`${panelCardDescClass(isDark)} !mb-0`}>
              {t(
                'backtesterDataManagement.symbolInfo.subtitle',
                {},
                'Manage contract settings and data-source tickers for backtester symbols.'
              )}
            </p>
          </div>
          <button type="button" onClick={onAdd} className={adminPrimaryButtonClass()}>
            <Plus className="w-4 h-4" />
            {t('backtesterDataManagement.symbolInfo.addSymbol')}
          </button>
        </div>
      </div>

      {symbolEntries.length === 0 ? (
        <div className={`${panelCardClass(isDark)} text-center py-12`}>
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
            {t('backtesterDataManagement.symbolInfo.noSymbols')}
          </p>
          <button type="button" onClick={onAdd} className={`mt-4 ${adminPrimaryButtonClass()}`}>
            <Plus className="w-4 h-4" />
            {t('backtesterDataManagement.symbolInfo.addSymbol')}
          </button>
        </div>
      ) : (
        <>
          <div className={`hidden lg:block ${panelCardClass(isDark)} !p-0 overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={isDark ? 'border-b border-slate-800 bg-slate-900/50' : 'border-b border-slate-200 bg-slate-50/80'}>
                    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t('backtesterDataManagement.symbolInfo.symbol')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t('backtesterDataManagement.symbolInfo.tickersSection', {}, 'Tickers')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden xl:table-cell ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t('backtesterDataManagement.symbolInfo.contractSection', {}, 'Contract')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden xl:table-cell ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t('backtesterDataManagement.symbolInfo.feesSection', {}, 'Fees')}
                    </th>
                    <th className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t('backtesterDataManagement.symbolInfo.actions', {}, 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {symbolEntries.map(([symbol, data]) => (
                    <tr
                      key={symbol}
                      className={isDark ? 'border-b border-slate-800/80 hover:bg-slate-900/40' : 'border-b border-slate-100 hover:bg-slate-50/80'}
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={adminBadgeClass(isDark)}>{symbol}</span>
                        </div>
                        <p className={`mt-1.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {data.description || '—'}
                        </p>
                        <p className={`mt-1 text-xs xl:hidden ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {data.tickSize} × {data.tickValue} · {(data.totalFees ?? 0).toFixed(4)} total
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="grid grid-cols-1 gap-2 min-w-[200px]">
                          <TickerPill
                            isDark={isDark}
                            label={t('backtesterDataManagement.symbolInfo.tradeseaTicker', {}, 'Tradesea')}
                            value={data.tickers?.tradesea}
                          />
                          <TickerPill
                            isDark={isDark}
                            label={t('backtesterDataManagement.symbolInfo.tradingviewTicker', {}, 'TradingView')}
                            value={data.tickers?.tradingview}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top hidden xl:table-cell">
                        <div className="space-y-1 tabular-nums">
                          <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                            <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>Tick </span>
                            {data.tickSize}
                            <span className={isDark ? 'text-slate-600' : 'text-slate-400'}> / </span>
                            {data.tickValue}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top hidden xl:table-cell">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <FeeCell isDark={isDark} label="Exch" value={data.exchangeFee ?? 0} />
                          <FeeCell isDark={isDark} label="Reg" value={data.regulatoryFee ?? 0} />
                          <FeeCell isDark={isDark} label="Comm" value={data.commissionFee ?? 0} />
                          <div>
                            <span className={`block text-[10px] uppercase tracking-wide ${isDark ? 'text-blue-400/80' : 'text-blue-700'}`}>
                              Total
                            </span>
                            <span className={`text-sm font-semibold tabular-nums ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                              {(data.totalFees ?? 0).toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEdit(symbol)}
                            className={adminIconButtonClass(isDark, 'amber')}
                            title={t('backtesterDataManagement.symbolInfo.edit')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(symbol)}
                            className={adminIconButtonClass(isDark, 'danger')}
                            title={t('backtesterDataManagement.symbolInfo.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:hidden space-y-3">
            {symbolEntries.map(([symbol, data]) => (
              <div key={symbol} className={adminListCardClass(isDark)}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className={adminBadgeClass(isDark)}>{symbol}</span>
                    <p className={`mt-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {data.description || '—'}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(symbol)}
                      className={adminIconButtonClass(isDark, 'amber')}
                      title={t('backtesterDataManagement.symbolInfo.edit')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(symbol)}
                      className={adminIconButtonClass(isDark, 'danger')}
                      title={t('backtesterDataManagement.symbolInfo.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <TickerPill
                    isDark={isDark}
                    label={t('backtesterDataManagement.symbolInfo.tradeseaTicker', {}, 'Tradesea')}
                    value={data.tickers?.tradesea}
                  />
                  <TickerPill
                    isDark={isDark}
                    label={t('backtesterDataManagement.symbolInfo.tradingviewTicker', {}, 'TradingView')}
                    value={data.tickers?.tradingview}
                  />
                </div>

                <div className={`grid grid-cols-3 gap-3 pt-3 border-t text-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div>
                    <span className={`block text-[10px] uppercase ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Tick</span>
                    <span className={`text-sm tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {data.tickSize}/{data.tickValue}
                    </span>
                  </div>
                  <div>
                    <span className={`block text-[10px] uppercase ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Fees</span>
                    <span className={`text-sm tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {(data.totalFees ?? 0).toFixed(4)}
                    </span>
                  </div>
                  <div>
                    <span className={`block text-[10px] uppercase ${isDark ? 'text-blue-400/80' : 'text-blue-700'}`}>Total</span>
                    <span className={`text-sm font-semibold tabular-nums ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                      {(data.totalFees ?? 0).toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
