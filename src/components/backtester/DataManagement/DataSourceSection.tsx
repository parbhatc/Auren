import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import { FileData, DataSourceSectionProps, SearchResult } from '../../../types/backtesterDataManagement'
import { t } from '../../../utils/translator'

const DataSourceSection = ({
  title,
  searchValue,
  searchResults,
  searchError,
  searchLoading = false,
  onSearchChange,
  files,
  loadingFiles,
  type,
  colorScheme,
  isDark,
  expandedSymbols,
  expandedYears,
  onToggleSymbol,
  onToggleYear,
  onSymbolClick,
  progressState,
  symbolsConfig = {},
}: DataSourceSectionProps) => {
  const colorClasses = {
    blue: {
      border: isDark ? 'border-blue-700/50' : 'border-blue-200',
      badge: isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700',
      hover: isDark ? 'hover:bg-blue-900/20' : 'hover:bg-blue-50',
    },
    purple: {
      border: isDark ? 'border-blue-700/50' : 'border-blue-200',
      badge: isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700',
      hover: isDark ? 'hover:bg-blue-900/20' : 'hover:bg-blue-50',
    },
  }
  const colors = colorClasses[colorScheme]

  const organizeFilesBySymbolAndYear = (files: FileData[]) => {
    const organized: Record<string, Record<number, FileData[]>> = {}
    
    for (const file of files) {
      if (!organized[file.symbol]) {
        organized[file.symbol] = {}
      }
      if (!organized[file.symbol][file.year]) {
        organized[file.symbol][file.year] = []
      }
      organized[file.symbol][file.year].push(file)
    }

    // Sort months within each year
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    
    for (const symbol in organized) {
      for (const year in organized[symbol]) {
        organized[symbol][parseInt(year)].sort((a, b) => {
          return months.indexOf(b.month) - months.indexOf(a.month)
        })
      }
    }

    return organized
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const organized = organizeFilesBySymbolAndYear(files)
  
  // Filter symbols to only include those in config.json that match the current type
  const filteredSymbols = Object.keys(organized).filter(symbol => {
    // For Tradesea, normalize symbol (remove leading slash for comparison)
    if (type === 'tradesea') {
      const normalizedSymbol = symbol.startsWith('/') ? symbol.slice(1) : symbol
      // Check if symbol exists in config (with or without slash)
      const configEntry = symbolsConfig[normalizedSymbol] || symbolsConfig[`/${normalizedSymbol}`]
      // Must exist in config AND match type (or have no type specified, default to tradesea)
      return configEntry && (configEntry.type === 'tradesea' || !configEntry.type)
    }
    
    // For TradingView, check exact match and also check double underscore format
    if (type === 'tradingview') {
      // Check exact symbol match
      const configEntry = symbolsConfig[symbol]
      if (configEntry && configEntry.type === 'tradingview') {
        return true
      }
      
      // Also check if symbol matches any config entry's double underscore format
      // TradingView files use double underscore format (e.g., "CME_MINI__NQ1!")
      for (const [configSymbol, configData] of Object.entries(symbolsConfig)) {
        if (configData.type === 'tradingview' && configSymbol === symbol) {
          return true
        }
      }
      
      return false
    }
    
    return false
  }).sort()
  
  // Recalculate totalFiles based on filtered symbols
  const totalFiles = filteredSymbols.reduce((total, symbol) => {
    return total + Object.values(organized[symbol] || {}).reduce((yearTotal, files) => yearTotal + files.length, 0)
  }, 0)
  
  const symbols = filteredSymbols

  // Filter progress for this source (exclude completed operations)
  const activeProgress = progressState
    ? Object.values(progressState).filter(
        (p) => {
          if (p.source !== type) return false
          if (p.progress >= 100) return false
          // Exclude if completed flag is set
          if (p.completed === true) return false
          // Also exclude if message indicates completion
          const message = (p.message || '').toLowerCase()
          if (message.includes('complete') || message.includes('completed')) return false
          // Exclude empty messages (usually indicates completion)
          if (!message || message.trim() === '') return false
          return true
        }
      )
    : []


  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Progress Section */}
      {activeProgress.length > 0 && (
        <div
          className={`rounded-2xl shadow-lg border overflow-hidden ${
            isDark
              ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
              : 'bg-white/90 border-slate-200 backdrop-blur-sm'
          }`}
        >
          <div className="p-4 sm:p-6">
            <h3 className={`text-base sm:text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Active Operations
            </h3>
            <div className="space-y-3">
              {activeProgress.map((progress) => {
                const progressKey = `${progress.source}_${progress.symbol}_${progress.action}`
                const actionLabels: Record<string, string> = {
                  download: t('backtesterDataManagement.tradesea.downloading'),
                  update: t('backtesterDataManagement.tradesea.updating'),
                  overwrite: t('backtesterDataManagement.tradesea.overwriting'),
                  reset: t('backtesterDataManagement.tradesea.resetting'),
                }
                const actionLabel = actionLabels[progress.action] || progress.action

                return (
                  <div key={progressKey} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {actionLabel} {progress.symbol}
                      </span>
                    </div>
                    {progress.message && (
                      <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {progress.message}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div
        className={`rounded-2xl shadow-lg border overflow-hidden ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
      >
        <div className="p-4 sm:p-6">
          <h2 className={`text-lg sm:text-xl font-bold mb-3 sm:mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {title}
          </h2>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('backtesterDataManagement.dataSource.searchPlaceholder', { source: title })}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border outline-none transition-all ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:bg-slate-800 focus:border-blue-500'
                  : 'bg-white/80 border-slate-300 text-slate-900 placeholder-slate-500 focus:bg-white focus:border-blue-500'
              }`}
            />
          </div>
          
          {/* Search Error */}
          {searchValue.trim() && searchError && (
            <div className={`mt-4 p-3 rounded-lg border ${
              isDark
                ? 'bg-red-900/30 border-red-700/50'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                {searchError}
              </p>
            </div>
          )}
          
          {/* Search Results */}
          {searchValue.trim() && !searchError && searchResults.length > 0 && (
            <div className={`mt-4 p-3 rounded-lg border ${
              isDark
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <p className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Search Results ({searchResults.length}):
              </p>
              <div className={`max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar ${isDark ? 'dark' : ''}`}>
                {searchResults.map((result, index) => {
                  // Handle both string and object results
                  const isObject = typeof result === 'object' && result !== null
                  const resultObj = isObject ? (result as SearchResult) : null
                  
                  // Strip HTML tags from symbol/description (TradingView returns HTML like <em>TE</em>)
                  const stripHtml = (html: string) => {
                    if (!html) return ''
                    return html.replace(/<[^>]*>/g, '')
                  }
                  
                  const rawSymbol = resultObj?.symbol || resultObj?.full_name || resultObj?.ticker || ''
                  const displayText = isObject && resultObj
                    ? (rawSymbol ? stripHtml(rawSymbol) : JSON.stringify(resultObj))
                    : String(result)
                  
                  const rawDescription = resultObj?.description || null
                  const description = rawDescription ? stripHtml(rawDescription) : null
                  const exchange = resultObj?.exchange || resultObj?.source2?.name || null
                  const resultType = resultObj?.type || null
                  const currencyCode = resultObj?.currency_code || null
                  const country = resultObj?.country || null
                  const contracts = resultObj?.contracts || []
                  const hasContracts = contracts.length > 0
                  
                  // Extract symbol from result for click handler
                  // Prefer formattedSymbol if available (for TradingView), otherwise use raw symbol
                  const symbolToClick = (resultObj as any)?.formattedSymbol || 
                                       stripHtml(rawSymbol) || 
                                       resultObj?.full_name || 
                                       resultObj?.ticker || 
                                       displayText
                  
                  return (
                    <div
                      key={index}
                      onClick={() => onSymbolClick && onSymbolClick(symbolToClick, type)}
                      className={`px-3 py-2.5 rounded transition-colors hover:opacity-80 cursor-pointer ${
                        isDark ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{displayText}</div>
                          {description && (
                            <div className={`text-xs mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              {description}
                            </div>
                          )}
                          {!description && type === 'tradesea' && (
                            <div className={`text-xs mt-1.5 italic ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                              {t('backtesterDataManagement.dataSource.noDescription')}
                            </div>
                          )}
                          {/* Show additional info for TradingView */}
                          {type === 'tradingview' && (
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {currencyCode && (
                                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                  {currencyCode}
                                </span>
                              )}
                              {country && (
                                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                  {country}
                                </span>
                              )}
                              {hasContracts && (
                                <span className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                  {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          {resultType && (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${
                              type === 'tradesea'
                                ? isDark ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' : 'bg-blue-100 text-blue-700 border border-blue-200'
                                : isDark ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              {resultType}
                            </span>
                          )}
                          {exchange && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              type === 'tradingview'
                                ? isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                                : isDark ? 'bg-slate-600/50 text-slate-300' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {exchange}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {/* Loading State */}
          {searchValue.trim() && searchLoading && !searchError && (
            <div className={`mt-4 p-3 rounded-lg border ${
              isDark
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('common.loading')}
              </p>
            </div>
          )}
          
          {/* No Results - Only show when search is complete (not loading), no error, and results are empty */}
          {searchValue.trim() && !searchLoading && !searchError && searchResults.length === 0 && (
            <div className={`mt-4 p-3 rounded-lg border ${
              isDark
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                No results found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CSV Files Section */}
      <div
        className={`rounded-2xl shadow-lg border overflow-hidden ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
      >
        <div className={`p-4 sm:p-6 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {title} CSV Files
          </h2>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {loadingFiles ? t('common.loading') : t('backtesterDataManagement.dataSource.filesCount', { count: totalFiles, symbols: symbols.length })}
          </p>
        </div>

        {loadingFiles ? (
          <div className="p-8 text-center">
            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t('backtesterDataManagement.dataSource.loadingFiles')}</p>
          </div>
        ) : symbols.length === 0 ? (
          <div className="p-8 text-center">
            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
              {t('backtesterDataManagement.dataSource.noFiles', { source: title, type })}
            </p>
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
            {symbols.map((symbol) => {
              const isSymbolExpanded = expandedSymbols.has(symbol)
              const symbolYears = Object.keys(organized[symbol]).map(Number).sort((a, b) => b - a)

              return (
                <div key={symbol}>
                  <div className="flex items-center">
                    <button
                      onClick={() => onToggleSymbol(symbol)}
                      className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between ${colors.hover} transition-all ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        {isSymbolExpanded ? (
                          <ChevronDown className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span 
                          className="font-semibold text-sm sm:text-base hover:underline cursor-pointer truncate"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSymbolClick && onSymbolClick(symbol, type)
                          }}
                        >
                          {symbol}
                        </span>
                        <span className={`text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded ${colors.badge} flex-shrink-0`}>
                          {symbolYears.length} year{symbolYears.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className={`text-xs sm:text-sm flex-shrink-0 ml-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {Object.values(organized[symbol]).reduce((sum, files) => sum + files.length, 0)} files
                      </span>
                    </button>
                  </div>

                  {isSymbolExpanded && (
                    <div className={`${isDark ? 'bg-slate-900/50' : 'bg-slate-50/50'}`}>
                      {symbolYears.map((year) => {
                        const yearKey = `${symbol}-${year}`
                        const isYearExpanded = expandedYears.has(yearKey)
                        const yearFiles = organized[symbol][year]

                        return (
                          <div key={year}>
                            <button
                              onClick={() => onToggleYear(yearKey)}
                              className={`w-full px-4 sm:px-8 py-2 flex items-center justify-between ${colors.hover} transition-all ${
                                isDark ? 'text-slate-300' : 'text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 sm:gap-3">
                                {isYearExpanded ? (
                                  <ChevronDown className="w-4 h-4 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                                )}
                                <span className="font-medium text-sm sm:text-base">{year}</span>
                                <span className={`text-xs px-1.5 sm:px-2 py-0.5 rounded ${colors.badge} flex-shrink-0`}>
                                  {yearFiles.length} file{yearFiles.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </button>

                            {isYearExpanded && (
                              <div className={`px-4 sm:px-12 py-2 space-y-2 ${isDark ? 'bg-slate-950/50' : 'bg-white/50'}`}>
                                {yearFiles.map((file, index) => (
                                  <div
                                    key={index}
                                    className={`p-2 sm:p-3 rounded-lg border ${
                                      isDark
                                        ? 'bg-slate-800/50 border-slate-700'
                                        : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                                      <div className="flex-1 min-w-0">
                                        <p className={`font-medium text-xs sm:text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                          {file.fileName}
                                        </p>
                                        <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 text-xs">
                                          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                            {file.month}
                                          </span>
                                          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                            {formatFileSize(file.size)}
                                          </span>
                                          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                            {formatDate(file.modified)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default DataSourceSection
