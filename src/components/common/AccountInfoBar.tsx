import { Component } from 'react'
import { AccountInfoBarProps } from '../../types/common'

class AccountInfoBar extends Component<AccountInfoBarProps> {
  render() {
    const { balance, mll, rpl, upl, isDark } = this.props
    
    // Helper function to format P&L values with commas
    const formatPnL = (value: number) => {
      const absValue = Math.abs(value)
      // Consider values < 0.01 as effectively zero
      const isZero = absValue < 0.01 || value === 0
      
      if (isZero) {
        return {
          text: '$0.00',
          className: isDark ? 'text-white' : 'text-slate-900'
        }
      } else if (value > 0) {
        return {
          text: `+$${absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          className: 'text-green-500'
        }
      } else {
        return {
          text: `-$${absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          className: 'text-red-500'
        }
      }
    }
    
    const rplFormatted = formatPnL(rpl)
    const uplFormatted = formatPnL(upl)

    return (
      <div className={`flex items-center justify-between gap-1.5 sm:gap-2 md:gap-3 mb-2 sm:mb-3 ${isDark ? 'bg-slate-800/50' : 'bg-white/50'} rounded-lg px-2 sm:px-3 py-1.5 sm:py-2`}>
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-1 min-w-0">
          <div className="text-center sm:text-left">
            <div className={`text-[9px] sm:text-[10px] md:text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <span className="sm:hidden">BAL</span>
              <span className="hidden sm:inline">Balance</span>
            </div>
            <div className={`text-xs sm:text-sm md:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        {mll !== undefined && (
          <>
            <div className={`h-6 sm:h-8 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
            <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-1 min-w-0">
              <div className="text-center sm:text-left">
                <div className={`text-[9px] sm:text-[10px] md:text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  MLL
                </div>
                <div className={`text-xs sm:text-sm md:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  ${mll.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </>
        )}
        <div className={`h-6 sm:h-8 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-1 min-w-0">
          <div className="text-center sm:text-left">
            <div className={`text-[9px] sm:text-[10px] md:text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              RP&L
            </div>
            <div className={`text-xs sm:text-sm md:text-base font-bold ${rplFormatted.className}`}>
              {rplFormatted.text}
            </div>
          </div>
        </div>
        <div className={`h-6 sm:h-8 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-1 min-w-0">
          <div className="text-center sm:text-left">
            <div className={`text-[9px] sm:text-[10px] md:text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              UP&L
            </div>
            <div className={`text-xs sm:text-sm md:text-base font-bold ${uplFormatted.className}`}>
              {uplFormatted.text}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default AccountInfoBar

