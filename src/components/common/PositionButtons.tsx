import { Component } from 'react'
import { PositionButtonsProps } from '../../types/common'

class PositionButtons extends Component<PositionButtonsProps> {
  render() {
    const { onClose, onReverse, onFlatten, isDark } = this.props

    return (
      <div className="space-y-2 pt-2 border-t border-slate-700 dark:border-slate-700">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className={`px-4 py-2.5 rounded-lg font-medium text-xs transition-all ${
              isDark
                ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600 active:scale-95'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 active:scale-95'
            }`}
          >
            Close Position
          </button>
          <button
            onClick={onReverse}
            className={`px-4 py-2.5 rounded-lg font-medium text-xs transition-all ${
              isDark
                ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-900/70 border border-blue-700 active:scale-95'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 active:scale-95'
            }`}
          >
            Reverse Position
          </button>
        </div>
        <button
          onClick={onFlatten}
          className={`w-full px-4 py-2.5 rounded-lg font-medium text-xs transition-all ${
            isDark
              ? 'bg-amber-900/50 text-amber-400 hover:bg-amber-900/70 border border-amber-700 active:scale-95'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300 active:scale-95'
          }`}
        >
          Flatten All Position
        </button>
      </div>
    )
  }
}

export default PositionButtons

