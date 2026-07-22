import { X, RefreshCw, Download, RotateCcw } from 'lucide-react'
import { SymbolInfoDialogProps, FileData, Contract } from '../../../types/backtesterDataManagement'
import { useState, useEffect, useMemo } from 'react'
import ConfirmDialog from '../../common/ConfirmDialog'
import SymbolConfigDialog from './SymbolConfigDialog'
import { backtesterAPI } from '../../../api/backtester.api'
import { toast } from 'react-toastify'
import { t } from '../../../utils/translator'

const SymbolInfoDialog = ({
  isOpen,
  symbol,
  type,
  symbolData,
  tradeseaData,
  tradingViewData,
  tradeseaFiles,
  tradingviewFiles,
  unknownFiles,
  symbols = {},
  isDark,
  onClose,
  onUpdate,
  onOverwrite,
  onReset,
  onDownload,
  progressState,
}: SymbolInfoDialogProps) => {
  const [selectedContractIndex, setSelectedContractIndex] = useState<number | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    action: 'reset' | 'overwrite' | null
    symbol: string | null
    isContract: boolean
  }>({
    isOpen: false,
    action: null,
    symbol: null,
    isContract: false
  })
  const [configDialog, setConfigDialog] = useState<{
    isOpen: boolean
    symbol: string
    type: 'tradesea' | 'tradingview'
    tickerType?: string
  }>({
    isOpen: false,
    symbol: '',
    type: 'tradesea',
    tickerType: undefined
  })

  // Get current progress for this symbol
  const getCurrentProgress = (checkSymbol?: string, checkType?: 'tradesea' | 'tradingview'): {
    symbol: string
    source: 'tradesea' | 'tradingview'
    action: 'download' | 'update' | 'overwrite' | 'reset'
    progress: number
    message: string
    timestamp: number
    completed?: boolean
  } | null => {
    if (!progressState) return null
    
    const symbolToCheck = checkSymbol || symbol
    const typeToCheck = checkType || type
    
    // For Tradesea, normalize symbol (remove leading slash)
    const normalizedSymbol = typeToCheck === 'tradesea' && symbolToCheck.startsWith('/')
      ? symbolToCheck.slice(1) 
      : symbolToCheck
    
    // Check for download, update, overwrite, reset progress
    const actions: Array<'download' | 'update' | 'overwrite' | 'reset'> = ['download', 'update', 'overwrite', 'reset']
    for (const action of actions) {
      const progressKey = `${typeToCheck}_${normalizedSymbol}_${action}`
      const progress = progressState[progressKey]
      if (progress) {
        // Exclude completed operations
        if (progress.progress >= 100) continue
        if (progress.completed === true) continue
        const message = (progress.message || '').toLowerCase()
        if (message.includes('complete') || message.includes('completed')) continue
        if (!message || message.trim() === '') continue
        return progress
      }
    }
    return null
  }

  const currentProgress = getCurrentProgress()

  // Strip HTML tags helper function
  const stripHtml = (html: string) => {
    if (!html) return ''
    return html.replace(/<[^>]*>/g, '')
  }

  // Get files for the current symbol/contract
  const getFilesForSymbol = (symbolInfo: { base: string; full: string; fullConfig: string }): FileData[] => {
    const { base: baseSymbol, full: fullSymbol, fullConfig: fullSymbolConfig } = symbolInfo
    
    // First try to get files from the main file lists
    let files = type === 'tradesea' ? (tradeseaFiles || []) : (tradingviewFiles || [])
    
    // Check if files exist in main lists
    const hasFilesInMain = files.some(item => {
      if (type === 'tradesea') {
        const fileSymbol = item.symbol.startsWith('/') ? item.symbol.slice(1) : item.symbol
        const normalizedBase = baseSymbol.startsWith('/') ? baseSymbol.slice(1) : baseSymbol
        return fileSymbol === normalizedBase
      } else {
        return item.symbol === fullSymbolConfig
      }
    })
    
    // If no files found in main lists, check unknownFiles
    if (!hasFilesInMain && unknownFiles && unknownFiles.length > 0) {
      const unknownMatches = unknownFiles.filter(file => {
        if (type === 'tradesea') {
          const fileSymbol = file.symbol.startsWith('/') ? file.symbol.slice(1) : file.symbol
          const normalizedBase = baseSymbol.startsWith('/') ? baseSymbol.slice(1) : baseSymbol
          return fileSymbol === normalizedBase
        } else {
          return file.symbol === fullSymbolConfig || file.symbol === fullSymbol
        }
      })
      
      if (unknownMatches.length > 0) {
        files = unknownMatches
      }
    }
    
    if (files.length === 0) return []
    
    return files.filter(file => {
      if (type === 'tradesea') {
        // For Tradesea: CSV files are stored without leading slash (e.g., "NQ" folder)
        // Normalize both the symbol and file.symbol for comparison
        const normalizedBase = baseSymbol.startsWith('/') ? baseSymbol.slice(1) : baseSymbol
        const normalizedFileSymbol = file.symbol.startsWith('/') ? file.symbol.slice(1) : file.symbol
        // File symbol should match the base symbol without slash
        return normalizedFileSymbol === normalizedBase
      } else if (type === 'tradingview') {
        // For TradingView: CSV files are stored using double underscore format (e.g., "CME_MINI__NQ1!")
        // Only match if file.symbol exactly matches the fullConfig format (double underscore)
        return file.symbol === fullSymbolConfig
      }
      return false
    })
  }

  // Get date range from files
  const getDateRange = (files: FileData[]): { first: string | null; last: string | null } => {
    if (files.length === 0) return { first: null, last: null }
    
    const sortedFiles = [...files].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      return months.indexOf(a.month) - months.indexOf(b.month)
    })

    const firstFile = sortedFiles[0]
    const lastFile = sortedFiles[sortedFiles.length - 1]
    
    return {
      first: firstFile ? `${firstFile.month} ${firstFile.year}` : null,
      last: lastFile ? `${lastFile.month} ${lastFile.year}` : null
    }
  }

  // Convert colon to double underscore for config/file matching
  const convertToConfigFormat = (symbolStr: string): string => {
    return symbolStr.replace(/:/g, '__')
  }

  // Get files and candle times for current symbol/contract
  const currentSymbol = useMemo(() => {
    if (selectedContractIndex !== null && tradingViewData?.contracts) {
      const contract = tradingViewData.contracts[selectedContractIndex]
      const contractSymbol = stripHtml(contract.symbol || '')
      // Return the full formatted symbol for TradingView contracts (e.g., "CME_MINI:NQ1!")
      const fullSymbol = `${tradingViewData.source_id || 'CME_MINI'}:${contractSymbol}`
      // Also create the config format version (with double underscore)
      const fullSymbolConfig = convertToConfigFormat(fullSymbol)
      return { base: contractSymbol, full: fullSymbol, fullConfig: fullSymbolConfig }
    }
    // For TradingView without contract selection, use formatted symbol
    if (tradingViewData?.formattedSymbol) {
      const baseSymbol = tradingViewData.formattedSymbol.split(':').pop() || symbol
      const fullSymbolConfig = convertToConfigFormat(tradingViewData.formattedSymbol)
      return { base: baseSymbol, full: tradingViewData.formattedSymbol, fullConfig: fullSymbolConfig }
    }
    // For Tradesea, return as-is (will be normalized in getFilesForSymbol)
    return { base: symbol, full: symbol, fullConfig: symbol }
  }, [selectedContractIndex, tradingViewData, symbol])

  const filesForCurrentSymbol = useMemo(() => getFilesForSymbol(currentSymbol), [currentSymbol, type, tradeseaFiles, tradingviewFiles, unknownFiles])
  const hasFiles = filesForCurrentSymbol.length > 0
  const dateRange = useMemo(() => getDateRange(filesForCurrentSymbol), [filesForCurrentSymbol])

  // Check if symbol exists in config (for Tradesea, check without leading slash; for TradingView, check multiple variations)
  const symbolsToCheckInConfig = useMemo(() => {
    const checks: string[] = []
    
    if (type === 'tradesea') {
      // For Tradesea, check with and without leading slash
      if (symbol.startsWith('/')) {
        checks.push(symbol.slice(1))
      }
      checks.push(symbol)
    } else if (type === 'tradingview') {
      // For TradingView, check multiple variations:
      // 1. Config format (double underscore version) - e.g., "CME_MINI__NQ1!"
      checks.push(currentSymbol.fullConfig)
      
      // 2. Contract symbol without prefix - e.g., "NQ1!"
      if (currentSymbol.base) {
        checks.push(currentSymbol.base)
        
        // 3. Base symbol without suffix (remove trailing numbers and !) - e.g., "NQ"
        const baseWithoutSuffix = currentSymbol.base.replace(/[!0-9]+$/, '')
        if (baseWithoutSuffix && baseWithoutSuffix !== currentSymbol.base) {
          checks.push(baseWithoutSuffix)
        }
      }
    }
    
    return checks
  }, [symbol, type, currentSymbol, tradingViewData])

  const symbolExistsInConfig = useMemo(() => {
    return symbolData !== undefined && symbolData !== null
  }, [symbolData])

  // Reset selected contract when dialog closes or symbol changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedContractIndex(null)
    }
  }, [isOpen, symbol])

  if (!isOpen) return null

  const isTradesea = type === 'tradesea'

  const selectContract = (index: number) => {
    setSelectedContractIndex(index === selectedContractIndex ? null : index)
  }

  const handleContractAction = async (action: 'update' | 'overwrite' | 'reset', contractSymbol: string) => {
    const fullSymbol = contractSymbol.includes(':') ? contractSymbol : `${tradingViewData?.source_id || 'CME_MINI'}:${contractSymbol}`
    
    // Show confirmation for reset and overwrite
    if (action === 'reset' || action === 'overwrite') {
      setConfirmDialog({
        isOpen: true,
        action,
        symbol: fullSymbol,
        isContract: true
      })
      return
    }
    
    // Update doesn't need confirmation
    if (action === 'update' && onUpdate) {
      await onUpdate(fullSymbol)
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmDialog.action || !confirmDialog.symbol) return

    const { action, symbol } = confirmDialog
    setConfirmDialog({ isOpen: false, action: null, symbol: null, isContract: false })

    if (action === 'overwrite' && onOverwrite) {
      await onOverwrite(symbol)
    } else if (action === 'reset' && onReset) {
      await onReset(symbol)
    }
  }

  const handleResetClick = (symbolToReset: string) => {
    setConfirmDialog({
      isOpen: true,
      action: 'reset',
      symbol: symbolToReset,
      isContract: false
    })
  }

  const handleOverwriteClick = (symbolToOverwrite: string) => {
    setConfirmDialog({
      isOpen: true,
      action: 'overwrite',
      symbol: symbolToOverwrite,
      isContract: false
    })
  }

  // Render file information section
  const renderFileInfo = () => {
    // Determine which symbols to display for config check
    const displaySymbols = symbolsToCheckInConfig
    
    return (
      <div className={`p-4 rounded-lg mb-4 ${
        isDark ? 'bg-slate-900/50' : 'bg-slate-50'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            File Status
          </h4>
          <span className={`text-xs px-2 py-1 rounded ${
            hasFiles
              ? isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
              : isDark ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'
          }`}>
            {hasFiles ? 'Files Exist' : 'No Files'}
          </span>
        </div>
        <div className={`mb-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          <span className="font-medium">Config Check:</span> {symbolExistsInConfig ? (
            <span className={isDark ? 'text-green-300' : 'text-green-700'}>
              Symbol {displaySymbols.length > 1 ? `(${displaySymbols.join(', ')})` : `"${displaySymbols[0]}"`} exists in config.json
            </span>
          ) : (
            <span className={isDark ? 'text-blue-300' : 'text-blue-700'}>
              Symbol {displaySymbols.length > 1 ? `(${displaySymbols.join(', ')})` : `"${displaySymbols[0]}"`} not found in config.json
            </span>
          )}
        </div>
        {hasFiles ? (
          <div className="space-y-1 text-xs">
            <div className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <span className="font-medium">Files:</span> {filesForCurrentSymbol.length} file{filesForCurrentSymbol.length !== 1 ? 's' : ''}
            </div>
            {dateRange.first && dateRange.last && (
              <div className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <span className="font-medium">Date Range:</span> {dateRange.first} - {dateRange.last}
              </div>
            )}
          </div>
        ) : (
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            No CSV files found for this symbol. Click Download to fetch data.
          </p>
        )}
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the dialog content
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`rounded-2xl shadow-2xl border ${
          (isTradesea && tradeseaData) || (!isTradesea && tradingViewData) ? 'max-w-4xl' : 'max-w-2xl'
        } w-full max-h-[90vh] overflow-y-auto ${
          isDark
            ? 'bg-slate-800 border-slate-700'
            : 'bg-white border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDark ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {symbol}
            </h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {isTradesea ? t('backtesterDataManagement.symbolInfoDialog.tradeseaSymbol') : t('backtesterDataManagement.symbolInfoDialog.tradingviewSymbol')}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tradesea Search Result Information */}
          {isTradesea && tradeseaData && (
            <div className="space-y-4 mb-6">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('backtesterDataManagement.symbolInfoDialog.tradeseaSearchResult')}
              </h3>
              <div className={`grid grid-cols-2 gap-4 p-4 rounded-lg ${
                isDark ? 'bg-slate-900/50' : 'bg-slate-50'
              }`}>
                {tradeseaData.symbol && (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Symbol
                    </label>
                    <p className={`font-mono text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                      {tradeseaData.symbol}
                    </p>
                  </div>
                )}
                {tradeseaData.full_name && (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Full Name
                    </label>
                    <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {tradeseaData.full_name}
                    </p>
                  </div>
                )}
                {tradeseaData.description && (
                  <div className="col-span-2">
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Description
                    </label>
                    <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {tradeseaData.description}
                    </p>
                  </div>
                )}
                {tradeseaData.type && (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Type
                    </label>
                    <p className={`capitalize ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {tradeseaData.type}
                    </p>
                  </div>
                )}
                {tradeseaData.exchange && (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Exchange
                    </label>
                    <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {tradeseaData.exchange}
                    </p>
                  </div>
                )}
                {tradeseaData.ticker && (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Ticker
                    </label>
                    <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {tradeseaData.ticker}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* File Information and Actions for Tradesea */}
          {isTradesea && (
            <div className="space-y-4">
              {renderFileInfo()}
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Actions
              </h3>
              {(() => {
                const progress = currentProgress
                if (progress) {
                  return (
                    <div className={`p-4 rounded-lg ${
                      isDark ? 'bg-slate-800/50' : 'bg-slate-100'
                    }`}>
                      <div className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {progress.action === 'download' ? 'Downloading' :
                         progress.action === 'update' ? 'Updating' :
                         progress.action === 'overwrite' ? 'Overwriting' :
                         'Resetting'} {symbol}
                      </div>
                      {progress.message && (
                        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {progress.message}
                        </div>
                      )}
                    </div>
                  )
                }
                return null
              })()}
              {!currentProgress && hasFiles ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {onUpdate && (
                    <button
                      onClick={() => onUpdate(symbol)}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                        isDark
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Update</span>
                    </button>
                  )}
                  {onOverwrite && (
                    <button
                      onClick={() => handleOverwriteClick(symbol)}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                        isDark
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      <span>Overwrite</span>
                    </button>
                  )}
                  {onReset && (
                    <button
                      onClick={() => handleResetClick(symbol)}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                        isDark
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {currentProgress ? (
                    <div className={`p-4 rounded-lg ${
                      isDark ? 'bg-slate-800/50' : 'bg-slate-100'
                    }`}>
                      <div className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {currentProgress.action === 'download' ? 'Downloading' :
                         currentProgress.action === 'update' ? 'Updating' :
                         currentProgress.action === 'overwrite' ? 'Overwriting' :
                         'Resetting'} {symbol}
                      </div>
                      {currentProgress.message && (
                        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {currentProgress.message}
                        </div>
                      )}
                    </div>
                  ) : onDownload ? (
                    <button
                      onClick={() => {
                        if (!symbolExistsInConfig) {
                          // Map Tradesea type to ticker_type: 'futures' -> 'futures', etc.
                          const tickerType = tradeseaData?.type?.toLowerCase() === 'futures' ? 'futures' :
                                            tradeseaData?.type?.toLowerCase() === 'stocks' ? 'stocks' :
                                            tradeseaData?.type?.toLowerCase() === 'forex' ? 'forex' :
                                            tradeseaData?.type?.toLowerCase() === 'crypto' ? 'crypto' :
                                            tradeseaData?.type?.toLowerCase() === 'indices' ? 'indices' :
                                            tradeseaData?.type?.toLowerCase() === 'commodities' ? 'commodities' :
                                            undefined
                          setConfigDialog({ isOpen: true, symbol, type: 'tradesea', tickerType })
                        } else {
                          onDownload(symbol, 'tradesea')
                        }
                      }}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 w-full ${
                        isDark
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* TradingView Information */}
          {!isTradesea && tradingViewData && (
            <div className="space-y-4">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                TradingView Information
              </h3>
              
              {/* Basic Information */}
              <div className={`grid grid-cols-2 gap-4 p-4 rounded-lg ${
                isDark ? 'bg-slate-900/50' : 'bg-slate-50'
              }`}>
                {tradingViewData.description && (
                  <div className="col-span-2">
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Description
                    </label>
                    <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {stripHtml(tradingViewData.description)}
                    </p>
                  </div>
                )}
                {tradingViewData.type && (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Type
                    </label>
                    <p className={`capitalize ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {tradingViewData.type}
                    </p>
                  </div>
                )}
                {tradingViewData.exchange && (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Exchange
                    </label>
                    <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {tradingViewData.exchange}
                    </p>
                  </div>
                )}
                {tradingViewData.currency_code && (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Currency
                    </label>
                    <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {tradingViewData.currency_code}
                    </p>
                  </div>
                )}
                {tradingViewData.country && (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Country
                    </label>
                    <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {tradingViewData.country}
                    </p>
                  </div>
                )}
                {tradingViewData.source_id && (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Source ID
                    </label>
                    <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {tradingViewData.source_id}
                    </p>
                  </div>
                )}
                {tradingViewData.formattedSymbol && (
                  <div className="col-span-2">
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Formatted Symbol
                    </label>
                    <p className={`font-mono text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                      {tradingViewData.formattedSymbol}
                    </p>
                  </div>
                )}
              </div>

              {/* Contracts */}
              {tradingViewData.contracts && tradingViewData.contracts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Contracts ({tradingViewData.contracts.length})
                    </h4>
                    {selectedContractIndex !== null && (
                      <button
                        onClick={() => setSelectedContractIndex(null)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          isDark
                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        }`}
                      >
                        Show All
                      </button>
                    )}
                  </div>
                  
                  {selectedContractIndex === null ? (
                    // Show all contracts as list
                    <div className={`space-y-2 max-h-96 overflow-y-auto ${
                      isDark ? 'bg-slate-900/30' : 'bg-slate-50/50'
                    } p-3 rounded-lg`}>
                      {tradingViewData.contracts.map((contract: Contract, index: number) => {
                        const contractSymbol = stripHtml(contract.symbol || '')
                        const contractDescription = contract.description || ''
                        const typespecs = contract.typespecs || []
                        
                        return (
                          <div
                            key={index}
                            onClick={() => selectContract(index)}
                            className={`border rounded-lg cursor-pointer transition-all ${
                              isDark ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-700/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="px-3 py-2 flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {contractSymbol}
                                </span>
                                {contractDescription && (
                                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    {contractDescription}
                                  </span>
                                )}
                              </div>
                              {typespecs.length > 0 && (
                                <div className="flex gap-1 flex-shrink-0 ml-2">
                                  {typespecs.slice(0, 2).map((spec: string, specIndex: number) => (
                                    <span
                                      key={specIndex}
                                      className={`text-xs px-1.5 py-0.5 rounded ${
                                        isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                                      }`}
                                    >
                                      {spec}
                                    </span>
                                  ))}
                                  {typespecs.length > 2 && (
                                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                      +{typespecs.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    // Show only selected contract with details and actions
                    (() => {
                      const contract = tradingViewData.contracts[selectedContractIndex]
                      const contractSymbol = stripHtml(contract.symbol || '')
                      const contractDescription = contract.description || ''
                      const typespecs = contract.typespecs || []
                      const fullContractSymbol = contractSymbol.includes(':') 
                        ? contractSymbol 
                        : `${tradingViewData.source_id || 'CME_MINI'}:${contractSymbol}`
                      
                      return (
                        <div className="space-y-4">
                          <div className={`border rounded-lg ${
                            isDark ? 'border-blue-700 bg-slate-800/50' : 'border-blue-200 bg-white'
                          }`}>
                            <div className={`px-4 py-3 border-b ${
                              isDark ? 'border-slate-700' : 'border-slate-200'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className={`font-semibold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {contractSymbol}
                                  </h5>
                                  {contractDescription && (
                                    <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                      {contractDescription}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className={`px-4 py-3 space-y-3 ${
                              isDark ? 'bg-slate-900/30' : 'bg-slate-50/50'
                            }`}>
                              {contract.prefix && (
                                <div>
                                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Prefix
                                  </label>
                                  <p className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {contract.prefix}
                                  </p>
                                </div>
                              )}
                              {typespecs.length > 0 && (
                                <div>
                                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Type Specs
                                  </label>
                                  <div className="flex flex-wrap gap-1.5">
                                    {typespecs.map((spec: string, specIndex: number) => (
                                      <span
                                        key={specIndex}
                                        className={`text-xs px-2 py-0.5 rounded ${
                                          isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                                        }`}
                                      >
                                        {spec}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div>
                                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                  Full Symbol
                                </label>
                                <p className={`text-sm font-mono ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                  {fullContractSymbol}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* File Information for Selected Contract */}
                          {renderFileInfo()}

                          {/* Actions for Selected Contract */}
                          <div>
                            <h5 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              Actions
                            </h5>
                            {(() => {
                              const contractProgress = getCurrentProgress(fullContractSymbol, 'tradingview')
                              const contractInProgress = contractProgress !== null
                              
                              if (contractInProgress && contractProgress) {
                                return (
                                  <div className={`p-4 rounded-lg ${
                                    isDark ? 'bg-slate-800/50' : 'bg-slate-100'
                                  }`}>
                                    <div className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                      {contractProgress.action === 'download' ? 'Downloading' :
                                       contractProgress.action === 'update' ? 'Updating' :
                                       contractProgress.action === 'overwrite' ? 'Overwriting' :
                                       'Resetting'} {fullContractSymbol}
                                    </div>
                                    {contractProgress.message && (
                                      <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                        {contractProgress.message}
                                      </div>
                                    )}
                                  </div>
                                )
                              }
                              
                              return hasFiles ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {onUpdate && (
                                    <button
                                      onClick={() => handleContractAction('update', contractSymbol)}
                                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                                        isDark
                                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                                      }`}
                                    >
                                      <RefreshCw className="w-4 h-4" />
                                      <span>Update</span>
                                    </button>
                                  )}
                                  {onOverwrite && (
                                    <button
                                      onClick={() => handleContractAction('overwrite', contractSymbol)}
                                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                                        isDark
                                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                                      }`}
                                    >
                                      <Download className="w-4 h-4" />
                                      <span>Overwrite</span>
                                    </button>
                                  )}
                                  {onReset && (
                                    <button
                                      onClick={() => handleContractAction('reset', contractSymbol)}
                                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                                        isDark
                                          ? 'bg-red-600 hover:bg-red-700 text-white'
                                          : 'bg-red-600 hover:bg-red-700 text-white'
                                      }`}
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                      <span>Reset</span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  {onDownload && (
                                    <button
                                      onClick={() => {
                                        if (!symbolExistsInConfig) {
                                          // Map TradingView type to ticker_type
                                          const contractType = (contract as Contract).type
                                          const tickerType = contractType?.toLowerCase() === 'futures' ? 'futures' : 
                                                            contractType?.toLowerCase() === 'stocks' ? 'stocks' :
                                                            contractType?.toLowerCase() === 'forex' ? 'forex' :
                                                            contractType?.toLowerCase() === 'crypto' ? 'crypto' :
                                                            contractType?.toLowerCase() === 'indices' ? 'indices' :
                                                            contractType?.toLowerCase() === 'commodities' ? 'commodities' :
                                                            tradingViewData?.type?.toLowerCase() === 'futures' ? 'futures' :
                                                            tradingViewData?.type?.toLowerCase() === 'stocks' ? 'stocks' :
                                                            tradingViewData?.type?.toLowerCase() === 'forex' ? 'forex' :
                                                            tradingViewData?.type?.toLowerCase() === 'crypto' ? 'crypto' :
                                                            tradingViewData?.type?.toLowerCase() === 'indices' ? 'indices' :
                                                            tradingViewData?.type?.toLowerCase() === 'commodities' ? 'commodities' :
                                                            undefined
                                          setConfigDialog({ isOpen: true, symbol: fullContractSymbol, type: 'tradingview', tickerType })
                                        } else {
                                          onDownload(fullContractSymbol, 'tradingview')
                                        }
                                      }}
                                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 w-full ${
                                        isDark
                                          ? 'bg-green-600 hover:bg-green-700 text-white'
                                          : 'bg-green-600 hover:bg-green-700 text-white'
                                      }`}
                                    >
                                      <Download className="w-4 h-4" />
                                      <span>Download</span>
                                    </button>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      )
                    })()
                  )}
                </div>
              )}

              {/* File Information and Actions for TradingView when no contracts */}
              {(!tradingViewData.contracts || tradingViewData.contracts.length === 0) && (
                <div className="space-y-4 mt-6">
                  {renderFileInfo()}
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Actions
                  </h3>
                  {(() => {
                    const mainSymbol = tradingViewData.formattedSymbol || symbol
                    const mainProgress = getCurrentProgress(mainSymbol, 'tradingview')
                    const mainInProgress = mainProgress !== null
                    
                    if (mainInProgress && mainProgress) {
                      return (
                        <div className={`p-4 rounded-lg ${
                          isDark ? 'bg-slate-800/50' : 'bg-slate-100'
                        }`}>
                          <div className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {mainProgress.action === 'download' ? 'Downloading' :
                             mainProgress.action === 'update' ? 'Updating' :
                             mainProgress.action === 'overwrite' ? 'Overwriting' :
                             'Resetting'} {mainSymbol}
                          </div>
                          {mainProgress.message && (
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              {mainProgress.message}
                            </div>
                          )}
                        </div>
                      )
                    }
                    
                    return hasFiles ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {onUpdate && (
                          <button
                            onClick={() => onUpdate(mainSymbol)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                              isDark
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Update</span>
                          </button>
                        )}
                        {onOverwrite && (
                          <button
                            onClick={() => handleOverwriteClick(mainSymbol)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                              isDark
                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <Download className="w-4 h-4" />
                            <span>Overwrite</span>
                          </button>
                        )}
                        {onReset && (
                          <button
                            onClick={() => handleResetClick(mainSymbol)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${
                              isDark
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    ) : (
                    <div>
                      {(() => {
                        const mainSymbol = tradingViewData.formattedSymbol || symbol
                        const mainProgress = getCurrentProgress(mainSymbol, 'tradingview')
                        const mainInProgress = mainProgress !== null
                        
                        if (mainInProgress && mainProgress) {
                          return (
                            <div className={`p-4 rounded-lg ${
                              isDark ? 'bg-slate-800/50' : 'bg-slate-100'
                            }`}>
                              <div className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {mainProgress.action === 'download' ? 'Downloading' :
                                 mainProgress.action === 'update' ? 'Updating' :
                                 mainProgress.action === 'overwrite' ? 'Overwriting' :
                                 'Resetting'} {mainSymbol}
                              </div>
                              {mainProgress.message && (
                                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {mainProgress.message}
                                </div>
                              )}
                            </div>
                          )
                        }
                        
                        return onDownload && (
                          <button
                            onClick={() => {
                              if (!symbolExistsInConfig) {
                                // Map TradingView type to ticker_type
                                const tickerType = tradingViewData?.type?.toLowerCase() === 'futures' ? 'futures' : 
                                                  tradingViewData?.type?.toLowerCase() === 'stocks' ? 'stocks' :
                                                  tradingViewData?.type?.toLowerCase() === 'forex' ? 'forex' :
                                                  tradingViewData?.type?.toLowerCase() === 'crypto' ? 'crypto' :
                                                  tradingViewData?.type?.toLowerCase() === 'indices' ? 'indices' :
                                                  tradingViewData?.type?.toLowerCase() === 'commodities' ? 'commodities' :
                                                  undefined
                                setConfigDialog({ isOpen: true, symbol: mainSymbol, type: 'tradingview', tickerType })
                              } else {
                                onDownload(mainSymbol, 'tradingview')
                              }
                            }}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 w-full ${
                              isDark
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            <Download className="w-4 h-4" />
                            <span>Download</span>
                          </button>
                        )
                      })()}
                    </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Info message for TradingView when no data */}
          {!isTradesea && !tradingViewData && (
            <div className={`p-4 rounded-lg ${
              isDark ? 'bg-slate-900/50' : 'bg-slate-50'
            }`}>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                TradingView symbols are read-only. Use the search to find and select symbols.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.action === 'reset' ? 'Confirm Reset' : 'Confirm Overwrite'}
        message={
          confirmDialog.action === 'reset'
            ? `Are you sure you want to reset data for "${confirmDialog.symbol}"? This will delete all existing data and download fresh data. This action cannot be undone.`
            : `Are you sure you want to overwrite data for "${confirmDialog.symbol}"? This will replace all existing data with new data from the API. Existing data will be lost.`
        }
        confirmText={confirmDialog.action === 'reset' ? 'Reset' : 'Overwrite'}
        cancelText="Cancel"
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmDialog({ isOpen: false, action: null, symbol: null, isContract: false })}
        variant={confirmDialog.action === 'reset' ? 'danger' : 'warning'}
        isDark={isDark}
      />

      {/* Symbol Configuration Dialog */}
      <SymbolConfigDialog
        isOpen={configDialog.isOpen}
        symbol={configDialog.symbol}
        type={configDialog.type}
        description={tradingViewData?.description || tradeseaData?.description}
        tickerType={configDialog.tickerType}
        symbols={symbols}
        isDark={isDark}
        onClose={() => setConfigDialog({ isOpen: false, symbol: '', type: 'tradesea', tickerType: undefined })}
        onSaveAndDownload={async (config: any) => {
          try {
            // Save symbol to config
            const response = await backtesterAPI.saveSymbolConfig({
              symbol: config.symbol,
              tickSize: config.tickSize,
              tickValue: config.tickValue,
              description: config.description,
              type: config.type,
              ticker_type: config.ticker_type,
              exchangeFee: config.exchangeFee,
              regulatoryFee: config.regulatoryFee,
              commissionFee: config.commissionFee,
              totalFees: config.totalFees,
            })
            
            if (response.success) {
              toast.success('Symbol configuration saved')
              // Close config dialog
              setConfigDialog({ isOpen: false, symbol: '', type: 'tradesea', tickerType: undefined })
              // Proceed with download - use the original symbol format (not normalized)
              if (onDownload) {
                // For TradingView, convert back from double underscore to colon format
                const downloadSymbol = config.type === 'tradingview' 
                  ? config.symbol.replace(/__/g, ':')
                  : (config.type === 'tradesea' && !config.symbol.startsWith('/')
                    ? `/${config.symbol}` 
                    : config.symbol)
                await onDownload(downloadSymbol, config.type)
              }
            } else {
              throw new Error(response.message || 'Failed to save symbol configuration')
            }
          } catch (error: any) {
            toast.error(error.message || 'Failed to save symbol configuration')
            throw error
          }
        }}
      />
    </div>
  )
}

export default SymbolInfoDialog
