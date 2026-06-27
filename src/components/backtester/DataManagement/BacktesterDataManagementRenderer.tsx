import { Component } from 'react'
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { ROUTES } from '../../../constants/routes'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import Loading from '../../common/Loading'
import ConfirmDialog from '../../common/ConfirmDialog'
import BacktesterNav from '../shared/BacktesterNav'
import HubHeroSection from '../../trading/Practice/hub/HubHeroSection'
import TokenSelector from './TokenSelector'
import DataSourceSection from './DataSourceSection'
import SymbolInfoDialog from './SymbolInfoDialog'
import { BacktesterDataManagementRendererProps, SymbolData } from '../../../types/backtesterDataManagement'
import { t } from '../../../utils/translator'
import { appPageBackground, ghostButtonClass, panelCardClass, primaryButtonClass, tabRailActiveClass, tabRailClass } from '../../../styles/aurenTheme'
import { Database } from 'lucide-react'

class BacktesterDataManagementRenderer extends Component<BacktesterDataManagementRendererProps> {
  render() {
    const {
      isDark,
      toggleTheme,
      user,
      colors,
      navigate,
      symbols,
      loading,
      error,
      success,
      editingSymbol,
      editingData,
      onEdit,
      onCancelEdit,
      onSave,
      onDelete,
      onAdd,
      onUpdateEditingData,
      saving,
      deleteConfirm,
      onDeleteConfirm,
      onDeleteCancel,
      activeTab,
      onTabChange,
      topstepFiles,
      tradingviewFiles,
      unknownFiles,
      loadingFiles,
      expandedSymbols,
      expandedYears,
      onToggleSymbol,
      onToggleYear,
      topstepSearch,
      tradingviewSearch,
      topstepSearchResults,
      tradingviewSearchResults,
      topstepSearchError,
      tradingviewSearchError,
      topstepSearchLoading,
      tradingviewSearchLoading,
      onTopstepSearchChange,
      onTradingviewSearchChange,
      topstepCurrentToken,
      tradingviewCurrentToken,
      topstepSavedToken,
      tradingviewSavedToken,
      onTopstepCurrentTokenChange,
      onTradingviewCurrentTokenChange,
      onTopstepTokenObtained,
      onTradingviewTokenObtained,
      onTopstepSaveToken,
      onTradingviewSaveToken,
      onTopstepUserLogin,
      onTradingviewUserLogin,
      selectedSymbol,
      onSymbolClick,
      onSymbolDialogClose,
      onSymbolUpdate,
      onSymbolOverwrite,
      onSymbolReset,
      onSymbolDownload,
      progressState,
    } = this.props

    if (!user?.isAdmin) {
      return (
        <div className={appPageBackground(isDark)}>
          <BacktesterNav
            isDark={isDark}
            toggleTheme={toggleTheme}
            navigate={navigate}
            activeTab="data"
            showAdmin
          />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            <div className={`${panelCardClass(isDark)} text-center max-w-md mx-auto`}>
              <h2 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('backtesterDataManagement.accessDenied')}
              </h2>
              <p className={`mb-6 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('backtesterDataManagement.adminRequired')}
              </p>
              <button
                type="button"
                onClick={() => navigate(ROUTES.BACKTESTER)}
                className={primaryButtonClass()}
              >
                {t('backtesterDataManagement.goToDashboard')}
              </button>
            </div>
          </main>
        </div>
      )
    }

    if (loading) {
      return <Loading />
    }

    const symbolEntries = Object.entries(symbols)

    return (
      <div className={appPageBackground(isDark)}>
        <BacktesterNav
          isDark={isDark}
          toggleTheme={toggleTheme}
          navigate={navigate}
          activeTab="data"
          showAdmin
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <HubHeroSection
            isDark={isDark}
            icon={Database}
            badge={t('backtester.data.badge', {}, 'Admin')}
            headline={t('backtesterDataManagement.title')}
            subtitle={t('backtesterDataManagement.subtitle')}
            accent="amber"
          />

          <ErrorMessage message={error} isDark={isDark} className="mb-4" />
          <SuccessMessage message={success} isDark={isDark} className="mb-4" />

          <div className={`mb-6 ${tabRailClass(isDark)} overflow-x-auto`}>
            {(['symbol-info', 'topstep', 'tradingview'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={`flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? tabRailActiveClass(isDark, tab === 'symbol-info' ? 'violet' : 'amber')
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'symbol-info' && t('backtesterDataManagement.tabs.symbolInfo')}
                {tab === 'topstep' && t('backtesterDataManagement.tabs.topstep')}
                {tab === 'tradingview' && t('backtesterDataManagement.tabs.tradingview')}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'symbol-info' && (
            <>
              {/* Add New Symbol Button */}
              <div className="mb-4 sm:mb-6 flex justify-end">
            <button
              onClick={onAdd}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 text-sm sm:text-base ${
                isDark
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{t('backtesterDataManagement.symbolInfo.addSymbol')}</span>
            </button>
          </div>

          {/* Symbols Table - Desktop */}
          <div
            className={`hidden lg:block rounded-2xl shadow-lg border overflow-hidden ${
              isDark
                ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                : 'bg-white/90 border-slate-200 backdrop-blur-sm'
            }`}
          >
            {symbolEntries.length === 0 ? (
              <div className="p-8 text-center">
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  {t('backtesterDataManagement.symbolInfo.noSymbols')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className={`border-b ${
                        isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <th className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Symbol
                      </th>
                      <th className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Type
                      </th>
                      <th className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold hidden md:table-cell ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Description
                      </th>
                      <th className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold hidden lg:table-cell ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Tick Size
                      </th>
                      <th className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold hidden lg:table-cell ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Tick Value
                      </th>
                      <th className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold hidden xl:table-cell ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Exchange Fee
                      </th>
                      <th className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold hidden xl:table-cell ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Regulatory Fee
                      </th>
                      <th className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold hidden xl:table-cell ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Commission Fee
                      </th>
                      <th className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold hidden xl:table-cell ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Total Fees
                      </th>
                      <th className={`px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {symbolEntries.map(([symbol, data]) => {
                      const isEditing = editingSymbol === symbol
                      // When editing, use editingData if available, otherwise fall back to data
                      const displayData = isEditing && editingData 
                        ? { 
                            tickSize: editingData.tickSize ?? data.tickSize,
                            tickValue: editingData.tickValue ?? data.tickValue,
                            exchangeFee: editingData.exchangeFee ?? data.exchangeFee,
                            regulatoryFee: editingData.regulatoryFee ?? data.regulatoryFee,
                            commissionFee: editingData.commissionFee ?? data.commissionFee,
                            totalFees: editingData.totalFees ?? data.totalFees,
                            description: editingData.description ?? data.description,
                            type: editingData.type ?? data.type ?? 'topstep',
                          }
                        : data

                      return (
                        <tr
                          key={symbol}
                          className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'} ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}
                        >
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <span className={`font-medium text-xs sm:text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {symbol}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            {isEditing ? (
                              <div className="relative">
                                <select
                                  value={displayData.type ?? 'topstep'}
                                  onChange={(e) => onUpdateEditingData('type' as any, e.target.value)}
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
                                  <option value="topstep">{t('backtesterDataManagement.symbolInfo.typeTopstep')}</option>
                                  <option value="tradingview">{t('backtesterDataManagement.symbolInfo.typeTradingview')}</option>
                                </select>
                                <div className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                                  isDark ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                              </div>
                            ) : (
                              <span className={`text-xs sm:text-sm font-medium px-2 py-1 rounded ${
                                (data.type || 'topstep') === 'topstep'
                                  ? isDark
                                    ? 'bg-blue-900/30 text-blue-300'
                                    : 'bg-blue-100 text-blue-700'
                                  : isDark
                                    ? 'bg-purple-900/30 text-purple-300'
                                    : 'bg-purple-100 text-purple-700'
                              }`}>
                                {(data.type || 'topstep').charAt(0).toUpperCase() + (data.type || 'topstep').slice(1)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
                            {isEditing ? (
                              <input
                                type="text"
                                value={displayData.description ?? ''}
                                onChange={(e) => onUpdateEditingData('description', e.target.value)}
                                className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border outline-none transition-all ${
                                  isDark
                                    ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                    : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                                }`}
                              />
                            ) : (
                              <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {data.description}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={displayData.tickSize ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  onUpdateEditingData('tickSize', val === '' ? '' : (parseFloat(val) || 0))
                                }}
                                className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border outline-none transition-all ${
                                  isDark
                                    ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                    : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                                }`}
                              />
                            ) : (
                              <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {data.tickSize}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={displayData.tickValue ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  onUpdateEditingData('tickValue', val === '' ? '' : (parseFloat(val) || 0))
                                }}
                                className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border outline-none transition-all ${
                                  isDark
                                    ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                    : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                                }`}
                              />
                            ) : (
                              <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {data.tickValue}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 hidden xl:table-cell">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={displayData.exchangeFee ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  onUpdateEditingData('exchangeFee', val === '' ? '' : (parseFloat(val) || 0))
                                }}
                                className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border outline-none transition-all ${
                                  isDark
                                    ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                    : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                                }`}
                              />
                            ) : (
                              <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {(data.exchangeFee ?? 0).toFixed(4)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 hidden xl:table-cell">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={displayData.regulatoryFee ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  onUpdateEditingData('regulatoryFee', val === '' ? '' : (parseFloat(val) || 0))
                                }}
                                className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border outline-none transition-all ${
                                  isDark
                                    ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                    : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                                }`}
                              />
                            ) : (
                              <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {(data.regulatoryFee ?? 0).toFixed(4)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 hidden xl:table-cell">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={displayData.commissionFee ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  onUpdateEditingData('commissionFee', val === '' ? '' : (parseFloat(val) || 0))
                                }}
                                className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border outline-none transition-all ${
                                  isDark
                                    ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                    : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                                }`}
                              />
                            ) : (
                              <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {(data.commissionFee ?? 0).toFixed(4)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 hidden xl:table-cell">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={displayData.totalFees ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  onUpdateEditingData('totalFees', val === '' ? '' : (parseFloat(val) || 0))
                                }}
                                className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg border outline-none transition-all ${
                                  isDark
                                    ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                    : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                                }`}
                              />
                            ) : (
                              <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {(data.totalFees ?? 0).toFixed(4)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => onSave(symbol, displayData as SymbolData)}
                                    disabled={saving}
                                    className={`p-1.5 sm:p-2 rounded transition-all duration-300 ${
                                      isDark
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title={t('backtesterDataManagement.symbolInfo.save')}
                                  >
                                    <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                  <button
                                    onClick={onCancelEdit}
                                    className={`p-1.5 sm:p-2 rounded transition-all duration-300 ${
                                      isDark
                                        ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                    }`}
                                    title={t('backtesterDataManagement.symbolInfo.cancel')}
                                  >
                                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => onEdit(symbol)}
                                    className={`p-1.5 sm:p-2 rounded transition-all duration-300 ${
                                      isDark
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                    title={t('backtesterDataManagement.symbolInfo.edit')}
                                  >
                                    <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                  <button
                                    onClick={() => onDelete(symbol)}
                                    className={`p-1.5 sm:p-2 rounded transition-all duration-300 ${
                                      isDark
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : 'bg-red-600 hover:bg-red-700 text-white'
                                    }`}
                                    title={t('backtesterDataManagement.symbolInfo.delete')}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {symbolEntries.length === 0 ? (
              <div
                className={`rounded-2xl shadow-lg border p-6 text-center ${
                  isDark
                    ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                    : 'bg-white/90 border-slate-200 backdrop-blur-sm'
                }`}
              >
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  {t('backtesterDataManagement.symbolInfo.noSymbols')}
                </p>
              </div>
            ) : (
              symbolEntries.map(([symbol, data]) => {
                const isEditing = editingSymbol === symbol
                const displayData = isEditing && editingData 
                  ? { 
                      tickSize: editingData.tickSize ?? data.tickSize,
                      tickValue: editingData.tickValue ?? data.tickValue,
                      exchangeFee: editingData.exchangeFee ?? data.exchangeFee,
                      regulatoryFee: editingData.regulatoryFee ?? data.regulatoryFee,
                      commissionFee: editingData.commissionFee ?? data.commissionFee,
                      totalFees: editingData.totalFees ?? data.totalFees,
                      description: editingData.description ?? data.description,
                      type: editingData.type ?? data.type ?? 'topstep',
                    }
                  : data

                return (
                  <div
                    key={symbol}
                    className={`rounded-2xl shadow-lg border p-4 ${
                      isDark
                        ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
                        : 'bg-white/90 border-slate-200 backdrop-blur-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {symbol}
                      </h3>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => onSave(symbol, displayData as SymbolData)}
                              disabled={saving}
                              className={`p-2 rounded transition-all duration-300 ${
                                isDark
                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={onCancelEdit}
                              className={`p-2 rounded transition-all duration-300 ${
                                isDark
                                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              }`}
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => onEdit(symbol)}
                              className={`p-2 rounded transition-all duration-300 ${
                                isDark
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDelete(symbol)}
                              className={`p-2 rounded transition-all duration-300 ${
                                isDark
                                  ? 'bg-red-600 hover:bg-red-700 text-white'
                                  : 'bg-red-600 hover:bg-red-700 text-white'
                              }`}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Type
                        </label>
                        {isEditing ? (
                          <div className="relative">
                            <select
                              value={displayData.type ?? 'topstep'}
                              onChange={(e) => onUpdateEditingData('type' as any, e.target.value)}
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
                              <option value="topstep">{t('backtesterDataManagement.symbolInfo.typeTopstep')}</option>
                              <option value="tradingview">{t('backtesterDataManagement.symbolInfo.typeTradingview')}</option>
                            </select>
                            <div className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                          </div>
                        ) : (
                          <span className={`text-xs sm:text-sm font-medium px-2 py-1 rounded inline-block ${
                            (data.type || 'topstep') === 'topstep'
                              ? isDark
                                ? 'bg-blue-900/30 text-blue-300'
                                : 'bg-blue-100 text-blue-700'
                              : isDark
                                ? 'bg-purple-900/30 text-purple-300'
                                : 'bg-purple-100 text-purple-700'
                          }`}>
                            {(data.type || 'topstep').charAt(0).toUpperCase() + (data.type || 'topstep').slice(1)}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Description
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={displayData.description ?? ''}
                            onChange={(e) => onUpdateEditingData('description', e.target.value)}
                            className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                              isDark
                                ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                            }`}
                          />
                        ) : (
                          <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{data.description}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Tick Size
                          </label>
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={displayData.tickSize ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                onUpdateEditingData('tickSize', val === '' ? '' : (parseFloat(val) || 0))
                              }}
                              className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                                isDark
                                  ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                  : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                              }`}
                            />
                          ) : (
                            <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{data.tickSize}</p>
                          )}
                        </div>
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Tick Value
                          </label>
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={displayData.tickValue ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                onUpdateEditingData('tickValue', val === '' ? '' : (parseFloat(val) || 0))
                              }}
                              className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                                isDark
                                  ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                  : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                              }`}
                            />
                          ) : (
                            <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{data.tickValue}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Exchange Fee
                          </label>
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={displayData.exchangeFee ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                onUpdateEditingData('exchangeFee', val === '' ? '' : (parseFloat(val) || 0))
                              }}
                              className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                                isDark
                                  ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                  : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                              }`}
                            />
                          ) : (
                            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{(data.exchangeFee ?? 0).toFixed(4)}</p>
                          )}
                        </div>
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Regulatory Fee
                          </label>
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={displayData.regulatoryFee ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                onUpdateEditingData('regulatoryFee', val === '' ? '' : (parseFloat(val) || 0))
                              }}
                              className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                                isDark
                                  ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                  : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                              }`}
                            />
                          ) : (
                            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{(data.regulatoryFee ?? 0).toFixed(4)}</p>
                          )}
                        </div>
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Commission Fee
                          </label>
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={displayData.commissionFee ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                onUpdateEditingData('commissionFee', val === '' ? '' : (parseFloat(val) || 0))
                              }}
                              className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                                isDark
                                  ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                  : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                              }`}
                            />
                          ) : (
                            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{(data.commissionFee ?? 0).toFixed(4)}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Total Fees
                        </label>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={displayData.totalFees ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              onUpdateEditingData('totalFees', val === '' ? '' : (parseFloat(val) || 0))
                            }}
                            className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                              isDark
                                ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                                : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                            }`}
                          />
                        ) : (
                          <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {(data.totalFees ?? 0).toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Add Symbol Modal */}
          {editingSymbol === 'NEW' && editingData && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div
                className={`rounded-2xl shadow-2xl border p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto ${
                  isDark
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}
              >
                <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('backtesterDataManagement.symbolInfo.addNewSymbol')}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('backtesterDataManagement.symbolInfo.symbol')}
                    </label>
                    <input
                      type="text"
                      value={(editingData as any)?.symbol || ''}
                      onChange={(e) => onUpdateEditingData('symbol' as any, e.target.value)}
                      placeholder={t('backtesterDataManagement.symbolInfo.symbolPlaceholder')}
                      className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                        isDark
                          ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                          : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Type
                    </label>
                    <div className="relative">
                      <select
                        value={editingData.type || 'topstep'}
                        onChange={(e) => onUpdateEditingData('type' as any, e.target.value)}
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
                        <option value="topstep">{t('backtesterDataManagement.symbolInfo.typeTopstep')}</option>
                        <option value="tradingview">{t('backtesterDataManagement.symbolInfo.typeTradingview')}</option>
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
                      value={editingData.description || ''}
                      onChange={(e) => onUpdateEditingData('description', e.target.value)}
                      placeholder="e.g., Nasdaq, Gold"
                      className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                        isDark
                          ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                          : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {t('backtesterDataManagement.symbolInfo.tickSize')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingData.tickSize ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          onUpdateEditingData('tickSize', val === '' ? '' : (parseFloat(val) || 0))
                        }}
                        className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                          isDark
                            ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                            : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Tick Value
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingData.tickValue ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          onUpdateEditingData('tickValue', val === '' ? '' : (parseFloat(val) || 0))
                        }}
                        className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                          isDark
                            ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                            : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {t('backtesterDataManagement.symbolInfo.exchangeFee')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingData.exchangeFee ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          onUpdateEditingData('exchangeFee', val === '' ? '' : (parseFloat(val) || 0))
                        }}
                        className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                          isDark
                            ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                            : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
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
                        value={editingData.regulatoryFee ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          onUpdateEditingData('regulatoryFee', val === '' ? '' : (parseFloat(val) || 0))
                        }}
                        className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                          isDark
                            ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                            : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {t('backtesterDataManagement.symbolInfo.commissionFee')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingData.commissionFee ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          onUpdateEditingData('commissionFee', val === '' ? '' : (parseFloat(val) || 0))
                        }}
                        className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                          isDark
                            ? 'bg-slate-800/50 border-slate-700 text-white focus:bg-slate-800 focus:border-blue-500'
                            : 'bg-white/80 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={onCancelEdit}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                        isDark
                          ? 'bg-slate-700 hover:bg-slate-600 text-white'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const symbol = (editingData as any)?.symbol
                        if (symbol) {
                          const totalFees = (editingData.exchangeFee || 0) + 
                                           (editingData.regulatoryFee || 0) + 
                                           (editingData.commissionFee || 0)
                          onSave(symbol as string, {
                            ...editingData,
                            symbol: symbol as string,
                            totalFees,
                          } as SymbolData)
                        }
                      }}
                      disabled={saving || !(editingData as any)?.symbol || !editingData.tickSize || !editingData.tickValue}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                        isDark
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      } ${saving || !editingData.symbol || !editingData.tickSize || !editingData.tickValue ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

            </>
          )}

          {/* Delete Confirmation Dialog */}
          <ConfirmDialog
            isOpen={deleteConfirm.isOpen}
            title={t('backtesterDataManagement.symbolInfo.deleteTitle')}
            message={t('backtesterDataManagement.symbolInfo.deleteConfirm', { symbol: deleteConfirm.symbol || '' })}
            confirmText={t('backtesterDataManagement.symbolInfo.deleteButton')}
            cancelText={t('backtesterDataManagement.symbolInfo.cancel')}
            onConfirm={onDeleteConfirm}
            onCancel={onDeleteCancel}
            variant="danger"
            isDark={isDark}
          />

          {/* Symbol Info Dialog */}
          <SymbolInfoDialog
            isOpen={selectedSymbol !== null}
            symbol={selectedSymbol?.symbol || ''}
            type={selectedSymbol?.type || 'topstep'}
            symbolData={selectedSymbol ? (() => {
              // Helper to convert colon to double underscore
              const convertToConfigFormat = (sym: string) => sym.replace(/:/g, '__')
              
              // For Topstep, check both with and without leading slash
              if (selectedSymbol.type === 'topstep') {
                const symbolWithSlash = selectedSymbol.symbol
                const symbolWithoutSlash = symbolWithSlash.startsWith('/') ? symbolWithSlash.slice(1) : symbolWithSlash
                return symbols[symbolWithSlash] || symbols[symbolWithoutSlash]
              }
              // For TradingView, check base symbol, full formatted symbol (with colon), and config format (with double underscore)
              if (selectedSymbol.type === 'tradingview' && selectedSymbol.tradingViewData) {
                const baseSymbol = selectedSymbol.tradingViewData.formattedSymbol?.split(':').pop() || selectedSymbol.symbol
                const fullSymbol = selectedSymbol.tradingViewData.formattedSymbol || selectedSymbol.symbol
                const fullSymbolConfig = convertToConfigFormat(fullSymbol)
                
                // Also check if it's a contract symbol
                if (selectedSymbol.tradingViewData.contracts && selectedSymbol.tradingViewData.contracts.length > 0) {
                  // Check all possible contract symbols (both colon and double underscore versions)
                  for (const c of selectedSymbol.tradingViewData.contracts) {
                    const contractSym = c.symbol?.replace(/<[^>]*>/g, '') || ''
                    const contractFull = `${selectedSymbol.tradingViewData.source_id || 'CME_MINI'}:${contractSym}`
                    const contractFullConfig = convertToConfigFormat(contractFull)
                    
                    // Check contract variations: config format, full symbol, contract symbol, base without suffix
                    if (symbols[contractFullConfig]) return symbols[contractFullConfig]
                    if (symbols[contractFull]) return symbols[contractFull]
                    if (symbols[contractSym]) return symbols[contractSym]
                    
                    // Check base without suffix (e.g., "NQ" from "NQ1!")
                    const contractBase = contractSym.replace(/[!0-9]+$/, '')
                    if (contractBase && contractBase !== contractSym && symbols[contractBase]) {
                      return symbols[contractBase]
                    }
                  }
                }
                // Check in order: config format (double underscore), full symbol (colon), base symbol, base without suffix
                const baseWithoutSuffix = baseSymbol.replace(/[!0-9]+$/, '')
                return symbols[fullSymbolConfig] || symbols[fullSymbol] || symbols[baseSymbol] || 
                       (baseWithoutSuffix && baseWithoutSuffix !== baseSymbol ? symbols[baseWithoutSuffix] : undefined) ||
                       symbols[selectedSymbol.symbol]
              }
              return symbols[selectedSymbol.symbol]
            })() : undefined}
            topstepData={selectedSymbol?.topstepData}
            tradingViewData={selectedSymbol?.tradingViewData}
            topstepFiles={topstepFiles}
            tradingviewFiles={tradingviewFiles}
            unknownFiles={unknownFiles}
            symbols={symbols}
            isDark={isDark}
            onClose={onSymbolDialogClose}
            onUpdate={onSymbolUpdate}
            onOverwrite={onSymbolOverwrite}
            onReset={onSymbolReset}
            onDownload={onSymbolDownload}
            progressState={progressState}
          />

          {/* Topstep Tab Content */}
          {activeTab === 'topstep' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Token Selector */}
              <TokenSelector
                currentToken={topstepCurrentToken}
                onCurrentTokenChange={onTopstepCurrentTokenChange}
                savedToken={topstepSavedToken}
                onTokenObtained={onTopstepTokenObtained}
                onSaveToken={onTopstepSaveToken}
                onUserLogin={onTopstepUserLogin}
                colorScheme="blue"
                isDark={isDark}
                source="topstep"
              />
              
              {/* Data Source Section */}
              <DataSourceSection
                title="TopstepX"
                searchValue={topstepSearch}
                searchResults={topstepSearchResults}
                searchError={topstepSearchError}
                searchLoading={topstepSearchLoading}
                onSearchChange={onTopstepSearchChange}
                files={topstepFiles}
                loadingFiles={loadingFiles}
                type="topstep"
                colorScheme="blue"
                isDark={isDark}
                expandedSymbols={expandedSymbols}
                expandedYears={expandedYears}
                onToggleSymbol={onToggleSymbol}
                onToggleYear={onToggleYear}
                onSymbolClick={onSymbolClick}
                progressState={progressState}
                symbolsConfig={symbols}
              />
            </div>
          )}

          {/* TradingView Tab Content */}
          {activeTab === 'tradingview' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Token Selector */}
              <TokenSelector
                currentToken={tradingviewCurrentToken}
                onCurrentTokenChange={onTradingviewCurrentTokenChange}
                savedToken={tradingviewSavedToken}
                onTokenObtained={onTradingviewTokenObtained}
                onSaveToken={onTradingviewSaveToken}
                onUserLogin={onTradingviewUserLogin}
                colorScheme="purple"
                isDark={isDark}
                source="tradingview"
              />
              
              {/* Data Source Section */}
              <DataSourceSection
                title={t('backtesterDataManagement.tradingview.title')}
                searchValue={tradingviewSearch}
                searchResults={tradingviewSearchResults}
                searchError={tradingviewSearchError}
                searchLoading={tradingviewSearchLoading}
                onSearchChange={onTradingviewSearchChange}
                files={tradingviewFiles}
                loadingFiles={loadingFiles}
                type="tradingview"
                colorScheme="purple"
                isDark={isDark}
                expandedSymbols={expandedSymbols}
                expandedYears={expandedYears}
                onToggleSymbol={onToggleSymbol}
                onToggleYear={onToggleYear}
                onSymbolClick={onSymbolClick}
                progressState={progressState}
                symbolsConfig={symbols}
              />
            </div>
          )}
        </main>
      </div>
    )
  }

  /**
   * Organize files by symbol and year
   */
  organizeFilesBySymbolAndYear(files: Array<{
    symbol: string
    year: number
    month: string
    fileName: string
    filePath: string
    size: number
    modified: string
  }>) {
    const organized: Record<string, Record<number, typeof files>> = {}
    
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

  /**
   * Render CSV files section with organized hierarchy
   */
  /**
   * Render search section with search bar
   */
  renderSearchSection(
    title: string,
    searchValue: string,
    searchResults: string[],
    onSearchChange: (value: string) => void,
    _colorScheme: 'blue' | 'purple',
    isDark: boolean
  ) {
    return (
      <div
        className={`rounded-2xl shadow-lg border overflow-hidden ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
      >
        <div className="p-4 sm:p-6">
          <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {title}
          </h2>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`Search ${title}...`}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border outline-none transition-all ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:bg-slate-800 focus:border-blue-500'
                  : 'bg-white/80 border-slate-300 text-slate-900 placeholder-slate-500 focus:bg-white focus:border-blue-500'
              }`}
            />
          </div>
          
          {/* Search Results */}
          {searchValue.trim() && searchResults.length > 0 && (
            <div className={`mt-4 p-3 rounded-lg border ${
              isDark
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <p className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Search Results:
              </p>
              <div className="space-y-1">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className={`px-3 py-2 rounded ${
                      isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-white text-slate-700'
                    }`}
                  >
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}
          {searchValue.trim() && searchResults.length === 0 && (
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
    )
  }

  renderCSVFilesSection(
    title: string,
    files: Array<{
      symbol: string
      year: number
      month: string
      fileName: string
      filePath: string
      size: number
      modified: string
    }>,
    loadingFiles: boolean,
    type: string,
    colorScheme: 'blue' | 'purple'
  ) {
    const { isDark, expandedSymbols, expandedYears, onToggleSymbol, onToggleYear } = this.props
    const organized = this.organizeFilesBySymbolAndYear(files)
    const symbols = Object.keys(organized).sort()
    const totalFiles = files.length

    const colorClasses = {
      blue: {
        badge: isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700',
        border: isDark ? 'border-blue-700/50' : 'border-blue-200',
        hover: isDark ? 'hover:bg-blue-900/20' : 'hover:bg-blue-50',
      },
      purple: {
        badge: isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700',
        border: isDark ? 'border-purple-700/50' : 'border-purple-200',
        hover: isDark ? 'hover:bg-purple-900/20' : 'hover:bg-purple-50',
      },
    }
    const colors = colorClasses[colorScheme]

    return (
      <div
        className={`rounded-2xl shadow-lg border overflow-hidden ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
      >
        <div className={`p-4 sm:p-6 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {title} CSV Files
          </h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {loadingFiles ? 'Loading...' : `${totalFiles} file(s) across ${symbols.length} symbol(s)`}
          </p>
        </div>

        {loadingFiles ? (
          <div className="p-8 text-center">
            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Loading CSV files...</p>
          </div>
        ) : symbols.length === 0 ? (
          <div className="p-8 text-center">
            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
              No {title} CSV files found. Add symbols with type "{type}" to see their CSV files here.
            </p>
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
            {symbols.map((symbol) => {
              const years = Object.keys(organized[symbol])
                .map(y => parseInt(y))
                .sort((a, b) => b - a) // Sort descending (newest first)
              const isSymbolExpanded = expandedSymbols.has(symbol)
              const totalFilesForSymbol = years.reduce((sum, year) => sum + organized[symbol][year].length, 0)

              return (
                <div key={symbol} className={`${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  {/* Symbol Header */}
                  <button
                    onClick={() => onToggleSymbol(symbol)}
                    className={`w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between transition-all ${
                      isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSymbolExpanded ? (
                        <ChevronDown className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                      ) : (
                        <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                      )}
                      <span className={`font-semibold text-base sm:text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {symbol}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${colors.badge}`}>
                        {totalFilesForSymbol} file{totalFilesForSymbol !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>

                  {/* Years List */}
                  {isSymbolExpanded && (
                    <div className={`${isDark ? 'bg-slate-900/30' : 'bg-slate-50/50'}`}>
                      {years.map((year) => {
                        const yearKey = `${symbol}-${year}`
                        const isYearExpanded = expandedYears.has(yearKey)
                        const yearFiles = organized[symbol][year]

                        return (
                          <div key={year} className={`border-l-2 ${colors.border} ml-4 sm:ml-6`}>
                            {/* Year Header */}
                            <button
                              onClick={() => onToggleYear(yearKey)}
                              className={`w-full px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between transition-all ${
                                isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {isYearExpanded ? (
                                  <ChevronDown className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`} />
                                ) : (
                                  <ChevronRight className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`} />
                                )}
                                <span className={`font-medium text-sm sm:text-base ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                  {year}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${colors.badge}`}>
                                  {yearFiles.length} file{yearFiles.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </button>

                            {/* Files List */}
                            {isYearExpanded && (
                              <div className="ml-4 sm:ml-6 space-y-1 pb-2">
                                {yearFiles.map((file, fileIndex) => (
                                  <div
                                    key={`${file.symbol}-${file.year}-${file.month}-${fileIndex}`}
                                    className={`px-4 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between text-sm ${
                                      isDark ? 'hover:bg-slate-800/20' : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                        {file.month}
                                      </span>
                                      <span className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                        {file.fileName}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                                      <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                        {(file.size / 1024).toFixed(1)} KB
                                      </span>
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
    )
  }

  renderTokenSelector(
    tokenMode: 'login' | 'manual',
    manualToken: string,
    onTokenModeChange: (mode: 'login' | 'manual') => void,
    onManualTokenChange: (token: string) => void,
    colorScheme: 'blue' | 'purple',
    isDark: boolean
  ) {
    const colorClasses = {
      blue: {
        active: isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white',
        inactive: isDark ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300',
        border: isDark ? 'border-blue-700/50' : 'border-blue-200',
        focus: isDark ? 'focus:border-blue-500' : 'focus:border-blue-500',
      },
      purple: {
        active: isDark ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white',
        inactive: isDark ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300',
        border: isDark ? 'border-purple-700/50' : 'border-purple-200',
        focus: isDark ? 'focus:border-purple-500' : 'focus:border-purple-500',
      },
    }
    const colors = colorClasses[colorScheme]

    return (
      <div
        className={`rounded-2xl shadow-lg border overflow-hidden ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
      >
        <div className="p-4 sm:p-6">
          <h3 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Token Selection
          </h3>
          
          {/* Mini Tabs for Token Mode */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => onTokenModeChange('login')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tokenMode === 'login' ? colors.active : colors.inactive
              }`}
            >
              Use Login Token
            </button>
            <button
              onClick={() => onTokenModeChange('manual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tokenMode === 'manual' ? colors.active : colors.inactive
              }`}
            >
              Manual Entry
            </button>
          </div>

          {/* Manual Token Input (shown when manual mode is selected) */}
          {tokenMode === 'manual' && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Enter Token
              </label>
              <input
                type="text"
                value={manualToken}
                onChange={(e) => onManualTokenChange(e.target.value)}
                placeholder="Enter your token here..."
                className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                  isDark
                    ? `bg-slate-800/50 border-slate-700 text-white placeholder-slate-500 focus:bg-slate-800 ${colors.focus}`
                    : `bg-white/80 border-slate-300 text-slate-900 placeholder-slate-500 focus:bg-white ${colors.focus}`
                }`}
              />
            </div>
          )}

          {/* Show current token mode info */}
          {tokenMode === 'login' && (
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Using token from your login session
            </p>
          )}
        </div>
      </div>
    )
  }
}

export default BacktesterDataManagementRenderer
