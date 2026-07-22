import { Component, type ReactNode } from 'react'
import { ROUTES } from '../../../constants/routes'
import ErrorMessage from '../../common/ErrorMessage'
import SuccessMessage from '../../common/SuccessMessage'
import Loading from '../../common/Loading'
import ConfirmDialog from '../../common/ConfirmDialog'
import HubHeroSection from '../../trading/Practice/hub/HubHeroSection'
import ProductHeader from '../../layout/ProductHeader'
import BacktesterNav from '../shared/BacktesterNav'
import CsvDataSection from './CsvDataSection'
import SymbolInfoSection from './SymbolInfoSection'
import SymbolFormModal from './SymbolFormModal'
import { BacktesterDataManagementRendererProps } from '../../../types/backtesterDataManagement'
import { t } from '../../../utils/translator'
import { appPageBackground, panelCardClass, primaryButtonClass, tabRailActiveClass, tabRailClass } from '../../../styles/aurenTheme'
import { Database } from 'lucide-react'

class BacktesterDataManagementRenderer extends Component<BacktesterDataManagementRendererProps> {
  render() {
    const {
      isDark,
      toggleTheme,
      user,
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
      csvInventory,
      loadingCsvInventory,
      onCsvUpdate,
      onCsvOverwrite,
      onCsvDownload,
      onCsvTradingViewTokenChange,
      onCsvTradingViewTokenBlur,
      tradingviewCurrentToken,
      progressState,
    } = this.props

    const shell = (content: ReactNode) => (
      <div className={`auren-shell-offset ${appPageBackground(isDark)}`}>
        <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <BacktesterNav
            isDark={isDark}
            toggleTheme={toggleTheme}
            navigate={navigate}
            activeTab="data"
            showAdmin
          />
          {content}
        </main>
      </div>
    )

    if (loading) {
      return shell(<div className="min-h-64"><Loading /></div>)
    }

    if (!user?.isAdmin) {
      return shell(
        <div className="py-12">
            <div className={`${panelCardClass(isDark)} mx-auto max-w-md text-center`}>
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
        </div>
      )
    }

    const isFormOpen = Boolean(editingSymbol && editingData)

    return shell(
      <>
          <HubHeroSection
            isDark={isDark}
            icon={Database}
            badge={t('backtester.data.badge', {}, 'Admin')}
            headline={t('backtesterDataManagement.title')}
            subtitle={t('backtesterDataManagement.subtitle')}
            accent="blue"
          />

          <ErrorMessage message={error} isDark={isDark} className="mb-4" />
          <SuccessMessage message={success} isDark={isDark} className="mb-4" />

          <div className={`mb-6 ${tabRailClass(isDark)} overflow-x-auto`}>
            {(['symbol-info', 'csv-data'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={`flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? tabRailActiveClass(isDark, 'blue')
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'symbol-info' && t('backtesterDataManagement.tabs.symbolInfo')}
                {tab === 'csv-data' && t('backtesterDataManagement.tabs.csvData')}
              </button>
            ))}
          </div>

          {activeTab === 'symbol-info' && (
            <SymbolInfoSection
              isDark={isDark}
              symbols={symbols}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}

          <SymbolFormModal
            isOpen={isFormOpen}
            isNew={editingSymbol === 'NEW'}
            isDark={isDark}
            editingData={editingData ?? {}}
            saving={saving}
            onUpdateEditingData={onUpdateEditingData}
            onSave={onSave}
            onCancel={onCancelEdit}
          />

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

          {activeTab === 'csv-data' && (
            <CsvDataSection
              isDark={isDark}
              inventory={csvInventory}
              loading={loadingCsvInventory}
              progressState={progressState}
              symbols={symbols}
              tradingViewToken={tradingviewCurrentToken}
              onUpdate={onCsvUpdate}
              onOverwrite={onCsvOverwrite}
              onDownload={onCsvDownload}
              onTradingViewTokenChange={onCsvTradingViewTokenChange}
              onTradingViewTokenBlur={onCsvTradingViewTokenBlur}
            />
          )}
      </>
    )
  }
}

export default BacktesterDataManagementRenderer
