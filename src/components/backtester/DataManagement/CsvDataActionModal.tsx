import { useEffect, useMemo, useState } from 'react'

import { Download, RefreshCw, Replace } from 'lucide-react'

import Modal from '../../ui/Modal'

import type { CsvInventoryEntry } from '../../../types/backtesterDataManagement'

import type { CsvDataSourcePreference } from './csvDataPrefs'

import { t } from '../../../utils/translator'

import {

  adminGhostButtonClass,

  adminInsetClass,

  fieldLabelClass,

  selectInputClass,

} from '../../../styles/aurenTheme'

import { stripHtml } from './csvDataSearch'

import {

  CSV_TIMEFRAME_GROUPS,

  DEFAULT_CSV_CHART_RESOLUTION,

  chartResolutionToCsvFolder,

  timeframeLabel,

} from './csvDataTimeframes'



export type CsvDataActionIntent = 'download' | 'update' | 'overwrite'



export interface CsvDataActionModalProps {

  isOpen: boolean

  isDark: boolean

  symbol: string

  displaySymbol?: string

  description?: string

  ticker?: string

  dataSource: CsvDataSourcePreference

  inventory: CsvInventoryEntry[]

  initialIntent: CsvDataActionIntent

  busy: boolean

  onClose: () => void

  onDownload: (symbol: string, resolution: string) => Promise<void>

  onUpdate: (symbol: string, resolution: string) => Promise<void>

  onOverwrite: (symbol: string, resolution: string) => Promise<void>

}



export function symbolHasCsvFolder(symbol: string, inventory: CsvInventoryEntry[]): boolean {

  return inventory.some((row) => row.symbol === symbol)

}



export function symbolHasChartResolution(

  symbol: string,

  chartResolution: string,

  inventory: CsvInventoryEntry[]

): boolean {

  const folder = chartResolutionToCsvFolder(chartResolution)

  return inventory.some((row) => row.symbol === symbol && row.resolution === folder)

}



export function symbolInventoryForChart(

  symbol: string,

  inventory: CsvInventoryEntry[]

): CsvInventoryEntry[] {

  return inventory.filter((row) => row.symbol === symbol)

}



