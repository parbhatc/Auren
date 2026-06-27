import { Component } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { SessionCardProps } from '../../types/backtester'
import { resolveSessionDisplaySymbol } from '../../backtester/constants'
import { listCardClass } from '../../styles/aurenTheme'

class SessionCard extends Component<SessionCardProps> {
  render() {
    const { session, isActive, isDark, onSelect, onDuplicate, onDelete } = this.props

    return (
      <div
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect()}
        className={`p-3 rounded-xl border cursor-pointer transition-all ${
          isActive
            ? isDark
              ? 'bg-violet-500/10 border-violet-500/40 ring-1 ring-violet-500/20'
              : 'bg-violet-50 border-violet-300 ring-1 ring-violet-200'
            : isDark
              ? 'bg-slate-900/50 border-slate-700 hover:border-violet-500/30'
              : 'bg-white border-slate-200 hover:border-violet-200'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {session.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-600'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {resolveSessionDisplaySymbol(session.symbol)} · {session.timeframe}
        </p>
      </div>
    )
  }
}

export default SessionCard
