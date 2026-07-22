import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Download, RefreshCw, Replace, Search } from 'lucide-react'
import { panelCardClass, tabRailActiveClass, tabRailClass } from '../../../styles/aurenTheme'
import { t } from '../../../utils/translator'
import Loading from '../../common/Loading'
import ConfirmDialog from '../../common/ConfirmDialog'
import CsvDataActionModal, {
  type CsvDataActionIntent,
  symbolHasCsvFolder,
} from './CsvDataActionModal'
import type { CsvInventoryEntry, SymbolData } from '../../../types/backtesterDataManagement'
import {
  type CsvDataSourcePreference,
  type CsvDataWsSource,
  loadCsvDataSource,
  saveCsvDataSource,
  wsSourceFromCsvDataSource,
} from './csvDataPrefs'
import {
  type CsvSearchResult,
  ensurePracticeMarketDataLoaded,
  getTradeseaMarketDataStatus,
  searchConfiguredCsvSymbols,
  stripHtml,
} from './csvDataSearch'
import { hasSymbolTicker } from './symbolTickers'
import { csvFolderToChartResolution } from './csvDataTimeframes'

function groupInventoryBySymbol(inventory: CsvInventoryEntry[]) {
  const map = new Map<string, CsvInventoryEntry[]>()
  for (const row of inventory) {
    const list = map.get(row.symbol) ?? []
    list.push(row)
    map.set(row.symbol, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([symbol, resolutions]) => ({
      symbol,
      resolutions: resolutions.sort((a, b) => a.resolution.localeCompare(b.resolution)),
    }))
}

export default function CsvDataSection({
  isDark,
  inventory,
  loading,
  progressState,
  symbols,
  tradingViewToken,
  onUpdate,
  onOverwrite,
  onDownload,
  onTradingViewTokenChange,
  onTradingViewTokenBlur,
}: {
  isDark: boolean
  inventory: CsvInventoryEntry[]
  loading: boolean
  symbols: Record<string, SymbolData>
  tradingViewToken: string
  progressState?: Record<string, {
    symbol: string
    source: CsvDataWsSource
    action: 'download' | 'update' | 'overwrite' | 'reset'
    progress: number
    message: string
    timestamp: number
    completed?: boolean
  }>
  onUpdate: (symbol: string, source: CsvDataWsSource, resolution?: string) => Promise<void>
  onOverwrite: (symbol: string, source: CsvDataWsSource, resolution?: string) => Promise<void>
  onDownload: (symbol: string, source: CsvDataWsSource, resolution?: string) => Promise<void>
  onTradingViewTokenChange?: (token: string) => void
  onTradingViewTokenBlur?: (token: string) => void
}) {
  const [dataSource, setDataSource] = useState<CsvDataSourcePreference>(() => loadCsvDataSource())
  const [tradeseaStatus, setTradeseaStatus] = useState(() => getTradeseaMarketDataStatus())
  const [practiceLoading, setPracticeLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<CsvSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [overwriteConfirm, setOverwriteConfirm] = useState<{ symbol: string; resolution: string } | null>(null)
  const [actionSymbol, setActionSymbol] = useState<string | null>(null)
  const [updateAllState, setUpdateAllState] = useState<{ completed: number; total: number; current: string } | null>(null)
  const [actionModal, setActionModal] = useState<{
    symbol: string
    displaySymbol?: string
    description?: string
    ticker?: string
    intent: CsvDataActionIntent
  } | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const wsSource = wsSourceFromCsvDataSource(dataSource)
  const grouped = useMemo(() => groupInventoryBySymbol(inventory), [inventory])
  const updateAllTargets = useMemo(() => grouped.flatMap(({ symbol, resolutions }) => (
    hasSymbolTicker(symbols, symbol, dataSource)
      ? resolutions.map((row) => ({ symbol, resolution: row.resolution }))
      : []
  )), [dataSource, grouped, symbols])

  useEffect(() => {
    let cancelled = false

    const syncTradeseaStatus = () => {
      if (!cancelled) {
        setTradeseaStatus(getTradeseaMarketDataStatus())
      }
    }

    const loadPractice = async () => {
      setPracticeLoading(true)
      try {
        await ensurePracticeMarketDataLoaded()
      } finally {
        if (!cancelled) {
          syncTradeseaStatus()
          setPracticeLoading(false)
        }
      }
    }

    void loadPractice()
    window.addEventListener('practiceSettingsChanged', syncTradeseaStatus)
    return () => {
      cancelled = true
      window.removeEventListener('practiceSettingsChanged', syncTradeseaStatus)
    }
  }, [])

  useEffect(() => {
    saveCsvDataSource(dataSource)
  }, [dataSource])

  const toggleExpanded = (symbol: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }

  const isRowBusy = (symbol: string, action: 'download' | 'update' | 'overwrite') => {
    const key = `${wsSource}_${symbol}_${action}`
    return Boolean(progressState?.[key])
  }

  const persistTradingViewToken = (token: string) => {
    onTradingViewTokenChange?.(token)
  }

  const flushTradingViewToken = (token: string) => {
    onTradingViewTokenBlur?.(token)
  }

  const openActionModal = (
    row: CsvSearchResult,
    intent: CsvDataActionIntent
  ) => {
    if (!canRunForSymbol(row.symbol)) {
      setSearchError(
        t(
          'backtesterDataManagement.csvData.noTicker',
          { source: dataSource },
          `No ${dataSource} ticker configured — add one in Symbol Info.`
        )
      )
      return
    }
    try {
      assertCanRunAction()
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Action unavailable')
      return
    }
    setActionModal({
      symbol: row.symbol,
      displaySymbol: row.displaySymbol,
      description: row.description,
      ticker: row.formattedSymbol,
      intent,
    })
  }

  const closeActionModal = () => {
    if (!actionSymbol) setActionModal(null)
  }

  const runModalDownload = async (symbol: string, resolution: string) => {
    try {
      assertCanRunAction()
      setActionSymbol(symbol)
      await onDownload(symbol, wsSource, resolution)
      setActionModal(null)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setActionSymbol(null)
    }
  }

  const runModalUpdate = async (symbol: string, resolution: string) => {
    try {
      assertCanRunAction()
      setActionSymbol(symbol)
      await onUpdate(symbol, wsSource, resolution)
      setActionModal(null)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setActionSymbol(null)
    }
  }

  const runModalOverwrite = async (symbol: string, resolution: string) => {
    setActionModal(null)
    setOverwriteConfirm({ symbol, resolution })
  }

  const canRunForSymbol = (symbol: string) => hasSymbolTicker(symbols, symbol, dataSource)

  const assertCanRunAction = () => {
    if (dataSource === 'tradesea' && !tradeseaStatus.ok) {
      throw new Error(tradeseaStatus.message || 'Tradesea market data is not configured.')
    }
  }

  const handleUpdate = async (symbol: string, csvResolution: string) => {
    try {
      assertCanRunAction()
      setActionSymbol(symbol)
      await onUpdate(symbol, wsSource, csvFolderToChartResolution(csvResolution))
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setActionSymbol(null)
    }
  }

  const handleUpdateAll = async () => {
    if (!updateAllTargets.length || updateAllState) return
    setSearchError('')
    try {
      assertCanRunAction()
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Update unavailable')
      return
    }

    const failures: string[] = []
    for (let index = 0; index < updateAllTargets.length; index += 1) {
      const target = updateAllTargets[index]
      setUpdateAllState({ completed: index, total: updateAllTargets.length, current: `${target.symbol} ${target.resolution}` })
      setActionSymbol(target.symbol)
      try {
        await onUpdate(target.symbol, wsSource, csvFolderToChartResolution(target.resolution))
      } catch {
        failures.push(`${target.symbol} ${target.resolution}`)
      }
    }
    setActionSymbol(null)
    setUpdateAllState(null)
    if (failures.length) {
      setSearchError(`Update all finished with ${failures.length} failed dataset${failures.length === 1 ? '' : 's'}: ${failures.join(', ')}`)
    }
  }

  const handleOverwriteConfirm = async () => {
    if (!overwriteConfirm) return
    const { symbol, resolution } = overwriteConfirm
    setOverwriteConfirm(null)
    try {
      assertCanRunAction()
      setActionSymbol(symbol)
      await onOverwrite(symbol, wsSource, resolution)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Overwrite failed')
    } finally {
      setActionSymbol(null)
    }
  }

  const controls = (
    <div className="space-y-4">
      <div className={`${tabRailClass(isDark)} w-full sm:w-auto`}>
        {(['tradesea', 'tradingview'] as const).map((source) => (
          <button
            key={source}
            type="button"
            onClick={() => {
              setDataSource(source)
              setSearchResults([])
              setSearchError('')
            }}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              dataSource === source
                ? tabRailActiveClass(isDark, source === 'tradesea' ? 'blue' : 'amber')
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {source === 'tradesea'
              ? t('backtesterDataManagement.csvData.tradesea', {}, 'Tradesea')
              : t('backtesterDataManagement.csvData.tradingview', {}, 'TradingView')}
          </button>
        ))}
      </div>

      {dataSource === 'tradesea' && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            practiceLoading
              ? isDark
                ? 'border-slate-600/40 bg-slate-800/40 text-slate-300'
                : 'border-slate-200 bg-slate-50 text-slate-600'
              : tradeseaStatus.ok
              ? isDark
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-200'
                : 'border-blue-200 bg-blue-50 text-blue-800'
              : isDark
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {practiceLoading
            ? t('backtesterDataManagement.csvData.loadingMarketData', {}, 'Loading practice market data…')
            : tradeseaStatus.ok
            ? t(
                'backtesterDataManagement.csvData.tradeseaAccount',
                { label: tradeseaStatus.accountLabel },
                `Market data account: ${tradeseaStatus.accountLabel}`
              )
            : t(
                'backtesterDataManagement.csvData.tradeseaRequired',
                {},
                'Configure Tradesea market data in Practice settings to search or update.'
              )}
        </div>
      )}

      {dataSource === 'tradingview' && (
        <div>
          <label
            htmlFor="csv-tradingview-token"
            className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
          >
            {t('backtesterDataManagement.csvData.tradingviewToken', {}, 'TradingView token')}
          </label>
          <input
            id="csv-tradingview-token"
            type="password"
            value={tradingViewToken}
            onChange={(e) => persistTradingViewToken(e.target.value)}
            onBlur={(e) => flushTradingViewToken(e.target.value)}
            placeholder={t('backtesterDataManagement.csvData.tradingviewTokenPlaceholder', {}, 'Paste your TradingView token')}
            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all ${
              isDark
                ? 'bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
            }`}
            autoComplete="off"
          />
          <p className={`mt-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {t(
              'backtesterDataManagement.csvData.tradingviewTokenHint',
              {},
              'Saved to backtester config. Leave empty to use unauthorized access.'
            )}
          </p>
        </div>
      )}

      <div className="relative">
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('backtesterDataManagement.csvData.searchPlaceholder', {}, 'Search symbols…')}
          className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm outline-none transition-all ${
            isDark
              ? 'bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
              : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
          }`}
        />
      </div>
    </div>
  )

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const q = search.trim()
    if (!q) {
      setSearchResults([])
      setSearchError('')
      setSearchLoading(false)
      return
    }

    if (dataSource === 'tradesea' && (!tradeseaStatus.ok || practiceLoading)) {
      setSearchResults([])
      setSearchError(
        practiceLoading
          ? ''
          : tradeseaStatus.message || getTradeseaMarketDataStatus().message || ''
      )
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    setSearchError('')

    searchTimeoutRef.current = setTimeout(() => {
      const source = dataSource === 'tradesea' ? 'tradesea' : 'tradingview'
      const results = searchConfiguredCsvSymbols(q, symbols, source)
      setSearchResults(results)
      setSearchError(
        results.length
          ? ''
          : t(
              'backtesterDataManagement.csvData.noConfiguredSymbols',
              {},
              'No configured symbols match this search. Add a ticker in Symbol Info first.'
            )
      )
      setSearchLoading(false)
    }, 200)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [search, dataSource, tradeseaStatus.ok, practiceLoading, symbols])

  const searchResultsPanel = search.trim() ? (
    <div className={`${panelCardClass(isDark)} overflow-hidden`}>
      <div className={`px-4 sm:px-6 py-3 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('backtesterDataManagement.csvData.searchResults', {}, 'Search results')}
        </h3>
      </div>
      {searchLoading ? (
        <div className="px-4 sm:px-6 py-6 text-sm text-center">
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
            {t('backtesterDataManagement.csvData.searching', {}, 'Searching…')}
          </p>
        </div>
      ) : searchError ? (
        <div className="px-4 sm:px-6 py-6 text-sm text-center">
          <p className={isDark ? 'text-amber-300' : 'text-amber-700'}>{searchError}</p>
        </div>
      ) : (
        <ul className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
          {searchResults.map((row) => {
            const hasCsv = symbolHasCsvFolder(row.symbol, inventory)
            const busy =
              actionSymbol === row.symbol ||
              isRowBusy(row.symbol, 'download') ||
              isRowBusy(row.symbol, 'update') ||
              isRowBusy(row.symbol, 'overwrite')
            const canRun = canRunForSymbol(row.symbol)

            return (
            <li
              key={row.id}
              className={`px-4 sm:px-6 py-3 ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {row.displaySymbol || row.symbol}
                    </p>
                    {row.displaySymbol && row.displaySymbol !== row.symbol && (
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.symbol}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {stripHtml(row.description)}
                  </p>
                  {row.formattedSymbol && (
                    <p className={`text-xs font-mono mt-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                      {row.formattedSymbol}
                    </p>
                  )}
                </div>
                {canRun && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!hasCsv ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openActionModal(row, 'download')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                          isDark
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <Download className={`w-3.5 h-3.5 ${isRowBusy(row.symbol, 'download') ? 'animate-pulse' : ''}`} />
                        {t('backtesterDataManagement.csvData.download', {}, 'Download')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openActionModal(row, 'update')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                            isDark
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRowBusy(row.symbol, 'update') ? 'animate-spin' : ''}`} />
                          {t('backtesterDataManagement.csvData.update', {}, 'Update')}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openActionModal(row, 'overwrite')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                            isDark
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : 'bg-amber-600 hover:bg-amber-700 text-white'
                          }`}
                        >
                          <Replace className={`w-3.5 h-3.5 ${isRowBusy(row.symbol, 'overwrite') ? 'animate-spin' : ''}`} />
                          {t('backtesterDataManagement.csvData.overwrite', {}, 'Overwrite')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
            )
          })}
        </ul>
      )}
    </div>
  ) : null

  const inventoryPanel = loading ? (
    <div className={`${panelCardClass(isDark)} p-8`}>
      <Loading />
    </div>
  ) : !grouped.length ? (
    <div className={`${panelCardClass(isDark)} p-8 text-center`}>
      <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
        {t('backtesterDataManagement.csvData.empty', {}, 'No CSV data found on disk.')}
      </p>
    </div>
  ) : (
    <div className={`${panelCardClass(isDark)} overflow-hidden`}>
      <ul className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
        {grouped.map(({ symbol, resolutions }) => {
          const isOpen = expanded.has(symbol)
          const showActions = canRunForSymbol(symbol)
          return (
            <li key={symbol}>
              <button
                type="button"
                onClick={() => toggleExpanded(symbol)}
                className={`w-full flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 text-left transition-colors ${
                  isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                }`}
              >
                {isOpen ? (
                  <ChevronDown className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                ) : (
                  <ChevronRight className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                )}
                <span className={`font-semibold text-sm sm:text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {symbol}
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {resolutions.length} {resolutions.length === 1 ? 'resolution' : 'resolutions'}
                </span>
                {!showActions && (
                  <span className={`ml-auto text-xs ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>
                    {t('backtesterDataManagement.csvData.noTicker', { source: dataSource }, `No ${dataSource} ticker`)}
                  </span>
                )}
              </button>

              {isOpen && (
                <ul className={`border-t ${isDark ? 'border-slate-700/50 bg-slate-900/20' : 'border-slate-200 bg-slate-50/50'}`}>
                  {resolutions.map((row) => {
                    const busy =
                      actionSymbol === symbol ||
                      isRowBusy(symbol, 'download') ||
                      isRowBusy(symbol, 'update') ||
                      isRowBusy(symbol, 'overwrite')
                    return (
                      <li
                        key={`${row.symbol}-${row.resolution}`}
                        className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-3 sm:py-3.5 pl-10 sm:pl-12 ${
                          isDark ? 'hover:bg-slate-800/30' : 'hover:bg-white/80'
                        }`}
                      >
                        <p className={`flex-1 min-w-0 text-xs sm:text-sm font-mono tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <span className={isDark ? 'text-blue-300' : 'text-blue-700'}>{row.resolutionLabel}</span>
                          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}> → </span>
                          <span>{row.fromLabel}</span>
                          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}> - </span>
                          <span>{row.toLabel}</span>
                        </p>
                        {showActions && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleUpdate(symbol, row.resolution)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                isDark
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isRowBusy(symbol, 'update') ? 'animate-spin' : ''}`} />
                              {t('backtesterDataManagement.csvData.update', {}, 'Update')}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                setOverwriteConfirm({
                                  symbol,
                                  resolution: csvFolderToChartResolution(row.resolution),
                                })
                              }
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                isDark
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-amber-600 hover:bg-amber-700 text-white'
                              }`}
                            >
                              <Replace className={`w-3.5 h-3.5 ${isRowBusy(symbol, 'overwrite') ? 'animate-spin' : ''}`} />
                              {t('backtesterDataManagement.csvData.overwrite', {}, 'Overwrite')}
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <div className="space-y-4">
      {controls}
      {searchResultsPanel}
      {!loading && grouped.length > 0 && (
        <div className={`${panelCardClass(isDark)} flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5`}>
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>CSV inventory</p>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {updateAllState
                ? `Updating ${updateAllState.current} · ${updateAllState.completed + 1} of ${updateAllState.total}`
                : `${updateAllTargets.length} eligible dataset${updateAllTargets.length === 1 ? '' : 's'} for ${dataSource === 'tradesea' ? 'Tradesea' : 'TradingView'}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleUpdateAll()}
            disabled={!updateAllTargets.length || updateAllState !== null || actionSymbol !== null}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isDark ? 'bg-[#FAFAFA] text-[#09090B] hover:bg-white' : 'bg-[#18181B] text-white hover:bg-black'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${updateAllState ? 'animate-spin' : ''}`} />
            {updateAllState ? `Updating ${updateAllState.completed + 1}/${updateAllState.total}` : 'Update all'}
          </button>
        </div>
      )}
      {!search.trim() && searchError && (
        <div className={`rounded-lg border px-4 py-3 text-xs ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {searchError}
        </div>
      )}
      {inventoryPanel}

      <ConfirmDialog
        isOpen={overwriteConfirm !== null}
        title={t('backtesterDataManagement.csvData.overwriteTitle', {}, 'Overwrite CSV data')}
        message={t(
          'backtesterDataManagement.csvData.overwriteConfirm',
          { symbol: overwriteConfirm?.symbol ?? '' },
          'Overwrite all CSV files for "{symbol}" with freshly downloaded data?'
        )}
        confirmText={t('backtesterDataManagement.csvData.overwrite', {}, 'Overwrite')}
        cancelText={t('backtesterDataManagement.symbolInfo.cancel', {}, 'Cancel')}
        onConfirm={handleOverwriteConfirm}
        onCancel={() => setOverwriteConfirm(null)}
        variant="danger"
        isDark={isDark}
      />

      {actionModal && (
        <CsvDataActionModal
          isOpen
          isDark={isDark}
          symbol={actionModal.symbol}
          displaySymbol={actionModal.displaySymbol}
          description={actionModal.description}
          ticker={actionModal.ticker}
          dataSource={dataSource}
          inventory={inventory}
          initialIntent={actionModal.intent}
          busy={actionSymbol === actionModal.symbol}
          onClose={closeActionModal}
          onDownload={runModalDownload}
          onUpdate={runModalUpdate}
          onOverwrite={runModalOverwrite}
        />
      )}
    </div>
  )
}
