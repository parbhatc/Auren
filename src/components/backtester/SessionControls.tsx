import { Component } from 'react'
import { Play, Square, Settings } from 'lucide-react'
import { getThemeColors } from '../../constants/theme'
import SessionResults from './SessionResults'
import { SessionControlsProps } from '../../types/backtester'
import { t } from '../../utils/translator'

class SessionControls extends Component<SessionControlsProps> {
  render() {
    const { isDark, session, onRun, onStop } = this.props
    const colors = getThemeColors(isDark)

    return (
      <div
        className={`rounded-2xl shadow-2xl border p-4 ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className={`text-xl font-bold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {session.name}
            </h2>
            <p
              className={`text-sm ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {session.symbol} • {session.timeframe} • {session.startDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRun}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${colors.button.primary}`}
            >
              <Play className="w-4 h-4" />
              {t('backtester.run')}
            </button>
            <button
              onClick={onStop}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${colors.button.danger}`}
            >
              <Square className="w-4 h-4" />
              {t('backtester.stop')}
            </button>
            <button
              className={`p-2 rounded-lg transition-all ${
                isDark
                  ? 'hover:bg-slate-700 text-slate-400'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {session.results && (
          <SessionResults isDark={isDark} results={session.results} />
        )}
      </div>
    )
  }
}

export default SessionControls
