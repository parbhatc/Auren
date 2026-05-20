import { Component } from 'react'
import { Plus, Minus } from 'lucide-react'
import { ContractQuantityControlProps } from '../../types/common'

class ContractQuantityControl extends Component<ContractQuantityControlProps> {
  render() {
    const { quantity, onQuantityChange, onQuantityUpdate, onQuantityInputChange, onQuantityBlur, isDark } = this.props

    return (
      <div>
        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          Contracts
        </label>
        {/* Preset Buttons */}
        <div className="grid grid-cols-6 gap-1 mb-2">
          {[1, 2, 3, 5, 10, 15].map((preset) => (
            <button
              key={preset}
              onClick={() => onQuantityUpdate(preset)}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                Number(quantity) === preset
                  ? isDark
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                  : isDark
                  ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        {/* Manual Input with +/- */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onQuantityChange(-1)}
            className={`p-2 rounded-lg transition-all ${
              isDark
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => onQuantityInputChange(e.target.value)}
            onBlur={onQuantityBlur}
            min="1"
            className={`flex-1 px-3 py-2 rounded-lg border text-center text-sm font-medium ${
              isDark
                ? 'bg-slate-900 border-slate-600 text-slate-100 focus:ring-blue-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 focus:ring-blue-500'
            } focus:outline-none focus:ring-2`}
          />
          <button
            onClick={() => onQuantityChange(1)}
            className={`p-2 rounded-lg transition-all ${
              isDark
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }
}

export default ContractQuantityControl

