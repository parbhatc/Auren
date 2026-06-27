import { Component } from 'react'
import { Plus } from 'lucide-react'
import ErrorMessage from '../common/ErrorMessage'
import SessionCard from './SessionCard'
import { SessionsSidebarProps } from '../../types/backtester'
import { panelCardClass, primaryButtonClass } from '../../styles/aurenTheme'
import { t } from '../../utils/translator'

class SessionsSidebar extends Component<SessionsSidebarProps> {
  handleCreateClick = () => {
    const { availableSymbols, onSymbolsError, onCreateClick } = this.props
    if (availableSymbols.length === 0) {
      onSymbolsError(t('backtester.noSymbolsAvailable'))
      return
    }
    onSymbolsError('')
    onCreateClick()
  }

  render() {
    const {
      isDark,
      sessions,
      activeSessionId,
      availableSymbols,
      symbolsError,
      onSelectSession,
      onDuplicateSession,
      onDeleteSession,
    } = this.props

    return (
      <div className="lg:col-span-1">
        <div className={panelCardClass(isDark)}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('backtester.sessions')}
            </h2>
            <button
              type="button"
              onClick={this.handleCreateClick}
              disabled={availableSymbols.length === 0}
              className={`p-2 rounded-lg ${primaryButtonClass()} disabled:opacity-50 disabled:cursor-not-allowed`}
              title={availableSymbols.length === 0 ? t('backtester.noSymbolsAvailable') : ''}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {symbolsError && (
            <ErrorMessage message={symbolsError} isDark={isDark} className="mb-4" />
          )}

          <div className="space-y-2 max-h-[calc(100vh-250px)] sm:max-h-[calc(100vh-300px)] overflow-y-auto">
            {sessions.length === 0 ? (
              <p className={`text-sm text-center py-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('backtester.noSessions')}
              </p>
            ) : (
              sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isActive={activeSessionId === session.id}
                  isDark={isDark}
                  onSelect={() => onSelectSession(session.id)}
                  onDuplicate={() => onDuplicateSession(session)}
                  onDelete={() => onDeleteSession(session.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    )
  }
}

export default SessionsSidebar
