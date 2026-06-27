import { X, Download, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { SymbolConfigDialogProps } from '../../../types/backtesterDataManagement'
import { t } from '../../../utils/translator'

const SymbolConfigDialog = ({
  isOpen,
  symbol,
  type,
  description: initialDescription,
  tickerType: initialTickerType,
  symbols = {},
  isDark,
  onClose,
  onSaveAndDownload,
}: SymbolConfigDialogProps) => {
  const [tickSize, setTickSize] = useState<string>('')
  const [tickValue, setTickValue] = useState<string>('')
  const [exchangeFee, setExchangeFee] = useState<string>('')
  const [regulatoryFee, setRegulatoryFee] = useState<string>('')
  const [commissionFee, setCommissionFee] = useState<string>('')
  const [totalFees, setTotalFees] = useState<string>('')
  const [tickerType, setTickerType] = useState<string>('futures')
  const [description, setDescription] = useState<string>(initialDescription || '')
  const [presetSymbol, setPresetSymbol] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Handle preset selection
  useEffect(() => {
    if (presetSymbol && symbols[presetSymbol]) {
      const preset = symbols[presetSymbol]
      setTickSize(preset.tickSize.toString())
      setTickValue(preset.tickValue.toString())
      setExchangeFee(preset.exchangeFee?.toString() || '')
      setRegulatoryFee(preset.regulatoryFee?.toString() || '')
      setCommissionFee(preset.commissionFee?.toString() || '')
      setTotalFees(preset.totalFees?.toString() || '')
      if (preset.ticker_type) {
        setTickerType(preset.ticker_type)
      }
      // Don't update description - keep the current one
    }
  }, [presetSymbol, symbols])

  // Auto-detect ticker_type based on symbol
  useEffect(() => {
    if (!isOpen) return
    
    // Reset form when dialog opens
    setTickSize('')
    setTickValue('')
    setExchangeFee('')
    setRegulatoryFee('')
    setCommissionFee('')
    setTotalFees('')
    setPresetSymbol('')
    setDescription(initialDescription || '')
    
    // Use provided tickerType if available, otherwise auto-detect
    if (initialTickerType) {
      setTickerType(initialTickerType)
    } else {
    // Auto-detect ticker_type: futures usually have numbers, !, or are common futures symbols
    const futuresPatterns = [
      /[0-9]/, // Contains numbers (e.g., NQ1, ESZ2024)
      /!$/, // Ends with ! (e.g., NQ1!)
      /^(ES|NQ|YM|RTY|CL|GC|SI|HG|NG|ZB|ZN|ZF|ZT|ZC|ZS|ZW|ZL|ZM|LE|HE|GF|KC|CT|SB|CC|OJ|LB|HO|RB|NG|PA|PL|GD|DX|6E|6B|6J|6S|6N|6A|6C|MES|MNQ|MYM|M2K|MCL|MGC|MSI|M6E|M6B|M6J|M6S|M6N|M6A|M6C)$/i // Common futures symbols
    ]
    
    const isFutures = futuresPatterns.some(pattern => pattern.test(symbol))
    setTickerType(isFutures ? 'futures' : 'stocks')
    }
  }, [isOpen, symbol, initialDescription, initialTickerType])

  if (!isOpen) return null

  const handleSaveAndDownload = async () => {
    // Only validate tick size/value for futures
    if (tickerType === 'futures') {
      if (!tickSize || !tickValue) {
        toast.error(t('backtesterDataManagement.symbolConfig.errorTickSizeRequired'))
        return
      }

      const tickSizeNum = parseFloat(tickSize)
      const tickValueNum = parseFloat(tickValue)

      if (isNaN(tickSizeNum) || isNaN(tickValueNum) || tickSizeNum <= 0 || tickValueNum <= 0) {
        toast.error('Tick size and tick value must be positive numbers')
        return
      }
    }

    setSaving(true)
    try {
      // Normalize symbol for config (TradingView uses double underscore format)
      const configSymbol = type === 'tradingview' 
        ? symbol.replace(/:/g, '__')
        : (symbol.startsWith('/') ? symbol.slice(1) : symbol)

      const configData: any = {
        symbol: configSymbol,
        ticker_type: tickerType,
        description: description || symbol,
        type,
      }

      // Only include tick size/value and fees for futures
      if (tickerType === 'futures') {
        const tickSizeNum = parseFloat(tickSize)
        const tickValueNum = parseFloat(tickValue)
        configData.tickSize = tickSizeNum
        configData.tickValue = tickValueNum
        if (exchangeFee) configData.exchangeFee = parseFloat(exchangeFee)
        if (regulatoryFee) configData.regulatoryFee = parseFloat(regulatoryFee)
        if (commissionFee) configData.commissionFee = parseFloat(commissionFee)
        if (totalFees) configData.totalFees = parseFloat(totalFees)
      }

      await onSaveAndDownload(configData)
      onClose()
    } catch (error: any) {
      toast.error(error.message || t('backtesterDataManagement.symbolConfig.errorSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const presetSymbols = Object.keys(symbols).filter(s => symbols[s]?.type === type || !symbols[s]?.type)

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the dialog content
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl border ${
          isDark
            ? 'bg-slate-800 border-slate-700'
            : 'bg-white border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Configure Symbol
            </h2>
            <button
              onClick={onClose}
              className={`p-1 rounded-lg transition-colors ${
                isDark
                  ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {tickerType === 'futures' && presetSymbols.length > 0 && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('backtesterDataManagement.symbolConfig.preset')}
                </label>
                <select
                  value={presetSymbol}
                  onChange={(e) => setPresetSymbol(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                    isDark
                      ? 'bg-slate-700 border-slate-600 text-white focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  <option value="">{t('backtesterDataManagement.symbolConfig.selectPreset')}</option>
                  {presetSymbols.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym} {symbols[sym]?.description ? `(${symbols[sym].description})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('backtesterDataManagement.symbolConfig.symbol')}
              </label>
              <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-900'}`}>
                {symbol}
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('backtesterDataManagement.symbolConfig.type')}
              </label>
              <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-900'}`}>
                {type === 'topstep' ? t('backtesterDataManagement.symbolConfig.topstepx') : t('backtesterDataManagement.symbolConfig.tradingview')}
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('backtesterDataManagement.symbolConfig.tickerType')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={tickerType}
                  onChange={(e) => setTickerType(e.target.value)}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg border appearance-none cursor-pointer transition-all duration-200 ${
                    isDark
                      ? 'bg-slate-800/90 border-slate-600 text-slate-100 hover:border-slate-500 hover:bg-slate-800'
                      : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 hover:bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm`}
                  style={{
                    paddingRight: '2.5rem',
                    backgroundImage: 'none'
                  }}
                >
                  <option value="futures">Futures</option>
                  <option value="stocks">Stocks</option>
                  <option value="forex">Forex</option>
                  <option value="crypto">Crypto</option>
                  <option value="indices">Indices</option>
                  <option value="commodities">Commodities</option>
                </select>
                <div className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
                className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                }`}
              />
            </div>

            {tickerType === 'futures' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('backtesterDataManagement.symbolConfig.tickSize')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={tickSize}
                      onChange={(e) => setTickSize(e.target.value)}
                      placeholder="0.25"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Tick Value <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={tickValue}
                      onChange={(e) => setTickValue(e.target.value)}
                      placeholder="5"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('backtesterDataManagement.symbolConfig.exchangeFee')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={exchangeFee}
                      onChange={(e) => setExchangeFee(e.target.value)}
                      placeholder="0"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Regulatory Fee
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={regulatoryFee}
                      onChange={(e) => setRegulatoryFee(e.target.value)}
                      placeholder="0"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('backtesterDataManagement.symbolConfig.commissionFee')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={commissionFee}
                      onChange={(e) => setCommissionFee(e.target.value)}
                      placeholder="0"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Total Fees
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalFees}
                      onChange={(e) => setTotalFees(e.target.value)}
                      placeholder="0"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndDownload}
              disabled={saving || (tickerType === 'futures' && (!tickSize || !tickValue))}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                saving || (tickerType === 'futures' && (!tickSize || !tickValue))
                  ? isDark
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : isDark
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{saving ? t('backtesterDataManagement.symbolConfig.saving') : t('backtesterDataManagement.symbolConfig.download')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SymbolConfigDialog
