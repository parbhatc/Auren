import { Component } from 'react'
import { History, Plus, Search } from 'lucide-react'
import CreateSessionModal from '../CreateSessionModal'
import ErrorMessage from '../../common/ErrorMessage'
import HubHeroSection from '../../trading/Practice/hub/HubHeroSection'
import BacktesterPageShell from '../shared/BacktesterPageShell'
import BacktesterSessionCard, { backtesterStatsPath } from '../shared/BacktesterSessionCard'
import { BacktesterSessionsListProps } from '../../../types/backtester'
import { emptyStateClass } from '../../../styles/aurenTheme'
import { t } from '../../../utils/translator'
import { ROUTES } from '../../../constants/routes'

type SortMode = 'recent' | 'name' | 'pnl'

/**
 * Replay sessions list — full page or embedded on the practice hub (`/?mode=replay`).
 */
class BacktesterSessionsList extends Component<
  BacktesterSessionsListProps & { showAdmin?: boolean; embedded?: boolean }
> {
  state = {
    searchQuery: '',
    sortMode: 'recent' as SortMode,
  }

  handlePlayClick = (sessionId: string) => {
    const { navigate, onPlaySession } = this.props
    onPlaySession(sessionId)
    navigate(`/backtester/chart?sessionId=${sessionId}`)
  }

  getFilteredSessions = () => {
    const { sessions } = this.props
    const { searchQuery, sortMode } = this.state
    const q = searchQuery.trim().toLowerCase()

    let filtered = sessions
    if (q) {
      filtered = sessions.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.symbol.toLowerCase().includes(q) ||
          s.startDate.includes(q)
      )
    }

    return [...filtered].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name)
      if (sortMode === 'pnl') {
        const pnlA = (a.currentBalance ?? a.initialBalance ?? 50000) - (a.initialBalance ?? 50000)
        const pnlB = (b.currentBalance ?? b.initialBalance ?? 50000) - (b.initialBalance ?? 50000)
        return pnlB - pnlA
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }

  renderSessionsBody() {
    const {
      isDark,
      navigate,
      sessions,
      showNewSessionForm,
      availableSymbols,
      symbolsError,
      createError,
      newSession,
      showAdmin = false,
      embedded = false,
      onDeleteSession,
      onResetSession,
      onEditSession,
      onCreateClick,
      onCloseNewSessionForm,
      onSessionChange,
      onCreateSession,
    } = this.props

    const filteredSessions = this.getFilteredSessions()

    return (
      <div className="space-y-6">
        {symbolsError && <ErrorMessage message={symbolsError} isDark={isDark} />}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('replay.hub.yourSessions', {}, 'Your sessions')}
          </h2>
          <button
            type="button"
            onClick={onCreateClick}
            disabled={availableSymbols.length === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            title={availableSymbols.length === 0 ? t('backtester.noSymbolsAvailable') : ''}
          >
            <Plus className="w-4 h-4" aria-hidden />
            {t('replay.hub.createSession', {}, 'Create session')}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="search"
              placeholder={t('backtester.searchSessions', {}, 'Search sessions…')}
              value={this.state.searchQuery}
              onChange={(e) => this.setState({ searchQuery: e.target.value })}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${
                isDark
                  ? 'bg-slate-800/80 border-slate-600 text-slate-100 placeholder:text-slate-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>
          <select
            value={this.state.sortMode}
            onChange={(e) => this.setState({ sortMode: e.target.value as SortMode })}
            className={`px-3 py-2.5 rounded-xl border text-sm sm:w-44 ${
              isDark
                ? 'bg-slate-800/80 border-slate-600 text-slate-200'
                : 'bg-white border-slate-300 text-slate-700'
            }`}
            aria-label="Sort sessions"
          >
            <option value="recent">{t('backtester.sortRecent', {}, 'Most recent')}</option>
            <option value="name">{t('backtester.sortName', {}, 'Name')}</option>
            <option value="pnl">{t('backtester.sortPnl', {}, 'P/L')}</option>
          </select>
        </div>

        <CreateSessionModal
          isOpen={showNewSessionForm}
          isDark={isDark}
          availableSymbols={availableSymbols}
          newSession={newSession}
          symbolsError={symbolsError}
          createError={createError}
          onClose={onCloseNewSessionForm}
          onSessionChange={onSessionChange}
          onCreate={onCreateSession}
        />

        {filteredSessions.length !== sessions.length && sessions.length > 0 && (
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {filteredSessions.length} of {sessions.length}
          </p>
        )}

        <div className="space-y-3">
          {filteredSessions.length === 0 ? (
            <div className={emptyStateClass(isDark)}>
              {sessions.length === 0 ? (
                <>
                  <p className={`text-lg font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('backtester.noSessions')}
                  </p>
                  <p className={`text-sm mb-6 max-w-sm mx-auto ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    {t(
                      'backtester.noSessionsHint',
                      {},
                      'Create a session to start replaying historical bars and simulating trades.'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={onCreateClick}
                    disabled={availableSymbols.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold text-sm disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {t('replay.hub.createSession', {}, 'Create session')}
                  </button>
                </>
              ) : (
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  {t('backtester.noSearchResults', {}, 'No sessions match your search.')}
                </p>
              )}
            </div>
          ) : (
            filteredSessions.map((session) => (
              <BacktesterSessionCard
                key={session.id}
                session={session}
                isDark={isDark}
                onPlay={() => this.handlePlayClick(session.id)}
                onEdit={() => onEditSession(session.id)}
                onReset={() => onResetSession(session.id)}
                onDelete={() => onDeleteSession(session.id)}
                onStats={() => navigate(backtesterStatsPath(session.id))}
              />
            ))
          )}
        </div>

        {!embedded && showAdmin && availableSymbols.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.BACKTESTER_DATA_MANAGEMENT)}
            className={`text-sm font-medium ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-700'}`}
          >
            {t('replay.hub.manageData', {}, 'Manage CSV data →')}
          </button>
        )}
      </div>
    )
  }

  render() {
    const { isDark, toggleTheme, navigate, embedded = false } = this.props

    if (embedded) {
      return this.renderSessionsBody()
    }

    return (
      <BacktesterPageShell
        isDark={isDark}
        toggleTheme={toggleTheme}
        navigate={navigate}
        activeTab="sessions"
        showAdmin={this.props.showAdmin}
      >
        <HubHeroSection
          isDark={isDark}
          icon={History}
          badge={t('replay.hub.badge', {}, 'Bar-by-bar history')}
          headline={t('replay.hub.headline', {}, 'Replay before you trade live')}
          subtitle={t(
            'replay.hub.subtitle',
            {},
            'Step through historical futures bars from CSV data. Simulate entries, journal your rules, and review stats — your practice and live accounts stay untouched.'
          )}
          accent="sky"
        />
        {this.renderSessionsBody()}
      </BacktesterPageShell>
    )
  }
}

export default BacktesterSessionsList
