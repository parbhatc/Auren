import { Component } from 'react'
import { TradeButtonsProps } from '../../types/common'
import { TradeSideButton } from './TradeSideButton'

class TradeButtons extends Component<TradeButtonsProps> {
  render() {
    const { onBuy, onSell, isDark } = this.props

    return (
      <div className="grid grid-cols-2 gap-2">
        <TradeSideButton side="buy" variant="panel" isDark={isDark} onClick={onBuy}>
          Buy
        </TradeSideButton>
        <TradeSideButton side="sell" variant="panel" isDark={isDark} onClick={onSell}>
          Sell
        </TradeSideButton>
      </div>
    )
  }
}

export default TradeButtons
