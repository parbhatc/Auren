import React, { Component } from 'react'
import { StatsCalendarProps } from '../../../types/common'
import {
  formatLocalDate,
  isSyntheticTradeseaTrade,
  monthDateRangeLocal,
} from '../../../services/tradesea/tradeseaTradelensStats'
import { getTradeCalendarDate } from '../../../utils/tradeCalendarDate'

class StatsCalendar extends Component<StatsCalendarProps> {
  render() {
    const {
      isDark,
      currentMonth,
      trades,
      calendarDaySummaries,
      referenceDate,
      symbolData,
      formatDateForInput,
      formatCurrency,
      calculateTradePnL,
      onDayClick,
      onWeekClick,
      onMonthChange
    } = this.props

    const year = currentMonth.getFullYear()
    
    // Get first day of month and last day
    const firstDay = new Date(year, currentMonth.getMonth(), 1)
    const lastDay = new Date(year, currentMonth.getMonth() + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()
    
    // Calculate monthly stats from actual trades
    // Calendar always uses the full month, ignoring date range selector
    const { startDate: monthStartStr, endDate: monthEndStr } = monthDateRangeLocal(
      year,
      currentMonth.getMonth()
    )

    const realTrades = trades.filter((trade) => !isSyntheticTradeseaTrade(trade))

    const calendarByDate = new Map<string, { pnl: number; tradesCount: number }>()
    for (const day of calendarDaySummaries || []) {
      const key = String(day.date || '').split('T')[0]
      if (!key) continue
      calendarByDate.set(key, {
        pnl: Number(day.pnl) || 0,
        tradesCount: Math.max(0, Math.floor(Number(day.tradesCount) || 0)),
      })
    }

    const monthTrades = realTrades.filter((trade) => {
      const tradeDate = getTradeCalendarDate(trade)
      return tradeDate && tradeDate >= monthStartStr && tradeDate <= monthEndStr
    })

    const monthlyProfitFromTrades = monthTrades.reduce((sum, trade) => {
      const grossPnl = calculateTradePnL(trade)
      // Get fees - use trade.fees when present, else symbol data
      let fees = 0
      if (trade.fees !== undefined || trade.originalTrade?.fees !== undefined) {
        fees = trade.fees || trade.originalTrade?.fees || 0
      } else {
      const symbol = trade.symbol || ''
      const symbolInfo = symbolData?.[symbol]
      const totalFees = symbolInfo?.totalFees || 0
        fees = totalFees * Math.abs(trade.contracts || 0)
      }
      return sum + grossPnl - fees
    }, 0)

    const monthlyProfitFromCalendar = [...calendarByDate.entries()]
      .filter(([date]) => date >= monthStartStr && date <= monthEndStr)
      .reduce((sum, [, row]) => sum + row.pnl, 0)

    const monthlyProfit =
      calendarByDate.size > 0 ? monthlyProfitFromCalendar : monthlyProfitFromTrades

    const daysTradedFromCalendar = [...calendarByDate.entries()].filter(
      ([date, row]) => date >= monthStartStr && date <= monthEndStr && row.tradesCount > 0
    ).length

    const daysTraded =
      calendarByDate.size > 0
        ? daysTradedFromCalendar
        : new Set(
            monthTrades
              .map((trade) => getTradeCalendarDate(trade))
              .filter((date): date is string => Boolean(date))
          ).size
    
    // Debug logging
    // const uniqueDatesArray = Array.from(new Set(monthTrades.map(trade => {
    //   const tradeDate = trade.entry_time ? 
    //     (typeof trade.entry_time === 'number' 
    //       ? new Date(trade.entry_time * 1000).toISOString().split('T')[0]
    //       : trade.entry_time.split(' ')[0]) 
    //     : null
    //   if (tradeDate && tradeDate >= monthStartStr && tradeDate <= monthEndStr) {
    //     return tradeDate
    //   }
    //   return null
    // })
    // .filter(date => date !== null && date !== undefined)
    // )).sort()
  
    
    // Navigate months
    const goToPreviousMonth = () => {
      const newMonth = new Date(currentMonth)
      newMonth.setMonth(newMonth.getMonth() - 1)
      onMonthChange(newMonth)
    }
    
    const goToNextMonth = () => {
      const newMonth = new Date(currentMonth)
      newMonth.setMonth(newMonth.getMonth() + 1)
      onMonthChange(newMonth)
    }
    
    const goToToday = () => {
      onMonthChange(referenceDate)
    }
    
    // Generate calendar days
    const calendarDays: JSX.Element[] = []
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    // Add day headers
    weekDays.forEach((day) => {
      calendarDays.push(
        <div
          key={`header-${day}`}
          className={`text-center text-xs sm:text-sm font-bold py-2 sm:py-2.5 transition-colors duration-500 w-full min-w-[70px] sm:min-w-[80px] md:min-w-[90px] flex-shrink-0 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          {day}
        </div>
      )
    })
    
    // Add week header
    calendarDays.push(
      <div
        key="header-week"
        className={`text-center text-xs sm:text-sm font-bold py-2 sm:py-2.5 transition-colors duration-500 border-l-2 pl-1 sm:pl-2 w-full min-w-[70px] sm:min-w-[80px] md:min-w-[90px] flex-shrink-0 ${
          isDark ? 'text-slate-300 border-slate-700' : 'text-slate-700 border-slate-300'
        }`}
      >
        Week
      </div>
    )
    
    // Add empty cells before first day
    for (let i = 0; i < startDayOfWeek; i++) {
      calendarDays.push(
        <div
          key={`empty-${i}`}
          className={`aspect-square w-full min-w-[70px] sm:min-w-[80px] md:min-w-[90px] min-h-[70px] sm:min-h-[80px] md:min-h-[90px] rounded-lg sm:rounded-xl border-2 p-2 sm:p-2.5 overflow-hidden transition-all opacity-30 transition-colors duration-500 flex-shrink-0 ${
            isDark
              ? 'border-slate-800/40 bg-slate-900/20'
              : 'border-slate-300/40 bg-slate-50/20'
          }`}
        >
          <div className="flex items-center justify-center h-full">
            <span className={`text-[10px] sm:text-xs md:text-sm font-semibold transition-colors duration-500 ${
              isDark ? 'text-slate-700' : 'text-slate-300'
            }`}></span>
          </div>
        </div>
      )
    }
    
    // Add days of month
    let currentWeek = 1
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, currentMonth.getMonth(), day)
      const dateStr = formatLocalDate(date)
      const todayDateStr = formatDateForInput(referenceDate)
      const isToday = dateStr === todayDateStr

      const dayTrades = realTrades.filter((trade) => getTradeCalendarDate(trade) === dateStr)
      const daySummary = calendarByDate.get(dateStr)
      const summaryTradeCount = daySummary?.tradesCount ?? 0
      const tradeCount = dayTrades.length > 0 ? dayTrades.length : summaryTradeCount
      const hasActivity = tradeCount > 0

      const profit = hasActivity
        ? dayTrades.length > 0
          ? dayTrades.reduce((sum, trade) => {
        const grossPnl = calculateTradePnL(trade)
        // Get fees - use trade.fees when present, else symbol data
        let fees = 0
        if (trade.fees !== undefined || trade.originalTrade?.fees !== undefined) {
          fees = trade.fees || trade.originalTrade?.fees || 0
        } else {
        const symbol = trade.symbol || ''
        const symbolInfo = symbolData?.[symbol]
        const totalFees = symbolInfo?.totalFees || 0
          fees = totalFees * Math.abs(trade.contracts || 0)
        }
        const netPnl = grossPnl - fees
        return sum + netPnl
      }, 0)
          : (daySummary?.pnl ?? null)
        : null

      const isProfit = profit != null ? profit > 0 : false
      
      calendarDays.push(
        <div
          key={`day-${day}`}
          onClick={() => {
            if (!hasActivity) return

            if (dayTrades.length > 0) {
              const dayProfit = dayTrades.reduce((sum, trade) => {
                const grossPnl = calculateTradePnL(trade)
                // Get fees - use trade.fees when present, else symbol data
                let fees = 0
                if (trade.fees !== undefined || trade.originalTrade?.fees !== undefined) {
                  fees = trade.fees || trade.originalTrade?.fees || 0
                } else {
                const symbol = trade.symbol || ''
                const symbolInfo = symbolData?.[symbol]
                const totalFees = symbolInfo?.totalFees || 0
                  fees = totalFees * Math.abs(trade.contracts || 0)
                }
                return sum + grossPnl - fees
              }, 0)
              
              const totalContracts = dayTrades.reduce((sum, trade) => sum + Math.abs(trade.contracts || 0), 0)
              const longTrades = dayTrades.filter(t => t.direction?.toLowerCase() === 'long')
              const shortTrades = dayTrades.filter(t => t.direction?.toLowerCase() === 'short')
              const longContracts = longTrades.reduce((sum, trade) => sum + Math.abs(trade.contracts || 0), 0)
              const shortContracts = shortTrades.reduce((sum, trade) => sum + Math.abs(trade.contracts || 0), 0)
              
              const wins = dayTrades.filter(trade => {
                const grossPnl = calculateTradePnL(trade)
                const fees = trade.fees || trade.originalTrade?.fees || 0
                return (grossPnl - fees) > 0
              }).length
              
              const totalFeesDay = dayTrades.reduce((sum, trade) => {
                const fees = trade.fees || trade.originalTrade?.fees || 0
                return sum + fees
              }, 0)
              
              onDayClick({
                date: dateStr,
                day: day,
                profit: dayProfit,
                totalTrades: dayTrades.length,
                totalContracts,
                longTrades: longTrades.length,
                shortTrades: shortTrades.length,
                longContracts,
                shortContracts,
                wins,
                losses: dayTrades.length - wins,
                totalFees: totalFeesDay,
                trades: dayTrades,
              })
              return
            }

            if (daySummary) {
              onDayClick({
                date: dateStr,
                day,
                profit: daySummary.pnl,
                totalTrades: summaryTradeCount,
                totalContracts: 0,
                longTrades: 0,
                shortTrades: 0,
                longContracts: 0,
                shortContracts: 0,
                wins: 0,
                losses: 0,
                totalFees: 0,
                trades: [],
              })
            }
          }}
          className={`aspect-square w-full min-w-[70px] sm:min-w-[80px] md:min-w-[90px] min-h-[70px] sm:min-h-[80px] md:min-h-[90px] rounded-lg sm:rounded-xl border-2 p-2 sm:p-2.5 md:p-3 overflow-hidden transition-all flex-shrink-0 ${
            isToday
              ? `border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/30`
              : hasActivity
              ? isProfit
                ? isDark
                  ? 'border-green-600/70 bg-green-900/50 hover:bg-green-900/60 shadow-sm'
                  : 'border-green-400/70 bg-green-50/90 hover:bg-green-100 shadow-sm'
                : isDark
                ? 'border-red-600/70 bg-red-900/50 hover:bg-red-900/60 shadow-sm'
                : 'border-red-400/70 bg-red-50/90 hover:bg-red-100 shadow-sm'
              : isDark
              ? 'border-slate-800/60 bg-slate-800/40 hover:bg-slate-800/60'
              : 'border-slate-300/60 bg-slate-50/60 hover:bg-slate-100/80'
          } transition-colors duration-200 ${hasActivity ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <span className={`text-xs sm:text-sm md:text-base font-bold transition-colors duration-500 ${
              isToday 
                ? (isDark ? 'text-emerald-300' : 'text-emerald-700')
                : (isDark ? 'text-slate-200' : 'text-slate-800')
            }`}>
              {day}
            </span>
            {hasActivity && (
              <>
                <span className={`text-[8px] sm:text-[9px] md:text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                  isDark 
                    ? 'bg-slate-700/70 text-slate-200' 
                    : 'bg-slate-200/90 text-slate-800'
                }`}>
                  {tradeCount}
                </span>
                {profit !== null && (
                  <span className={`text-[10px] sm:text-xs md:text-sm font-bold leading-tight ${
                    isProfit
                      ? isDark ? 'text-green-400' : 'text-green-600'
                      : isDark ? 'text-red-400' : 'text-red-600'
                  }`}>
                    <span className="hidden sm:inline">{formatCurrency(profit, false)}</span>
                    <span className="sm:hidden">{formatCurrency(profit, true)}</span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )
      
      // Add week column at end of each week (only on Saturday, not on last day)
      if (date.getDay() === 6) {
        const weekStart = new Date(year, currentMonth.getMonth(), day - date.getDay())
        const weekEnd = new Date(year, currentMonth.getMonth(), day)
        const weekStartStr = formatLocalDate(weekStart)
        const weekEndStr = formatLocalDate(weekEnd)

        const weekTrades = realTrades.filter((trade) => {
          const tradeDate = getTradeCalendarDate(trade)
          return tradeDate && tradeDate >= weekStartStr && tradeDate <= weekEndStr
        })
        
        const weekProfit = weekTrades.reduce((sum, trade) => {
          const grossPnl = calculateTradePnL(trade)
          // Get fees - use trade.fees when present, else symbol data
          let fees = 0
          if (trade.fees !== undefined || trade.originalTrade?.fees !== undefined) {
            fees = trade.fees || trade.originalTrade?.fees || 0
          } else {
          const symbol = trade.symbol || ''
          const symbolInfo = symbolData?.[symbol]
          const totalFees = symbolInfo?.totalFees || 0
            fees = totalFees * Math.abs(trade.contracts || 0)
          }
          const netPnl = grossPnl - fees
          return sum + netPnl
        }, 0)
      
        
        const weekTradeCount = weekTrades.length
        const weekIsProfit = weekProfit > 0
        
        calendarDays.push(
          <div
            key={`week-${currentWeek}`}
            onClick={() => {
              if (weekTradeCount > 0) {
                onWeekClick({
                  weekNumber: currentWeek,
                  startDate: weekStartStr,
                  endDate: weekEndStr,
                  profit: weekProfit,
                  totalTrades: weekTradeCount,
                  trades: weekTrades
                })
              }
            }}
            className={`flex w-full min-w-[70px] sm:min-w-[80px] md:min-w-[90px] min-h-[70px] sm:min-h-[80px] md:min-h-[90px] rounded-lg sm:rounded-xl border-2 p-2 sm:p-2.5 md:p-3 flex-col justify-center items-center border-l-3 overflow-hidden transition-colors duration-200 flex-shrink-0 ${
              weekTradeCount > 0
                ? isDark
                  ? 'border-slate-600/70 bg-slate-800/60 border-l-slate-500 shadow-sm cursor-pointer hover:bg-slate-800/80'
                  : 'border-slate-300/70 bg-slate-100/70 border-l-slate-400 shadow-sm cursor-pointer hover:bg-slate-200/90'
                : isDark
                ? 'border-slate-700/60 bg-slate-800/40 border-l-slate-700'
                : 'border-slate-300/60 bg-slate-100/50 border-l-slate-300'
            }`}
          >
            <div className="w-full space-y-1 max-w-full overflow-hidden">
              <p className={`text-[9px] sm:text-[10px] md:text-xs font-bold text-center transition-colors duration-500 ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}>
                W{currentWeek}
              </p>
              {weekTradeCount > 0 ? (
                <>
                  <p className={`text-[9px] sm:text-[10px] md:text-xs font-semibold text-center ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {weekTradeCount}
                  </p>
                  <p className={`text-[10px] sm:text-[11px] md:text-xs font-bold text-center leading-tight ${
                    weekIsProfit
                      ? isDark ? 'text-green-400' : 'text-green-600'
                      : isDark ? 'text-red-400' : 'text-red-600'
                  }`}>
                    <span className="hidden sm:inline">{formatCurrency(weekProfit, false)}</span>
                    <span className="sm:hidden">{formatCurrency(weekProfit, true)}</span>
                  </p>
                </>
              ) : (
                <span className={`text-[8px] sm:text-[9px] transition-colors duration-500 ${
                  isDark ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  —
                </span>
              )}
            </div>
          </div>
        )
        currentWeek++
      }
    }
    
    // Add empty cells after last day
    const lastDayOfWeek = lastDay.getDay()
    const remainingDays = 6 - lastDayOfWeek
    for (let i = 0; i < remainingDays; i++) {
      calendarDays.push(
        <div
          key={`empty-end-${i}`}
          className={`aspect-square w-full min-w-[70px] sm:min-w-[80px] md:min-w-[90px] min-h-[70px] sm:min-h-[80px] md:min-h-[90px] rounded-lg sm:rounded-xl border-2 p-2 sm:p-2.5 overflow-hidden transition-all opacity-30 transition-colors duration-500 flex-shrink-0 ${
            isDark
              ? 'border-slate-800/40 bg-slate-900/20'
              : 'border-slate-300/40 bg-slate-50/20'
          }`}
        >
          <div className="flex items-center justify-center h-full">
            <span className={`text-[10px] sm:text-xs md:text-sm font-semibold transition-colors duration-500 ${
              isDark ? 'text-slate-700' : 'text-slate-300'
            }`}></span>
          </div>
        </div>
      )
    }
    
    // Add final week cell if month doesn't end on Saturday
    if (lastDayOfWeek !== 6) {
      const finalWeekStart = new Date(year, currentMonth.getMonth(), daysInMonth - lastDayOfWeek)
      const finalWeekEnd = new Date(year, currentMonth.getMonth(), daysInMonth)
      const finalWeekStartStr = formatLocalDate(finalWeekStart)
      const finalWeekEndStr = formatLocalDate(finalWeekEnd)

      const finalWeekTrades = realTrades.filter((trade) => {
        const tradeDate = getTradeCalendarDate(trade)
        return tradeDate && tradeDate >= finalWeekStartStr && tradeDate <= finalWeekEndStr
      })
      
      const finalWeekProfit = finalWeekTrades.reduce((sum, trade) => {
        const grossPnl = calculateTradePnL(trade)
        // Get fees - use trade.fees when present, else symbol data
        let fees = 0
        if (trade.fees !== undefined || trade.originalTrade?.fees !== undefined) {
          fees = trade.fees || trade.originalTrade?.fees || 0
        } else {
        const symbol = trade.symbol || ''
        const symbolInfo = symbolData?.[symbol]
        const totalFees = symbolInfo?.totalFees || 0
          fees = totalFees * Math.abs(trade.contracts || 0)
        }
        return sum + grossPnl - fees
      }, 0)
      
      const finalWeekTradeCount = finalWeekTrades.length
      const finalWeekIsProfit = finalWeekProfit > 0
      
      calendarDays.push(
        <div
          key={`week-${currentWeek}`}
          onClick={() => {
            if (finalWeekTradeCount > 0) {
              onWeekClick({
                weekNumber: currentWeek,
                startDate: finalWeekStartStr,
                endDate: finalWeekEndStr,
                profit: finalWeekProfit,
                totalTrades: finalWeekTradeCount,
                trades: finalWeekTrades
              })
            }
          }}
          className={`flex w-full min-w-[70px] sm:min-w-[80px] md:min-w-[90px] min-h-[70px] sm:min-h-[80px] md:min-h-[90px] rounded-lg sm:rounded-xl border-2 p-2 sm:p-2.5 md:p-3 flex-col justify-center items-center border-l-3 overflow-hidden transition-colors duration-200 flex-shrink-0 ${
            finalWeekTradeCount > 0
              ? isDark
                ? 'border-slate-600/70 bg-slate-800/60 border-l-slate-500 shadow-sm cursor-pointer hover:bg-slate-800/80'
                : 'border-slate-300/70 bg-slate-100/70 border-l-slate-400 shadow-sm cursor-pointer hover:bg-slate-200/90'
              : isDark
              ? 'border-slate-700/60 bg-slate-800/40 border-l-slate-700'
              : 'border-slate-300/60 bg-slate-100/50 border-l-slate-300'
          }`}
        >
          <div className="w-full space-y-1 max-w-full overflow-hidden">
            <p className={`text-[9px] sm:text-[10px] md:text-xs font-bold text-center transition-colors duration-500 ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}>
              W{currentWeek}
            </p>
            {finalWeekTradeCount > 0 ? (
              <>
                <p className={`text-[9px] sm:text-[10px] md:text-xs font-semibold text-center ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {finalWeekTradeCount}
                </p>
                <p className={`text-[10px] sm:text-[11px] md:text-xs font-bold text-center leading-tight ${
                  finalWeekIsProfit
                    ? isDark ? 'text-green-400' : 'text-green-600'
                    : isDark ? 'text-red-400' : 'text-red-600'
                }`}>
                  <span className="hidden sm:inline">{formatCurrency(finalWeekProfit, false)}</span>
                  <span className="sm:hidden">{formatCurrency(finalWeekProfit, true)}</span>
                </p>
              </>
            ) : (
              <span className={`text-[8px] sm:text-[9px] transition-colors duration-500 ${
                isDark ? 'text-slate-600' : 'text-slate-400'
              }`}>
                —
              </span>
            )}
          </div>
        </div>
      )
    }
    
    // Handle month/year change from date input
    const handleMonthYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateValue = e.target.value
      if (dateValue) {
        const selectedDate = new Date(dateValue + '-01') // Add day 1 to make it a valid date
        if (!isNaN(selectedDate.getTime())) {
          onMonthChange(selectedDate)
        }
      }
    }

    // Format current month/year for date input (YYYY-MM format)
    const currentMonthYear = `${year}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`

    return (
      <div className={`rounded-xl p-4 sm:p-6 border transition-colors duration-500 max-w-6xl mx-auto ${
        isDark
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={goToPreviousMonth}
              className={`p-2 rounded-lg transition-colors text-sm sm:text-base font-semibold ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300'
              }`}
              aria-label="Previous month"
            >
              ←
            </button>
            <input
              type="month"
              value={currentMonthYear}
              onChange={handleMonthYearChange}
              className={`text-base sm:text-lg md:text-lg font-bold transition-colors duration-500 px-2 py-1 rounded-lg border ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
              style={{ minWidth: '140px', maxWidth: '200px' }}
            />
            <button
              onClick={goToNextMonth}
              className={`p-2 rounded-lg transition-colors text-sm sm:text-base font-semibold ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300'
              }`}
              aria-label="Next month"
            >
              →
            </button>
          </div>
          <button
            onClick={goToToday}
            className={`px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors text-sm sm:text-base font-medium`}
          >
            TODAY
          </button>
        </div>
        
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 text-xs sm:text-sm">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isDark ? 'bg-slate-800/50' : 'bg-slate-100/50'
          }`}>
            <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Monthly P&L:
            </span>
            <span className={`font-bold text-sm sm:text-base ${
              monthlyProfit >= 0
                ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                : (isDark ? 'text-red-400' : 'text-red-600')
            }`}>
              {formatCurrency(monthlyProfit, false)}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isDark ? 'bg-slate-800/50' : 'bg-slate-100/50'
          }`}>
            <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Total Trades:
            </span>
            <span className={`font-bold text-sm sm:text-base ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
              {monthTrades.length}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isDark ? 'bg-slate-800/50' : 'bg-slate-100/50'
          }`}>
            <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Days Traded:
            </span>
            <span className={`font-bold text-sm sm:text-base ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {daysTraded} {daysTraded === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto pb-2 -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="grid grid-cols-8 gap-1.5 sm:gap-2 md:gap-3 w-full" style={{ minWidth: '560px' }}>
            {calendarDays}
          </div>
        </div>
      </div>
    )
  }
}

export default StatsCalendar
