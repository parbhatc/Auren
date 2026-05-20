import { Component } from 'react'
import { TradeButtonsProps } from '../../types/common'

class TradeButtons extends Component<TradeButtonsProps> {
  render() {
    const { onBuy, onSell, isDark } = this.props

    return (
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onBuy}
          className={`px-4 py-3 rounded-lg font-bold text-sm transition-all ${
            isDark
              ? 'bg-green-900/50 text-green-400 hover:bg-green-900/70 border border-green-700 active:scale-95'
              : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 active:scale-95'
          }`}
        >
          Buy
        </button>
        <button
          onClick={onSell}
          className={`px-4 py-3 rounded-lg font-bold text-sm transition-all ${
            isDark
              ? 'bg-red-900/50 text-red-400 hover:bg-red-900/70 border border-red-700 active:scale-95'
              : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 active:scale-95'
          }`}
        >
          Sell
        </button>
      </div>
    )
  }
}

export default TradeButtons