export default function CsvDataActionModal({

  isOpen,

  isDark,

  symbol,

  displaySymbol,

  description,

  ticker,

  dataSource,

  inventory,

  initialIntent,

  busy,

  onClose,

  onDownload,

  onUpdate,

  onOverwrite,

}: CsvDataActionModalProps) {

  const [resolution, setResolution] = useState(DEFAULT_CSV_CHART_RESOLUTION)

  const [intent, setIntent] = useState<CsvDataActionIntent>(initialIntent)



  const symbolRows = useMemo(() => symbolInventoryForChart(symbol, inventory), [symbol, inventory])

  const resolutionExists = symbolHasChartResolution(symbol, resolution, inventory)

  const csvFolder = chartResolutionToCsvFolder(resolution)

  const inventoryRow = inventory.find((row) => row.symbol === symbol && row.resolution === csvFolder)



  const effectiveIntent = useMemo((): CsvDataActionIntent => {

    if (!resolutionExists) return 'download'

    return intent

  }, [resolutionExists, intent])



  useEffect(() => {

    if (!isOpen) return

    setResolution(DEFAULT_CSV_CHART_RESOLUTION)

    setIntent(initialIntent)

  }, [isOpen, initialIntent, symbol])



  useEffect(() => {

    if (!resolutionExists && (intent === 'update' || intent === 'overwrite')) {

      setIntent('download')

    }

  }, [resolutionExists, intent])



  const handleConfirm = async () => {

    if (busy) return

    if (effectiveIntent === 'download') await onDownload(symbol, resolution)

    else if (effectiveIntent === 'update') await onUpdate(symbol, resolution)

    else await onOverwrite(symbol, resolution)

  }



  const confirmLabel =

    effectiveIntent === 'download'

      ? t('backtesterDataManagement.csvData.download', {}, 'Download')

      : effectiveIntent === 'update'

        ? t('backtesterDataManagement.csvData.update', {}, 'Update')

        : t('backtesterDataManagement.csvData.overwrite', {}, 'Overwrite')



  const ConfirmIcon =

    effectiveIntent === 'download' ? Download : effectiveIntent === 'update' ? RefreshCw : Replace



  const confirmClass =

    effectiveIntent === 'overwrite'

      ? 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50'

      : effectiveIntent === 'download'

        ? 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50'

        : 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50'



  return (

    <Modal

      isOpen={isOpen}

      isDark={isDark}

      onClose={busy ? () => {} : onClose}

      size="md"

      title={t('backtesterDataManagement.csvData.actionTitle', {}, 'CSV data action')}

      subtitle={

        dataSource === 'tradesea'

          ? t('backtesterDataManagement.csvData.tradesea', {}, 'Tradesea')

          : t('backtesterDataManagement.csvData.tradingview', {}, 'TradingView')

      }

      footer={

        <>

          <button

            type="button"

            onClick={onClose}

            disabled={busy}

            className={`w-full sm:w-auto sm:ml-auto ${adminGhostButtonClass(isDark)} disabled:opacity-50`}

          >

            {t('backtesterDataManagement.symbolInfo.cancel', {}, 'Cancel')}

          </button>

          <button type="button" onClick={handleConfirm} disabled={busy} className={`w-full sm:w-auto ${confirmClass}`}>

            <ConfirmIcon className={`w-4 h-4 ${busy && effectiveIntent === 'update' ? 'animate-spin' : ''}`} />

            {busy ? t('backtesterDataManagement.csvData.working', {}, 'Working…') : confirmLabel}

          </button>

        </>

      }

    >

      <div className="space-y-5">

        <div className={adminInsetClass(isDark)}>

          <div className="flex items-center gap-2 flex-wrap">

            <span className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>

              {displaySymbol || symbol}

            </span>

            {displaySymbol && displaySymbol !== symbol && (

              <span

                className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${

                  isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'

                }`}

              >

                {symbol}

              </span>

            )}

          </div>

          {description ? (

            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>

              {stripHtml(description)}

            </p>

          ) : null}

          {ticker ? (

            <p className={`text-xs font-mono mt-2 ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>

              {ticker}

            </p>

          ) : null}

          {symbolRows.length > 0 ? (

            <div className="flex flex-wrap gap-1.5 mt-3">

              {symbolRows.map((row) => (

                <span

                  key={row.resolution}

                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${

                    isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'

                  }`}

                  title={`${row.fromLabel} – ${row.toLabel}`}

                >

                  {row.resolutionLabel} ✓

                </span>

              ))}

            </div>

          ) : (

            <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>

              {t('backtesterDataManagement.csvData.noDataOnDisk', {}, 'No CSV data on disk yet')}

            </p>

          )}

        </div>



        <div>

          <label className={fieldLabelClass(isDark)}>

            {t('backtesterDataManagement.csvData.timeframe', {}, 'Timeframe')}

          </label>

          <select

            value={resolution}

            onChange={(e) => setResolution(e.target.value)}

            disabled={busy}

            className={`${selectInputClass(isDark)} max-h-52`}

          >

            {CSV_TIMEFRAME_GROUPS.map((group) => (

              <optgroup key={group.label} label={group.label}>

                {group.options.map((opt) => (

                  <option key={opt.value} value={opt.value}>

                    {opt.label}

                    {symbolHasChartResolution(symbol, opt.value, inventory) ? ' ✓' : ''}

                  </option>

                ))}

              </optgroup>

            ))}

          </select>

          <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>

            {resolutionExists

              ? t(

                  'backtesterDataManagement.csvData.timeframeExists',

                  {

                    from: inventoryRow?.fromLabel ?? '',

                    to: inventoryRow?.toLabel ?? '',

                  },

                  `Data on disk: ${inventoryRow?.fromLabel ?? ''} – ${inventoryRow?.toLabel ?? ''}`

                )

              : t(

                  'backtesterDataManagement.csvData.timeframeMissing',

                  { tf: timeframeLabel(resolution) },

                  `No ${timeframeLabel(resolution)} CSV folder yet — will download fresh data.`

                )}

          </p>

        </div>



        {resolutionExists ? (

          <div className="flex gap-2">

            <button

              type="button"

              disabled={busy}

              onClick={() => setIntent('update')}

              className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${

                intent === 'update'

                  ? isDark

                    ? 'border-blue-500 bg-blue-500/15 text-blue-300'

                    : 'border-blue-500 bg-blue-50 text-blue-700'

                  : isDark

                    ? 'border-slate-700 text-slate-400 hover:border-slate-600'

                    : 'border-slate-300 text-slate-600 hover:border-slate-400'

              }`}

            >

              {t('backtesterDataManagement.csvData.update', {}, 'Update')}

            </button>

            <button

              type="button"

              disabled={busy}

              onClick={() => setIntent('overwrite')}

              className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${

                intent === 'overwrite'

                  ? isDark

                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'

                    : 'border-amber-500 bg-amber-50 text-amber-700'

                  : isDark

                    ? 'border-slate-700 text-slate-400 hover:border-slate-600'

                    : 'border-slate-300 text-slate-600 hover:border-slate-400'

              }`}

            >

              {t('backtesterDataManagement.csvData.overwrite', {}, 'Overwrite')}

            </button>

          </div>

        ) : null}

      </div>

    </Modal>

  )

}


