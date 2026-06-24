import ContractQuantityControl from '../../../common/ContractQuantityControl'
import TradeButtons from '../../../common/TradeButtons'
import PositionButtons from '../../../common/PositionButtons'
import EconomicNewsPanel from '../../../common/EconomicNewsPanel'
import { TradingHandler } from '../../../../services/trading/TradingHandler'
import { logTradeIfAllowed } from './tradeActions'

type ClassicTradePanelProps = {
  isDark: boolean
  contractQuantity: number | string
  selectedSymbol: string
  tradingBlocked: boolean
  showNews: boolean
  onQuantityChange: (delta: number) => void
  onQuantityUpdate: (quantity: number) => void
  onQuantityInputChange: (value: string) => void
  onQuantityBlur: () => void
  onShowNewsChange: (show: boolean) => void
  getTradeHandler: () => any
}

export function ClassicTradePanel({
  isDark,
  contractQuantity,
  selectedSymbol,
  tradingBlocked,
  showNews,
  onQuantityChange,
  onQuantityUpdate,
  onQuantityInputChange,
  onQuantityBlur,
  onShowNewsChange,
  getTradeHandler,
}: ClassicTradePanelProps) {
  const runAction = (action: string, payload?: { quantity: number; symbol: string }) => {
    logTradeIfAllowed(tradingBlocked, () => {
      const handler = getTradeHandler()
      if (handler) {
        if (payload) {
          handler.logButtonPress(action, payload)
        } else {
          handler.logButtonPress(action)
        }
      } else if (payload) {
        TradingHandler.logButtonPress(action, payload)
      } else {
        TradingHandler.logButtonPress(action)
      }
    })
  }

  return (
    <div
      className={`rounded-lg sm:rounded-xl shadow-lg border flex flex-col lg:h-full ${
        isDark
          ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
          : 'bg-white/90 border-slate-200 backdrop-blur-sm'
      }`}
    >
      <div
        className={`p-3 sm:p-4 border-b flex-shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
      >
        <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Trade
        </h3>
      </div>
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 flex-shrink-0">
        <ContractQuantityControl
          quantity={contractQuantity}
          onQuantityChange={onQuantityChange}
          onQuantityUpdate={onQuantityUpdate}
          onQuantityInputChange={onQuantityInputChange}
          onQuantityBlur={onQuantityBlur}
          isDark={isDark}
          disabled={tradingBlocked}
        />

        <TradeButtons
          onBuy={() => {
            const qty = Number(contractQuantity) || 1
            runAction('Buy', { quantity: qty, symbol: selectedSymbol })
          }}
          onSell={() => {
            const qty = Number(contractQuantity) || 1
            runAction('Sell', { quantity: qty, symbol: selectedSymbol })
          }}
          isDark={isDark}
          disabled={tradingBlocked}
        />

        <PositionButtons
          onClose={() => runAction('Close Position')}
          onReverse={() => runAction('Reverse Position')}
          onFlatten={() => runAction('Flatten All Position')}
          isDark={isDark}
          disabled={tradingBlocked}
        />
      </div>

      <div
        className={`flex-shrink-0 border-t lg:flex-1 lg:flex lg:flex-col lg:min-h-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
      >
        {showNews ? (
          <div className="p-3 sm:p-4 flex flex-col h-full lg:min-h-0">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h3 className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Economic News
              </h3>
              <button
                onClick={() => onShowNewsChange(false)}
                className={`text-xs px-2 py-1 rounded ${
                  isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Hide
              </button>
            </div>
            <div className="flex-1 overflow-y-auto lg:min-h-0">
              <EconomicNewsPanel isDark={isDark} />
            </div>
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <button
              onClick={() => onShowNewsChange(true)}
              className={`w-full text-xs px-3 py-2 rounded-lg ${
                isDark
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Show Economic News
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
