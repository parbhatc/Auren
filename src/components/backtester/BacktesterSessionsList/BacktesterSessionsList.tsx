import { Component } from 'react'
import { Plus, Search } from 'lucide-react'
import CreateSessionModal from '../CreateSessionModal'
import ErrorMessage from '../../common/ErrorMessage'
import { PageHeading } from '../../layout/WorkspacePrimitives'
import BacktesterPageShell from '../shared/BacktesterPageShell'
import BacktesterSessionCard from '../shared/BacktesterSessionCard'
import { BacktesterSessionsListProps } from '../../../types/backtester'
import { t } from '../../../utils/translator'
import { ROUTES } from '../../../constants/routes'
import { saveDashboardAccountSelection } from '../../../services/dashboard/dashboardAccountSelection'

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

  handleOverviewClick = (sessionId: string) => {
    saveDashboardAccountSelection({ source: 'replay', accountId: sessionId })
    this.props.navigate(ROUTES.DASHBOARD)
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
        const pnlA =
          (a.currentBalance ?? a.initialBalance ?? 50000) -
          (a.initialBalance ?? 50000)
        const pnlB =
          (b.currentBalance ?? b.initialBalance ?? 50000) -
          (b.initialBalance ?? 50000)
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
        {symbolsError && (
          <ErrorMessage message={symbolsError} isDark={isDark} />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2
            className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}
          >
            {t('replay.hub.yourSessions', {}, 'Your sessions')}
          </h2>
          <button
            type="button"
            onClick={onCreateClick}
            disabled={availableSymbols.length === 0}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isDark
                ? 'bg-[var(--app-button)] text-[var(--app-button-text)] hover:opacity-90'
                : 'bg-[var(--app-button)] text-[var(--app-button-text)] hover:opacity-90'
            }`}
            title={
              availableSymbols.length === 0
                ? t('backtester.noSymbolsAvailable')
                : ''
            }
          >
            <Plus className="w-4 h-4" aria-hidden />
            {t('replay.hub.createSession', {}, 'Create session')}
          </button>
        </div>

        <div
          className={`flex flex-col gap-3 rounded-[20px] border p-4 sm:flex-row sm:p-5 ${isDark ? 'border-[var(--app-border)] bg-[var(--app-panel)]' : 'border-[var(--app-border)] bg-white'}`}
        >
          <div className="relative flex-1 max-w-md">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
            />
            <input
              type="search"
              placeholder={t(
                'backtester.searchSessions',
                {},
                'Search sessions…'
              )}
              value={this.state.searchQuery}
              onChange={(e) => this.setState({ searchQuery: e.target.value })}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500/40 ${
                isDark
                  ? 'bg-zinc-800/80 border-zinc-600 text-zinc-100 placeholder:text-zinc-500'
                  : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
              }`}
            />
          </div>
          <select
            value={this.state.sortMode}
            onChange={(e) =>
              this.setState({ sortMode: e.target.value as SortMode })
            }
            className={`px-3 py-2.5 rounded-xl border text-sm sm:w-44 ${
              isDark
                ? 'bg-zinc-800/80 border-zinc-600 text-zinc-200'
                : 'bg-white border-zinc-300 text-zinc-700'
            }`}
            aria-label="Sort sessions"
          >
            <option value="recent">
              {t('backtester.sortRecent', {}, 'Most recent')}
            </option>
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
          <p
            className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}
          >
            {filteredSessions.length} of {sessions.length}
          </p>
        )}

        <div className="space-y-3">
          {filteredSessions.length === 0 ? (
            <div
              className={`rounded-[20px] border px-6 py-16 text-center ${isDark ? 'border-[var(--app-border)] bg-[var(--app-panel)]' : 'border-[var(--app-border)] bg-white'}`}
            >
              {sessions.length === 0 ? (
                <>
                  <p
                    className={`text-lg font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}
                  >
                    {t('backtester.noSessions')}
                  </p>
                  <p
                    className={`text-sm mb-6 max-w-sm mx-auto ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}
                  >
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
                    className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold disabled:opacity-50 ${isDark ? 'bg-[var(--app-button)] text-[var(--app-button-text)]' : 'bg-[var(--app-button)] text-[var(--app-button-text)]'}`}
                  >
                    <Plus className="w-4 h-4" />
                    {t('replay.hub.createSession', {}, 'Create session')}
                  </button>
                </>
              ) : (
                <p className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
                  {t(
                    'backtester.noSearchResults',
                    {},
                    'No sessions match your search.'
                  )}
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
                onOverview={() => this.handleOverviewClick(session.id)}
              />
            ))
          )}
        </div>

        {!embedded && showAdmin && availableSymbols.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.BACKTESTER_DATA_MANAGEMENT)}
            className={`text-sm font-medium ${isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-zinc-600 hover:text-zinc-700'}`}
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
        <PageHeading
          eyebrow="Learn from the market"
          title="Replay sessions"
          description="Step through historical futures, refine your entries, and review each decision at your own pace."
        />
        {this.renderSessionsBody()}
      </BacktesterPageShell>
    )
  }
}

export default BacktesterSessionsList
